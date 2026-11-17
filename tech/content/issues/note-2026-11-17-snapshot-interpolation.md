# 서버는 20번 보내는데 화면은 60번, 왜 움직임이 끊기지 않을까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 서버가 보내지 않은 프레임은 어떻게 그릴까요?

멀티플레이 게임에서 서버는 캐릭터 위치를 초당 20번 보내는데, 모니터는 초당 60번 화면을 갱신한다고 가정해 보겠습니다. 서버의 위치가 도착할 때마다 화면에 그대로 적용하면, 캐릭터가 50ms 간격으로 툭툭 움직이는 것처럼 보일 수 있습니다. 그렇다고 서버가 보내지 않은 움직임을 무작정 예측하면, 충돌이나 급회전에서 실제 결과와 달라질 수 있습니다.

이때 사용할 수 있는 방법이 **스냅샷 보간(Snapshot Interpolation)**입니다. 서버가 특정 시점에 기록한 물체의 상태를 스냅샷(Snapshot)이라고 부릅니다. 클라이언트는 서로 다른 시점의 스냅샷 두 개를 잠시 보관한 뒤 그 **사이의 모습**을 만들어 그립니다. 이 원리는 Glenn Fiedler가 2014년 11월 30일 공개한 [원저자 해설](https://new.gafferongames.com/post/snapshot_interpolation/)에서 자세히 설명합니다.

단, 오늘의 보간 대상은 주로 **다른 플레이어처럼 서버에서 상태를 받는 물체의 표시**입니다. 내 캐릭터 입력을 즉시 처리하고 서버 결과로 되돌리는 클라이언트 예측·보정과는 구분해야 합니다.

## 왜 현재가 아니라 과거를 그릴까요?

서버가 위치를 보내는 주기가 정확히 50ms이더라도 도착 간격은 일정하지 않을 수 있습니다. 네트워크 지터(Network Jitter)는 전송 시간의 변동입니다. 어떤 화면 프레임에는 패킷이 두 개 도착하고, 다른 프레임에는 아무것도 오지 않을 수 있습니다.

현재 시각의 좌표를 만들려면 다음 스냅샷이 아직 도착하지 않았을 가능성이 큽니다. 대신 **보간 버퍼(Interpolation Buffer)**에 과거의 기록을 두고, 표시 시간을 조금 뒤로 미룹니다. 예를 들어 서버 시각과 맞춰 놓은 기준 시계가 275ms를 가리킬 때 표시 지연을 100ms로 설정했다면, 화면에 그릴 상태의 시각은 175ms입니다.

$$
t_{\text{render}}=t_{\text{estimated server}}-D
$$

여기서 $D$는 표시 지연입니다. 100ms는 오늘 계산을 위한 설정값이지 모든 게임의 정답이 아닙니다. 실제 구현은 서버·클라이언트의 시각 차이를 추정하고, 수신 주기·지터·패킷 손실을 측정해 조정해야 합니다.

![서버 시각 150ms와 200ms의 스냅샷 사이에 175ms 표시 시점을 두고, 현재 기준 시각 275ms에서 100ms를 되돌린 시간선.](assets/snapshot-timeline.svg)

*직접 제작한 시간선입니다. 275ms에서 100ms를 뺀 표시 시각 175ms는 150ms와 200ms 사이에 있습니다. 수치는 설명용 가정이며 실제 지연 측정값이 아닙니다.*

## 175ms의 위치를 직접 계산해 보겠습니다

단순한 1차원 이동 예제입니다. 서버 시각 150ms에는 위치가 3, 200ms에는 위치가 4였다고 가정합니다. 175ms는 두 스냅샷 사이의 정확히 절반입니다.

보간 계수(Interpolation Factor) $\alpha$는 전체 구간 중 표시 시간이 얼마나 진행됐는지 나타내는 0~1의 비율입니다.

$$
\alpha=\frac{175-150}{200-150}=\frac{25}{50}=0.5
$$

선형 보간(Linear Interpolation)은 시작값과 끝값을 이 비율로 섞습니다.

$$
x=(1-\alpha)\cdot 3+\alpha\cdot 4=3.5
$$

즉 클라이언트는 **서버가 175ms 좌표를 직접 보내지 않았어도 위치 3.5를 그릴 수 있습니다.** 60FPS라면 화면 프레임 간격은 약 16.67ms이므로, 같은 두 스냅샷 사이를 여러 차례 조금씩 진행합니다. 이것이 20Hz 전송과 60FPS 화면이 공존할 수 있는 이유입니다.

![수신한 150ms 위치 3과 200ms 위치 4 사이를 절반 보간하면 175ms 위치 3.5가 되는 수치 예제.](assets/interpolation-values.svg)

*직접 제작한 보간 도식입니다. 시간 비율 25/50=0.5를 위치 3과 4에 적용해 3.5를 구합니다. 모든 값은 인위적인 계산 예제입니다.*

## C++17로 두 스냅샷 사이를 찾기

아래는 특정 게임 엔진의 API가 아닌 **실행 가능한 C++17 표준 라이브러리 예제**입니다. 스냅샷은 서버 시각 오름차순으로 정렬돼 있고, `estimatedServerTime`은 이미 서버 시간축에 맞게 보정됐다고 가정합니다.

```cpp
#include <algorithm>
#include <iostream>
#include <optional>
#include <vector>

struct Snapshot {
    double time; // seconds, server clock
    double x;
};

std::optional<double> Sample(
    const std::vector<Snapshot>& history,
    double estimatedServerTime,
    double interpolationDelay)
{
    if (history.size() < 2) return std::nullopt;

    const double target = estimatedServerTime - interpolationDelay;
    if (target < history.front().time || target > history.back().time)
        return std::nullopt; // Not bracketed: do not silently extrapolate.

    const auto right = std::upper_bound(
        history.begin(), history.end(), target,
        [](double t, const Snapshot& s) { return t < s.time; });

    if (right == history.end()) return history.back().x;

    const auto left = right - 1;
    const double span = right->time - left->time;
    if (span <= 0.0) return std::nullopt;

    const double alpha = (target - left->time) / span;
    return left->x + (right->x - left->x) * alpha;
}

int main()
{
    const std::vector<Snapshot> history = {
        {0.10, 2.0}, {0.15, 3.0}, {0.20, 4.0}
    };
    const auto x = Sample(history, 0.275, 0.100);
    if (x) std::cout << *x << '\n'; // 3.5
}
```

`std::upper_bound`는 목표 시간보다 **늦은 첫 스냅샷**을 찾습니다. 그 직전 기록을 왼쪽 끝으로 잡아 두 점 사이에서 보간합니다. 두 점이 모두 없으면 `std::nullopt`를 반환하고, 호출자는 마지막 화면 위치를 잠시 유지하거나 명시적인 제한 시간 안에서만 외삽할지 결정해야 합니다. `return history.back().x`는 목표 시각이 마지막 스냅샷과 정확히 같은 경계일 때의 처리입니다.

실전에는 수신 순서와 서버 시각이 다를 수 있으므로 **중복 제거와 정렬**, 오래된 기록의 제거, 엔티티 생성·삭제, 순간이동처럼 불연속적으로 바뀌는 상태의 보간 금지가 필요합니다. 이 예제는 그중 **시각을 끼우는 두 스냅샷 찾기와 보간**에만 집중합니다.

## 버퍼를 키우면 언제나 좋은 걸까요?

표시 지연을 길게 잡으면 늦게 들어오는 스냅샷을 기다릴 여유가 늘어나지만, 다른 플레이어가 **실제보다 오래된 위치**에 보입니다. 반대로 짧게 잡으면 어느 순간 목표 시각보다 늦은 스냅샷이 없어서 보간할 수 없게 됩니다. 이는 평균 FPS와 다른, 네트워크 표시 지연의 설계 문제입니다.

패킷 하나를 잃어버렸어도 양쪽 시점의 다른 스냅샷이 있다면 더 긴 구간을 보간할 수 있습니다. 하지만 보간 구간이 넓어질수록 곡선 이동이나 급격한 속도 변화는 직선으로 잘못 표현될 수 있습니다. 원저자 글은 이런 경우 속도까지 사용하는 에르미트 보간(Hermite Interpolation)과 대역폭·지연의 절충도 다룹니다.

외삽(Extrapolation)은 마지막 위치·속도를 바탕으로 아직 보지 못한 미래를 추정하는 기법입니다. 예측한 시간만큼 표시 지연을 줄일 수는 있지만, 충돌·튕김·급회전을 알 수 없으면 관통 후 순간 보정이 발생할 수 있습니다. 따라서 화면의 부드러움, 반응 지연, 오류의 크기를 **각각** 측정하는 편이 좋습니다.

실제 확인할 계측 항목을 정해 보세요. 서버 스냅샷 시간·수신 시간, 현재 표시 목표 시각, 버퍼에 남은 양쪽 스냅샷, 목표 시각을 끼우지 못한 프레임 수, 순간이동 처리 횟수를 함께 로그로 남깁니다. 지터와 패킷 손실을 인위적으로 늘린 뒤 표시 지연을 변경해 비교하면 원인을 분리하기 쉽습니다.

## 오늘 얻어갈 것

서버가 초당 20번 좌표를 보내도 60FPS 화면이 부드러울 수 있는 이유는 **두 스냅샷 사이를 화면 시각에 맞춰 보간하기 때문**입니다. 중요한 조건은 스냅샷 두 개가 확보된 과거 시각을 그리는 것입니다. 오늘 예제에서는 275ms에서 100ms를 되돌린 175ms를 선택하고, 150ms의 위치 3과 200ms의 위치 4 사이에서 3.5를 계산했습니다.

코드에서는 `upper_bound`로 목표 시간을 감싸는 기록 두 개를 찾는지, 기록이 모자랄 때 무제한 외삽하지 않는지 확인해 보세요. 게임에서는 FPS와 별개로 **버퍼 부족 프레임·표시 지연·순간이동 오차**를 관찰하면 좋습니다. 내 캐릭터의 입력 예측과 다른 캐릭터의 시각 보간을 혼동하지 않는 것도 중요합니다.

## 출처

- [Glenn Fiedler, “Snapshot Interpolation” (2014-11-30)](https://new.gafferongames.com/post/snapshot_interpolation/) — 스냅샷 보관, 선형·에르미트 보간, 패킷 손실과 지연의 원저자 기술 해설. 본문의 시간·좌표 예제와 SVG는 별도로 제작했습니다.
- [Glenn Fiedler, “Snapshot Compression” (2015-01-04)](https://new.gafferongames.com/post/snapshot_compression/) — 전송 주기·보간 지연·대역폭의 실제 설계 절충을 다룬 후속 글.
