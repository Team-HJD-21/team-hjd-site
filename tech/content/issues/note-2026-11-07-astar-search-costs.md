# 목표에 더 가까운데 왜 최단 경로가 아닐까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 목표 바로 앞의 문이 비싸다면요?

적을 추격하는 NPC가 갈림길에 섰습니다. 위쪽 길로 가면 목표가 금방 눈앞에 보입니다. 하지만 마지막 문을 통과하는 비용이 큽니다. 아래쪽 길은 멀어 보여도 작은 비용으로 이어집니다. **목표에 더 가까워 보이는 길을 먼저 고르면 항상 가장 싼 경로를 찾을까요?**

오늘은 길찾기의 고전인 **A* 탐색(A-star Search)**을 다섯 개의 지점으로 이해해 보겠습니다. A*는 1968년 Peter Hart, Nils Nilsson, Bertram Raphael의 논문에서 정식으로 설명된 탐색법입니다. 핵심은 '목표까지 얼마나 가까워 보이는가'만 따지지 않고, **여기까지 실제로 쓴 비용**과 **앞으로 남았을 법한 비용**을 합쳐 비교하는 것입니다. [1968년 원 논문](https://doi.org/10.1109/TSSC.1968.300136)과 [Amit Patel의 A* 해설](https://www.redblobgames.com/pathfinding/a-star/introduction.html)을 바탕으로 예제를 구성했습니다.

## 다섯 지점으로 두 경로를 비교해 보겠습니다

NPC의 시작점은 S, 목적지는 G입니다. A는 위쪽 문으로 가는 지점이고, B와 C는 아래쪽 우회 지점입니다. 화살표 옆 숫자는 그 구간을 이동할 때 드는 **비용(Cost)**이며, 거리가 아니라 게임이 정의한 통과 비용일 수도 있습니다. 이 예제의 화살표는 **단방향**입니다.

![시작 S에서 목표 G까지 위쪽 S-A-G는 비용 11, 아래쪽 S-B-C-G는 비용 6인 다섯 지점의 단방향 그래프](assets/astar-route-choices.svg)

*그림 1 · 직접 제작한 설명용 그래프입니다. 위 경로는 2+9=11, 아래 경로는 3+1+2=6입니다. 노드의 h 값은 아래 표의 설명용 하한 추정치이며 엔진이 계산한 수치가 아닙니다. A\*의 원리 참고: [Hart·Nilsson·Raphael(1968)](https://doi.org/10.1109/TSSC.1968.300136).*

어떤 지점에서 갈 수 있는 곳과 비용은 다음과 같습니다.

| 현재 지점 | 다음 지점 | 이동 비용 |
| --- | --- | ---: |
| S | A | 2 |
| S | B | 3 |
| A | G | 9 |
| B | C | 1 |
| C | G | 2 |

목표와 '가까워 보이는' 정도만 고르는 **탐욕적 최선 우선 탐색(Greedy Best-first Search)**이라면, S에서 추정치가 작은 A를 택하고 A 다음에 G를 택할 수 있습니다. 비용은 **11**입니다. 하지만 S→B→C→G의 비용은 **6**입니다. 이 그래프에서 가장 낮은 총비용은 6입니다. 여기서 더 가까워 보인다는 말은 실제 직선거리 측정값이 아니라, 아래에서 정의하는 **추정 함수의 값**을 뜻합니다.

## 이미 든 비용 g와 남은 비용 추정 h

A*는 현재 지점 n을 고를 때 다음 값을 사용합니다.

```text
g(n) = 시작점부터 n까지 현재까지 발견한 최저 비용
h(n) = n에서 목표까지 남은 비용의 추정치
f(n) = g(n) + h(n)
```

**휴리스틱(Heuristic)**은 남은 비용을 빠르게 짐작하는 규칙입니다. 이 예제에서는 설명을 위해 다음 값을 정했습니다. 실제 최저 잔여 비용은 그래프의 화살표를 따라 거꾸로 계산한 값입니다.

| 지점 | h: 남은 비용 추정 | 실제 최저 잔여 비용 |
| --- | ---: | ---: |
| S | 3 | 6 |
| A | 1 | 9 |
| B | 3 | 3 |
| C | 2 | 2 |
| G | 0 | 0 |

어느 지점에서도 h가 실제 남은 최저 비용을 넘지 않습니다. 이런 추정치를 **허용적 휴리스틱(Admissible Heuristic)**이라고 부릅니다. 추정이 작아도 괜찮지만, 최단 경로를 보장하려는 A*에서 **과대평가는 위험**하다는 뜻입니다. 이 예제의 h는 또한 모든 화살표 u→v에서 `h(u) ≤ cost(u,v)+h(v)`를 만족하는 **일관적 휴리스틱(Consistent Heuristic)**입니다.

## A*는 A에 갔다가 왜 B도 살필까요?

A*는 아직 조사할 후보를 **우선순위 큐(Priority Queue)**에 넣고 f가 가장 작은 지점부터 꺼냅니다. 중요한 점은 A를 먼저 살폈다고 바로 그 경로로 결정하지 않는다는 것입니다.

![A*가 S A B C G 순으로 조사하며 목표 G의 후보 비용을 11에서 6으로 개선하는 계산 단계](assets/astar-search-steps.svg)

*그림 2 · 직접 제작한 예제 계산 순서입니다. 각 후보의 f=g+h를 표시했습니다. 같은 우선순위에서는 노드 순서로 결정하는 아래 C++ 예제의 규칙을 사용합니다. 실제 게임에서 측정한 탐색 호출 횟수가 아닙니다. 구현 원리 참고: [Red Blob Games · Implementation of A\*](https://www.redblobgames.com/pathfinding/a-star/implementation.html).*

실제로 큐에서 꺼내는 지점의 순서를 따라가겠습니다.

| 꺼낸 지점 | 새로 찾거나 개선한 후보 | 그 후보의 f |
| --- | --- | --- |
| S | A: g=2, h=1 / B: g=3, h=3 | A=3 / B=6 |
| A | G: g=11, h=0 | G=11 |
| B | C: g=4, h=2 | C=6 |
| C | G를 g=6으로 개선 | G=6 |
| G | 가장 싼 경로를 확정 | 6 |

S에서는 A의 f=3이 B의 f=6보다 작으므로 A를 먼저 봅니다. 그러나 A를 조사해 발견한 G의 f는 11입니다. 큐에는 아직 B의 f=6이 남아 있습니다. 그래서 B와 C를 조사하고, G에 **더 작은 비용 6**으로 도달할 수 있음을 알아냅니다. 목표 G를 큐에서 꺼낼 때 종료하면 경로는 **S→B→C→G**가 됩니다.

이렇게 G를 '처음 발견한 순간'에 끝내지 않고, **최소 f 후보로 꺼낸 순간**에 종료하는 점이 중요합니다. 현재 예제처럼 비용이 음수가 없고 h가 일관적이면, 이 규칙으로 최적 경로를 얻습니다. 일반적인 A* 구현에서 휴리스틱이 일관적이지 않으면 닫힌 노드 재개방 같은 추가 처리가 필요할 수 있습니다. [원 논문](https://doi.org/10.1109/TSSC.1968.300136)과 [Red Blob Games 해설](https://www.redblobgames.com/pathfinding/a-star/introduction.html)에 이 탐색의 전제가 설명돼 있습니다.

## C++17로 다섯 지점을 직접 따라가겠습니다

아래는 **표준 C++17로 실행할 수 있는 예제 코드**입니다. 임의로 만든 그래프에만 적용하는 교육용 구현이며 Unity나 Unreal의 내비게이션 내부 코드를 옮긴 것은 아닙니다. 각 노드에서 나가는 화살표를 `(다음 노드, 비용)`으로 저장합니다.

```cpp
#include <algorithm>
#include <array>
#include <functional>
#include <iostream>
#include <limits>
#include <queue>
#include <utility>
#include <vector>

enum Node { S, A, B, C, G, Count };
using Edge = std::pair<int, int>; // (next, cost)

int main() {
    const std::array<std::vector<Edge>, Count> graph{{
        {{A, 2}, {B, 3}}, {{G, 9}}, {{C, 1}}, {{G, 2}}, {}
    }};
    const std::array<int, Count> h{3, 1, 3, 2, 0};
    const int inf = std::numeric_limits<int>::max() / 4;

    std::array<int, Count> g;
    std::array<int, Count> parent;
    g.fill(inf);
    parent.fill(-1);
    g[S] = 0;

    using Entry = std::pair<int, int>; // (f, node)
    std::priority_queue<Entry, std::vector<Entry>,
                        std::greater<Entry>> open;
    open.push({h[S], S});

    while (!open.empty()) {
        const auto [f, u] = open.top();
        open.pop();
        if (f != g[u] + h[u]) continue; // 오래된 큐 항목 무시
        if (u == G) break;

        for (const auto [v, cost] : graph[u]) {
            const int nextG = g[u] + cost;
            if (nextG < g[v]) {
                g[v] = nextG;
                parent[v] = u;
                open.push({nextG + h[v], v});
            }
        }
    }

    if (g[G] == inf) return 1;
    std::vector<int> path;
    for (int u = G; u != -1; u = parent[u]) path.push_back(u);
    std::reverse(path.begin(), path.end());

    const std::array<char, Count> names{'S', 'A', 'B', 'C', 'G'};
    std::cout << "cost=" << g[G] << ", path=";
    for (int u : path) std::cout << names[u];
    std::cout << '\n';
}
```

```text
cost=6, path=SBCG
```

여기서는 `std::priority_queue`로 가장 작은 f를 먼저 꺼내며, `std::greater`로 최소 힙처럼 사용합니다. 같은 f라면 노드 번호가 작은 쪽을 먼저 꺼냅니다. 이미 들어간 G=11을 삭제하고 우선순위를 바꾸는 대신 G=6을 **새 항목으로 추가**합니다. 나중에 오래된 항목을 꺼내면 `f != g[u] + h[u]` 검사로 건너뜁니다. 이는 [Red Blob Games의 구현 가이드](https://www.redblobgames.com/pathfinding/a-star/implementation.html)가 소개하는 중복 항목 처리 방식과 같은 아이디어입니다.

이 코드는 **음수가 아닌 비용과 일관적인 h**를 전제하고, 동일 노드를 확장한 뒤 뒤늦게 더 좋은 경로가 생기는 일반 상황 전체를 다루는 생산용 내비게이션 라이브러리는 아닙니다. 실제 게임에서는 반복 탐색의 메모리 재사용, 우선순위 큐의 비용, 장애물 변화, 에이전트 크기 및 경로 추종을 별도로 설계해야 합니다.

## 격자와 엔진에서는 무엇을 바꿔야 할까요?

격자에서는 추정치 h를 이동 규칙에 맞게 만들 수 있습니다. 상하좌우 네 방향으로 한 칸을 비용 1에 움직인다면 **맨해튼 거리(Manhattan Distance)**인 `|dx|+|dy|`가 장애물을 무시한 최저 비용입니다. 대각선도 비용 1에 허용한다면 이 값을 그대로 쓰면 실제 최저 비용을 **과대평가**할 수 있습니다. 그때는 `max(|dx|,|dy|)`처럼 이동 규칙에 맞는 추정이 필요합니다. 대각선 비용이 √2라면 별도 옥타일 거리(Octile Distance) 등이 쓰입니다. [Amit Patel의 격자 길찾기 가이드](https://www.redblobgames.com/pathfinding/a-star/introduction.html)와 [격자 A* 구현 정리](https://github.com/riscy/a_star_on_grids)를 참고할 수 있습니다.

실제 게임 엔진을 사용한다면 이 코드를 무조건 다시 만들 필요는 없습니다. 예를 들어 **Unity 6.0~6000.6 계열 문서**의 `NavMeshAgent.CalculatePath(targetPosition, path)`는 지정한 타깃으로 경로를 계산하며 **동기 호출**입니다. 매우 긴 경로를 여러 개 같은 프레임에서 요청하면 프레임 시간에 영향을 줄 수 있다고 공식 문서가 경고합니다. 반환 `bool`이 참이어도 **부분 경로(Partial Path)**일 수 있으므로 `path.status == NavMeshPathStatus.PathComplete`를 따로 확인해야 합니다. [Unity 6000.6 API](https://docs.unity.com/en-us/engine/6000.6/script-reference/unityengine/ai/navmeshagent/calculatepath), [Unity 6000.0 경로 상태](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/ai/navmeshpathstatus)를 참고했습니다. 이 API가 위 예제와 같은 그래프나 휴리스틱을 내부에서 그대로 사용한다는 주장은 아닙니다.

A*는 **탐색 그래프에서 비용이 낮은 경로**를 고르는 방법입니다. 실제 캐릭터가 경로를 따라 부드럽게 회전하는지, 다른 캐릭터와 충돌하는지, 이동 중 장애물이 바뀌는지는 별개의 구현 문제입니다. 경로 품질을 확인할 때는 목표까지의 선형 거리만 볼 것이 아니라, 반환된 경로의 총비용과 비용을 만든 규칙을 함께 확인해 보세요.

## 오늘 얻어갈 것

**목표에 가까워 보이는 길이 항상 최단 경로는 아닙니다.** 오늘 예제에서 목표 직전 A를 거치는 길은 11, 우회하는 B·C 길은 6이었습니다. A*는 `f=g+h`로 이미 쓴 비용과 남은 비용의 추정을 함께 비교하고, G를 처음 발견했다고 성급히 종료하지 않아 비용 6의 경로를 찾았습니다.

직접 구현한다면 **이동 비용이 음수가 아닌지, h가 실제 최저 잔여 비용을 넘지 않는지, 큐의 오래된 항목을 어떻게 처리하는지, 목표 종료 시점이 올바른지**를 확인하세요. 엔진을 쓴다면 NavMesh의 통과 비용 설정·부분 경로 여부·한 프레임의 경로 계산 횟수를 측정하는 편이 우선입니다. 검색이 오래 걸릴 때도 무조건 h를 키우기보다는, 그래프 크기와 허용할 최적성 손실부터 판단하는 것이 좋습니다.

## 출처

- [Peter E. Hart, Nils J. Nilsson, Bertram Raphael · A Formal Basis for the Heuristic Determination of Minimum Cost Paths](https://doi.org/10.1109/TSSC.1968.300136) — 1968년 7월 31일, IEEE Transactions on Systems Science and Cybernetics 4(2), 100–107.
- [Amit Patel · Introduction to the A* Algorithm](https://www.redblobgames.com/pathfinding/a-star/introduction.html) — 원저자의 상호작용 예제와 알고리즘 설명. 현재 공개 문서 확인: 2026-11-07.
- [Amit Patel · Implementation of A*](https://www.redblobgames.com/pathfinding/a-star/implementation.html) — 우선순위 큐·비용 갱신·중복 항목 설명. 현재 공개 문서 확인: 2026-11-07.
- [riscy · A* on Grids](https://github.com/riscy/a_star_on_grids) — 격자 이동 규칙별 허용적 휴리스틱 정리. 현재 공개 자료 확인: 2026-11-07.
- [Unity · NavMeshAgent.CalculatePath](https://docs.unity.com/en-us/engine/6000.6/script-reference/unityengine/ai/navmeshagent/calculatepath) — Unity Editor 6000.6 API, 동기 계산·부분 경로·성능 주의.
- [Unity · NavMeshPathStatus](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/ai/navmeshpathstatus) — Unity Editor 6000.0 API, Complete·Partial·Invalid 상태.
