# 충돌체 1,000개면 정말 499,500쌍을 검사해야 할까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 전부 비교하면 어떤 일이 생길까요?

2D 액션 게임에서 적과 투사체, 장애물의 충돌을 확인한다고 해 보겠습니다. 충돌체가 1,000개라면 서로 다른 두 개를 고르는 조합은 `1000 × 999 ÷ 2 = 499,500`쌍입니다. **이 모든 쌍에 매번 정밀 충돌 검사를 해야 할까요?**

그럴 필요는 없습니다. 서로 너무 멀리 떨어진 객체는 애초에 충돌할 수 없으니까요. 충돌 검사에서 **광역 단계(Broad Phase)**는 접촉할 *가능성이 있는 쌍*을 빠르게 골라냅니다. 이후 **정밀 단계(Narrow Phase)**가 실제 모양을 바탕으로 충돌 여부와 접촉 정보를 계산합니다. [NVIDIA의 *GPU Gems 3* 제32장(2007)](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda)은 바로 이 두 단계를 구분합니다.

중요한 구별이 하나 있습니다. 광역 단계가 고른 쌍은 **충돌이 확정된 쌍이 아닙니다.** 빠른 판정이므로 실제로 닿지 않는 쌍도 남길 수 있습니다. 반대로, 실제로 닿는 쌍을 잘못 버리면 충돌이 누락됩니다.

## 다섯 상자에 격자를 씌워 보겠습니다

먼저 게임 화면의 평면을 한 변 1인 정사각형 **셀(Cell)**로 나눕니다. 물체의 대략적인 위치는 **축 정렬 경계 상자(Axis-Aligned Bounding Box, AABB)**로 표현하겠습니다. AABB는 좌표축에 평행한 최소·최대 좌표를 저장하는 직사각형입니다. 회전한 캐릭터의 정확한 외형이 아니라, 빠른 후보 선별에 쓰는 범위라고 생각하세요.

다섯 AABB는 모두 `y=[0.2,0.8)`에 있습니다. 아래 표와 그림은 x 구간만 펼쳐 보여줍니다. 구간은 **최솟값 포함, 최댓값 제외**인 반열린 구간으로 정의합니다.

| 상자 | x 구간 | 점유하는 x 셀 |
| --- | --- | --- |
| A | [0.2, 1.2) | 0, 1 |
| B | [0.8, 1.4) | 0, 1 |
| C | [1.5, 1.8) | 1 |
| D | [3.1, 3.8) | 3 |
| E | [3.7, 4.3) | 3, 4 |

![x축의 셀 0에서 4에 A부터 E까지 다섯 AABB가 걸친 구간을 보이는 도식](assets/broadphase-grid.svg)

*그림 1 · 직접 제작한 2D AABB의 x축 투영도입니다. 모든 상자의 y 범위는 같으며, 서로 가리는 것을 피하려고 줄을 나눠 그렸습니다. 격자 분할 개념은 [GPU Gems 3 제32장](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda)을 참고했습니다.*

여기서는 객체의 **중심 셀 하나에만** 등록하지 않고, AABB가 걸치는 **모든 셀**에 등록합니다. 그다음 같은 셀에 있는 객체끼리만 후보 쌍으로 만듭니다. 이 방법은 셀 크기가 작은 경우에도 경계 너머의 충돌을 놓치지 않습니다. 예를 들어 A와 B는 셀 0과 1에 모두 들어갑니다. 정확히 겹치는 x 구간은 `[0.8,1.2)`입니다.

NVIDIA 문헌도 공간 분할(Spatial Subdivision)의 두 전략을 구분합니다. 하나는 중심이 속한 셀과 **이웃 셀**을 함께 확인하는 방식이고, 다른 하나는 경계 상자가 겹치는 **모든 셀**에 객체를 등록하는 방식입니다. 오늘 예제는 두 번째 방식입니다. [원문 32.1.2절](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda)을 참고해 주세요.

## 후보는 열 쌍에서 네 쌍으로 줄었습니다

셀 0에는 A·B가 있고, 셀 1에는 A·B·C가 있습니다. 셀 2는 비어 있고, 셀 3에는 D·E, 셀 4에는 E만 있습니다. 셀마다 두 개씩 고르면 후보 쌍은 이렇게 나옵니다.

```text
셀 0 → AB
셀 1 → AB, AC, BC
셀 2 → 없음
셀 3 → DE
셀 4 → 없음
```

원래 전체 조합은 `5×4÷2=10`쌍입니다. 이제 셀별 방문은 **5회**입니다. 하지만 AB는 두 셀에서 중복으로 나옵니다. 객체 ID를 기준으로 중복을 제거하면 고유 후보는 **AB·AC·BC·DE의 4쌍**입니다.

이 네 쌍에 AABB의 x·y 범위가 실제로 겹치는지 확인하면 AC와 BC는 제외됩니다. 따라서 **AABB가 겹치는 쌍은 AB와 DE, 총 2쌍**입니다. 이 결과는 박스들의 좌표로 계산한 값이지, 특정 엔진에서 측정한 성능 수치가 아닙니다.

![전체 조합 10쌍이 셀 내부 방문 5회, 중복 제거 후 4쌍, AABB 겹침 2쌍으로 좁혀지는 도식](assets/broadphase-funnel.svg)

*그림 2 · 위 표의 구간으로 직접 계산한 후보 집계입니다. AB는 두 셀에서 생성되므로 한 번만 남깁니다. 최종 2쌍은 AABB 수준에서 겹치는 후보이며 실제 캐릭터 표면의 접촉을 뜻하지는 않습니다. 구조 참고: [GPU Gems 3 제32장](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda).*

## C++17로 실제 후보를 만들어 보겠습니다

아래는 **표준 C++17 실행 코드**입니다. 엔진 API를 호출하는 예제가 아니라, 교육용 격자 인덱스를 `std::map`과 `std::set`으로 구현한 것입니다. 셀 크기는 1이고, 경계 좌표가 정수일 때 반열린 구간 규칙을 지키려고 `std::nextafter`로 최댓값 바로 아래 부동소수점 값을 구합니다.

```cpp
#include <algorithm>
#include <cmath>
#include <iostream>
#include <limits>
#include <map>
#include <set>
#include <utility>
#include <vector>

struct Box {
    char name;
    float minX, minY, maxX, maxY;
};

bool overlaps(const Box& a, const Box& b) {
    return a.minX < b.maxX && b.minX < a.maxX &&
           a.minY < b.maxY && b.minY < a.maxY;
}

int main() {
    const std::vector<Box> boxes = {
        {'A', 0.2f, 0.2f, 1.2f, 0.8f},
        {'B', 0.8f, 0.2f, 1.4f, 0.8f},
        {'C', 1.5f, 0.2f, 1.8f, 0.8f},
        {'D', 3.1f, 0.2f, 3.8f, 0.8f},
        {'E', 3.7f, 0.2f, 4.3f, 0.8f}
    };

    using Cell = std::pair<int, int>;
    using Pair = std::pair<int, int>;
    std::map<Cell, std::vector<int>> cells;

    for (int id = 0; id < static_cast<int>(boxes.size()); ++id) {
        const Box& b = boxes[id];
        const auto lastCell = [](float maxValue) {
            return static_cast<int>(std::floor(
                std::nextafter(maxValue,
                    -std::numeric_limits<float>::infinity())));
        };
        for (int x = static_cast<int>(std::floor(b.minX));
             x <= lastCell(b.maxX); ++x) {
            for (int y = static_cast<int>(std::floor(b.minY));
                 y <= lastCell(b.maxY); ++y) {
                cells[{x, y}].push_back(id);
            }
        }
    }

    int pairVisits = 0;
    std::set<Pair> candidates;
    for (const auto& entry : cells) {
        const auto& ids = entry.second;
        for (std::size_t i = 0; i < ids.size(); ++i) {
            for (std::size_t j = i + 1; j < ids.size(); ++j) {
                ++pairVisits;
                candidates.insert({ids[i], ids[j]});
            }
        }
    }

    int aabbOverlaps = 0;
    for (auto [i, j] : candidates) {
        if (overlaps(boxes[i], boxes[j])) {
            ++aabbOverlaps;
            std::cout << boxes[i].name << boxes[j].name << " ";
        }
    }
    std::cout << "\nall=" << boxes.size() * (boxes.size()-1) / 2
              << ", visits=" << pairVisits
              << ", unique=" << candidates.size()
              << ", overlap=" << aabbOverlaps << "\n";
}
```

```text
AB DE
all=10, visits=5, unique=4, overlap=2
```

`std::set`에는 객체 ID가 오름차순으로 들어가는 쌍만 보관합니다. 덕분에 셀마다 여러 번 발견한 AB를 한 번만 검사합니다. 실제 생산용 시스템에서는 매 프레임 `std::map`과 `std::set`을 새로 할당하는 비용이 부담이 될 수 있으므로, 고정 버퍼나 해시 기반 공간 인덱스 등 다른 자료구조가 더 나을 수 있습니다.

## 그런데 왜 물리 엔진은 격자만 사용하지 않을까요?

격자는 균일한 크기의 객체가 공간에 퍼져 있다면 이해하기 쉽고 유용하지만, **셀의 크기**를 잘못 고르면 손해가 커집니다. 너무 작은 셀은 큰 객체를 수많은 칸에 등록하고, 너무 큰 셀은 관계없는 객체를 한 칸에 몰아넣습니다. 모든 객체가 한 셀에 들어가면 후보가 다시 `n(n-1)/2`개가 될 수도 있습니다. 움직이는 객체의 셀 등록을 고치는 비용도 매번 발생합니다.

현실의 물리 엔진은 다른 인덱스를 선택할 수 있습니다. 예를 들어 **Box2D 3.2.0**의 공개 문서는 경계 상자를 계층적으로 묶는 **동적 AABB 트리(Dynamic AABB Tree)**를 소개합니다. 트리의 노드는 여러 객체의 경계 영역을 묶고, 질의 영역과 겹치지 않는 하위 트리는 한꺼번에 건너뜁니다. `b2DynamicTree_OverlapAABB`는 영역과 겹치는 프록시를 조회하는 실제 API입니다. **이 API는 우리가 위에서 작성한 격자 코드와 같지 않습니다.** [Box2D Dynamic Tree 공식 API](https://box2d.org/documentation/group__tree.html)와 [충돌 문서](https://box2d.org/documentation/md_collision.html)를 참고하세요.

Box2D 문서는 트리를 물리 시뮬레이션 외의 공간 질의에도 활용할 수 있다고 설명합니다. 다만 후보 프록시가 나왔다고 곧바로 접촉했다고 판단해서는 안 됩니다. 실제 다각형·원·캡슐 등 형상의 충돌 판정과 접촉점 계산은 별도 단계입니다. [Box2D 3.2.0 Collision](https://box2d.org/documentation/md_collision.html).

게임에서 선택 기준은 분명합니다. 고정된 작은 투사체가 넓게 흩어져 있다면 셀 기반 방법을 시험해 볼 수 있고, 크기가 다양한 장애물과 움직이는 오브젝트가 섞여 있다면 트리 기반 인덱스를 비교할 가치가 있습니다. 어느 쪽이 빠른지는 **게임의 공간 분포와 이동 패턴에서 직접 재야** 합니다.

## 오늘 얻어갈 것

**충돌체가 1,000개라고 해서 499,500쌍을 매번 정밀 검사할 필요는 없습니다.** 광역 단계는 먼저 위치와 AABB 같은 값싼 정보로 가능성이 없는 쌍을 버립니다. 오늘 예제에서는 5개 객체의 전체 10쌍에서 고유 후보 4쌍, AABB가 겹치는 2쌍으로 줄였습니다. 하지만 이것만으로 실제 충돌이 확정되거나 프레임 시간이 특정 비율만큼 빨라지는 것은 아닙니다.

직접 구현한다면 **격자 경계를 걸친 객체를 놓치지 않는지, 여러 셀에서 중복 생성한 쌍을 제거하는지, 셀 크기와 이동에 따른 인덱스 갱신 비용을 감당할 수 있는지**를 먼저 확인하세요. 엔진에서는 광역 단계의 후보 수와 정밀 충돌 검사 횟수, 인덱스 갱신 시간, 물리 전체 프레임 시간을 각각 측정하면 좋습니다. 후보 수만 작아져도 자료구조 관리 비용이 커지면 총시간은 오히려 늘 수 있습니다.

## 출처

- [Scott Le Grand · Broad-Phase Collision Detection with CUDA, GPU Gems 3, Chapter 32](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda) — NVIDIA, 2007년. 광역·정밀 단계, 전수 검사 비용, 공간 분할의 원리.
- [Erin Catto · Box2D 3.2.0 Collision](https://box2d.org/documentation/md_collision.html) — 공식 문서, 확인일 2026-11-11. 경계 상자·형상 검사와 동적 트리.
- [Box2D 3.2.0 · Dynamic Tree API](https://box2d.org/documentation/group__tree.html) — 공식 API 문서, 확인일 2026-11-11. `b2DynamicTree_OverlapAABB`와 프록시 질의.
