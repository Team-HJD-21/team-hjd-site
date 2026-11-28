# 체력 갱신은 도착했는데 왜 채팅을 기다릴까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 네트워크에는 도착했는데 게임에는 도착하지 않았습니다

협동 게임에서 서버가 채팅 한 줄을 보낸 직후 체력 변경을 보냅니다. 두 메시지 모두 중요한 정보라서 신뢰성 있는 전송으로 설정했습니다. 그런데 채팅을 실은 패킷 하나를 잃어버리자, 이미 클라이언트에 도착한 체력 변경까지 화면에 표시되지 않습니다. **왜 서로 관계없는 두 정보가 함께 늦어질까요?**

오늘은 두 메시지를 별개로 전송하는 것과 별개로 전달하는 것이 어떻게 다른지 살펴보겠습니다. 여기서 체력 변경은 모든 변경 이벤트를 순서대로 처리해야 하는 게임 규칙상의 메시지라고 가정합니다. 최신 상태만 필요한 체력 스냅샷이라면 뒤에서 설명하는 다른 선택도 가능합니다.

## 신뢰성과 순서 보장은 별개의 요구입니다

신뢰성(Reliability)은 전송 도중 손실된 데이터를 복구하려는 성질입니다. 일반적으로 수신 확인(Acknowledgement, ACK)과 재전송(Retransmission)을 이용합니다. 연결이 영구적으로 끊겼는데도 성공을 보장한다는 뜻은 아닙니다.

순서 보장(Ordering)은 수신 프로그램이 메시지를 보낸 순서대로 처리할 수 있게 하는 성질입니다. 먼저 보낸 메시지가 빠져 있으면 나중에 도착한 메시지를 내부 버퍼에 넣고 기다릴 수 있습니다. 이처럼 선두의 누락 때문에 후속 데이터 전달이 막히는 현상을 **선두 차단(Head-of-line Blocking, HOL Blocking)**이라고 부릅니다.

Glenn Fiedler의 [2016년 9월 15일 신뢰성·순서 보장 메시지 해설](https://new.gafferongames.com/post/reliable_ordered_messages/)은 패킷 번호와 메시지 번호를 별도로 관리하는 구현을 설명합니다. ACK를 받은 패킷에 포함된 메시지는 재전송 대상에서 제거하고, 수신 측은 다음 메시지 번호가 준비됐을 때만 차례대로 꺼냅니다. 패킷 수신 여부와 게임 로직에 전달된 여부가 다른 이유입니다.

## 세 메시지의 도착 시간을 따라가 보겠습니다

서버가 하나의 신뢰성·순서 보장 채널을 사용한다고 가정합니다. 채널(Channel)은 하나의 연결 안에서 순서 관리 범위를 분리하는 논리적인 통로입니다. 설명을 위해 메시지 하나당 패킷 하나를 사용하고, 다음 수신 시각은 이미 주어진 조건으로 둡니다.

| 메시지 번호 | 내용 | 첫 송신 | 수신 완료 |
| --- | --- | --- | --- |
| 0 | 채팅 | 0ms | 120ms (재전송) |
| 1 | 체력 80 | 20ms | 40ms |
| 2 | 체력 60 | 40ms | 60ms |

메시지 1은 40ms에 도착했지만 다음으로 전달할 번호가 0이므로 보관됩니다. 60ms에 메시지 2가 들어와도 번호 0은 아직 비어 있습니다. 120ms에 채팅이 복구되면 번호 0, 1, 2를 차례대로 전달할 수 있습니다.

![채팅 0의 손실로 체력 메시지 1과 2가 각각 40ms와 60ms에 도착해도 120ms까지 기다리는 시간선](assets/ordered-timeline.svg)

*직접 제작한 개념도. 같은 연결의 단일 순서 보장 채널에서 첫 메시지 복구를 기다리는 상황입니다. 시간은 설명용 가정이며 실제 네트워크 측정값이 아닙니다.*

체력 80의 수신 후 추가 대기는 120 − 40 = 80ms, 체력 60은 120 − 60 = 60ms입니다. 이 값은 네트워크를 통과한 시간과 다릅니다. 데이터가 도착한 이후 순서 규칙 때문에 더 기다린 시간입니다. 게임의 프레임 갱신에서 발생하는 추가 대기는 여기서 제외했습니다.

## 순서가 필요한 범위를 좁히면 어떨까요?

채팅과 전투 이벤트에 독립된 신뢰성 채널을 부여합니다. 채팅 채널에는 번호 0이, 전투 채널에는 번호 0(체력 80)과 1(체력 60)이 존재합니다. 이제 각 채널이 관리하는 다음 메시지 번호가 다릅니다.

같은 수신 시각을 가정하면 체력은 40ms에 80으로, 60ms에 60으로 변경할 수 있습니다. 채팅은 여전히 120ms에 복구됩니다. 신뢰성을 없앤 것이 아니라, 채팅과 체력 사이의 순서 제약만 없앤 것입니다.

![두 채널로 나누면 전투 메시지는 40ms와 60ms에 전달되고 채팅은 120ms에 전달되는 비교 시간선](assets/channel-split.svg)

*직접 제작한 개념도. 수신 완료 시각을 그대로 두고 순서 보장 범위만 분리했습니다. 분리만으로 회선 속도나 재전송 시간이 달라진다는 뜻은 아닙니다.*

수신 프로그램의 동작을 식으로 표현하면, 번호 i의 전달 가능 시각은 그 채널에서 i까지의 모든 수신 완료 시각 중 최댓값입니다. 단일 채널의 경우 max(120, 40, 60) = 120ms입니다. 전투만 분리한 채널에서는 max(40, 60) = 60ms입니다.

다만 같은 회선을 쓰므로 대역폭, 혼잡 제어, 송신 큐의 영향은 여전히 공유할 수 있습니다. 채널을 나눈다고 지연이 항상 줄어들지는 않습니다.

## 작은 수신 버퍼로 확인해 보기

다음은 수신 시각을 입력해 게임 로직에 전달되는 순서와 시각을 계산하는 C++17 예제입니다. 소켓 구현이나 실제 재전송 알고리즘은 아니며, 이미 수신이 완료된 메시지만 다룹니다.

```cpp
#include <cassert>
#include <map>
#include <utility>
#include <vector>

struct OrderedChannel {
    int next = 0;
    std::map<int, int> pending; // sequence -> payload
    std::vector<std::pair<int, int>> delivered; // payload, ms

    void Receive(int seq, int payload, int nowMs) {
        if (seq < next) return; // Already delivered.
        pending.emplace(seq, payload);
        while (true) {
            auto it = pending.find(next);
            if (it == pending.end()) break;
            delivered.emplace_back(it->second, nowMs);
            pending.erase(it);
            ++next;
        }
    }
};

int main() {
    OrderedChannel shared;
    shared.Receive(1, 80, 40);
    shared.Receive(2, 60, 60);
    assert(shared.delivered.empty());
    shared.Receive(0, -1, 120); // Chat represented by -1.
    assert(shared.delivered.size() == 3);
    assert(shared.delivered[1] == std::make_pair(80, 120));
    assert(shared.delivered[2] == std::make_pair(60, 120));

    OrderedChannel chat, combat;
    combat.Receive(0, 80, 40);
    combat.Receive(1, 60, 60);
    chat.Receive(0, -1, 120);
    assert(combat.delivered.size() == 2);
    assert(combat.delivered[0] == std::make_pair(80, 40));
    assert(combat.delivered[1] == std::make_pair(60, 60));
}
```

핵심은 `next`와 `pending`을 채널마다 독립적으로 갖는 것입니다. 실전에서는 수신 버퍼 크기, 번호의 순환, 연결 초기화, 중복 메시지와 잘못된 번호 검사도 필요합니다. 위 코드는 순서 대기만 설명하므로 무한히 커질 수 있는 버퍼와 번호를 그대로 제품에 사용해서는 안 됩니다.

## 엔진에서 채널을 선택하는 기준

Godot 4.5의 [고수준 멀티플레이 문서](https://docs.godotengine.org/en/4.5/tutorials/networking/high_level_multiplayer.html)는 채팅과 핵심 게임 메시지에 서로 다른 채널을 사용하는 예를 제시합니다. 원격 프로시저 호출(Remote Procedure Call, RPC)은 다른 피어에서 함수를 실행하도록 요청하는 기능입니다. RPC의 전송 방식과 채널을 함수마다 지정할 수 있습니다.

다음은 Godot 4.5 C#의 실제 RPC 속성 사용 예입니다. 서버가 권한을 가진 동일한 노드 경로의 스크립트에서 사용하고, ENet 연결 생성 시 양쪽에 채널 1과 2를 사용할 수 있도록 채널 수를 설정했다고 가정합니다. 서버에서 연결된 클라이언트에 `RpcId(peerId, MethodName.ReceiveHealth, 80)`처럼 호출합니다.

```csharp
using Godot;

public partial class NetworkEvents : Node
{
    [Rpc(MultiplayerApi.RpcMode.Authority,
        TransferMode = MultiplayerPeer.TransferModeEnum.Reliable,
        TransferChannel = 1)]
    private void ReceiveChat(string text)
    {
        GD.Print(text);
    }

    [Rpc(MultiplayerApi.RpcMode.Authority,
        TransferMode = MultiplayerPeer.TransferModeEnum.Reliable,
        TransferChannel = 2)]
    private void ReceiveHealth(int hp)
    {
        GD.Print($"HP: {hp}");
    }
}
```

서버와 클라이언트의 `ENetMultiplayerPeer.CreateServer`, `CreateClient`에는 각각 최대 채널 수와 채널 수 인수가 있습니다. 실제 연결 환경에서 두 채널의 설정을 확인해야 합니다. 이 예제는 서버가 통지하는 정보의 수신만 보여주며, 클라이언트에게 임의의 체력 변경 권한을 주지 않습니다. Godot에서 기본 채널 0은 전송 방식별로 세 통로를 나누므로 모든 전송 방식이 기본적으로 한 순서 큐를 공유한다고 생각하면 안 됩니다.

전송 방식을 고를 때는 정보의 수명도 고려해야 합니다.

| 정보 | 전달 요구 | 선택의 예 |
| --- | --- | --- |
| 채팅, 확정 전투 이벤트 | 누락 방지, 각 흐름 내부의 순서 | 서로 독립된 신뢰성 채널 |
| 독립적인 최신 위치 스냅샷 | 최신 상태 우선 | 순서가 있는 비신뢰성 전송 |
| 한 번만 보여도 되는 장식 효과 | 손실 허용 여부를 기획으로 결정 | 비신뢰성 전송 후보 |

순서가 있는 비신뢰성 전송(Unreliable Ordered)은 더 최신 메시지가 먼저 도착했을 때 뒤늦은 과거 메시지를 버릴 수 있습니다. 과거 상태가 없어도 해석 가능한 최신 스냅샷에는 적합할 수 있지만, 누락된 이벤트가 영구적인 게임 상태 차이를 만든다면 적합하지 않습니다.

서로 인과관계가 있는 이벤트를 함부로 분리하는 것도 피해야 합니다. 예를 들어 캐릭터 생성과 그 캐릭터의 첫 체력 변경이 다른 채널이면 체력 변경이 먼저 도착할 수 있습니다. 같은 채널로 보내거나 생성 확인, 엔티티 세대 번호, 대기 버퍼 등의 별도 규칙을 설계해야 합니다.

Valve의 [GameNetworkingSockets 공식 저장소](https://github.com/ValveSoftware/GameNetworkingSockets)에도 한 연결 내 여러 레인(Lane)의 순서 차단 관리와 대역폭 배분 기능이 있습니다. `ISteamNetworkingSockets::ConfigureConnectionLanes`는 우선순위와 가중치를 설정하는 API입니다. Godot의 채널과 완전히 동일한 내부 구현이라는 뜻은 아니지만, 순서 의존성과 제한된 전송 자원을 함께 설계한다는 점을 확인할 수 있습니다.

## 오늘 얻어갈 것

체력 정보가 먼저 도착했는데도 채팅을 기다린 이유는 신뢰성 자체가 아니라 **서로 관계없는 데이터에 하나의 전달 순서를 요구했기 때문**입니다. 오늘 예제는 동일한 도착 시각에서 단일 채널의 체력 대기 80ms와 60ms를 분리된 채널의 0ms와 비교했습니다.

실제 멀티플레이 코드에서는 메시지 종류, 채널, 순번, 전송 방식과 함께 패킷 수신 시각 및 게임 로직 전달 시각을 기록해 보세요. 두 시각의 차이와 채널별 대기 메시지 수를 보면 네트워크 전송 지연과 순서 대기를 구별할 수 있습니다. 패킷 손실과 지터를 재현한 테스트에서 독립적인 채널은 계속 진행하는지, 동일 채널의 누락은 정상적으로 복구되는지, 다른 채널의 인과관계가 깨지지 않는지도 확인해 보시면 좋겠습니다.

## 출처

- [Glenn Fiedler, Reliable Ordered Messages (2016-09-15)](https://new.gafferongames.com/post/reliable_ordered_messages/) — 패킷 ACK와 메시지 번호, 순서 보장 수신 버퍼 구현.
- [Godot 4.5, High-level multiplayer](https://docs.godotengine.org/en/4.5/tutorials/networking/high_level_multiplayer.html) — RPC 속성과 전송 방식, 채널 분리.
- [Godot 4.5, MultiplayerPeer](https://docs.godotengine.org/en/4.5/classes/class_multiplayerpeer.html) — 채널과 전송 모드의 의미.
- [Godot 4.5, ENetMultiplayerPeer](https://docs.godotengine.org/en/4.5/classes/class_enetmultiplayerpeer.html) — 연결 생성 시 채널 수 설정.
- [Valve, GameNetworkingSockets 공식 저장소](https://github.com/ValveSoftware/GameNetworkingSockets) — 레인, 신뢰성 전송 및 대역폭 배분 기능 (2026-11-28 확인).
