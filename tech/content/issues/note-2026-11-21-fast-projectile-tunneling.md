# 빠른 총알은 왜 얇은 벽을 뚫고 지나갈까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 총알은 벽을 지나갔는데 충돌 기록은 없습니다

게임에서 총알이 얇은 벽의 한쪽에서 다른 쪽으로 순간이동한 것처럼 보일 때가 있습니다. 이동 속도는 일정하고 벽의 콜라이더도 정상인데, 충돌 이벤트만 오지 않습니다. **컴퓨터는 총알이 벽을 통과하는 순간을 왜 놓쳤을까요?**

게임 물리는 보통 시간을 잘게 나누어 계산합니다. 이런 방식에서 **이산 충돌 판정(Discrete Collision Detection)**은 각 물리 갱신 시점에 겹침을 확인합니다. 그 사이에 물체가 장애물을 완전히 통과하면 두 시점 모두에서 겹치지 않을 수 있습니다. 이 현상을 **터널링(Tunneling)**이라고 부릅니다.

이를 막기 위한 접근이 **연속 충돌 판정(Continuous Collision Detection, CCD)**입니다. 두 시점의 위치만 비교하지 않고, 그 사이에 물체가 지나간 경로를 검사합니다. Box2D 공식 문서는 이를 처음 충돌하는 시각, **충돌 시점(Time of Impact, TOI)**을 찾는 문제로 설명합니다. [Box2D 충돌 문서](https://box2d.org/documentation/md_collision.html)

## 0.02초 동안 40cm 움직이는 총알

한 축만 있는 단순한 장면을 생각해 보겠습니다. 실제 엔진 측정 결과가 아니라 **계산을 위한 가상 조건**입니다.

- 총알은 반지름 `0.05m`인 원형 충돌체이며 오른쪽으로 `20m/s`로 움직입니다.
- 한 물리 갱신 시간은 `0.02s`(50Hz)입니다.
- 총알 중심의 시작 위치는 `x=0.80m`입니다.
- 움직이지 않는 벽은 `x=0.95m`부터 `x=1.05m`까지입니다.

한 번의 갱신에서 총알은 `20 × 0.02 = 0.40m`를 이동합니다. 다음 위치는 `0.80 + 0.40 = 1.20m`입니다.

시작할 때 총알이 차지하는 범위는 `[0.75, 0.85]m`, 끝날 때는 `[1.15, 1.25]m`입니다. 둘 다 벽 `[0.95, 1.05]m`와 겹치지 않습니다. **시작과 끝만 본다면 충돌이 없다는 잘못된 결론**에 도달하는 예제입니다.

![총알 중심이 0.80m에서 1.20m까지 이동하며 두 시점의 원형 충돌체는 벽과 겹치지 않지만 연속 검사는 중심 0.90m에서 최초 접촉을 찾는 도식](assets/projectile-tunneling.svg)

*직접 제작한 1차원 이동 도식입니다. 위치는 같은 비율의 가로 축으로 표현했습니다. 시작 0.80m, 벽 0.95~1.05m, 종료 1.20m, 반지름 0.05m, 최초 접촉 중심 0.90m를 표시합니다. 실제 3D 물리 엔진의 계산 화면이 아닙니다. 개념 근거: [Box2D Collision](https://box2d.org/documentation/md_collision.html).*

## 첫 충돌은 프레임의 4분의 1 지점입니다

오른쪽으로 이동하는 총알의 앞쪽 끝이 벽의 왼쪽 면에 닿는 순간, 중심의 위치는 `0.95 - 0.05 = 0.90m`입니다. 시작점에서 `0.10m`를 움직인 셈입니다.

$$
t_{\mathrm{hit}} = \frac{0.90 - 0.80}{20} = 0.005\,\mathrm{s}
$$

따라서 충돌은 갱신 시작 **5ms 후** 발생합니다. 20ms짜리 물리 스텝에서의 비율은 `0.005 / 0.020 = 0.25`입니다.

![물리 스텝 0ms부터 20ms까지의 시간선에서 최초 접촉 5ms와 이동 비율 0.25를 표시한 도식](assets/impact-timeline.svg)

*직접 제작한 충돌 시점 계산도입니다. 0ms는 중심 0.80m, 5ms는 중심 0.90m, 20ms는 충돌 처리가 없었다고 가정했을 때의 중심 1.20m입니다. 처음 접촉한 뒤 실제 물리 엔진이 어디까지 움직일지는 반발·정지·충돌 응답에 따라 달라집니다.*

여기서 **쓸기 검사(Sweep Test)**는 충돌체의 모양을 이동 방향으로 쓸며, 지나간 구간에서 첫 충돌을 찾는 방법입니다. 반지름이 0인 점의 이동을 검사하는 레이캐스트(Raycast)와 달리, 반지름을 유지한 채 이동 경로를 검사할 수 있습니다.

위 계산은 고정된 벽과 오른쪽으로만 움직이는 원형 물체라는 제한된 상황의 정확한 해입니다. 임의의 3차원 회전 물체나 움직이는 상대까지 이 식 하나로 해결할 수는 없습니다. Box2D 문서는 회전이 큰 일부 경우 TOI가 충돌을 놓칠 수 있다고 명시합니다. [Box2D Collision](https://box2d.org/documentation/md_collision.html)

## C++17로 시작·종료 검사와 최초 접촉을 비교해 보겠습니다

다음은 **엔진과 무관한 실제 실행 코드**입니다. 평행한 벽의 1차원 구간과 오른쪽으로 움직이는 원형 충돌체만 처리합니다. 일반적인 CCD 충돌 알고리즘의 구현이라고 생각해서는 안 됩니다.

```cpp
#include <cassert>
#include <cmath>
#include <iostream>

int main() {
    constexpr double startX = 0.80;
    constexpr double speed = 20.0;
    constexpr double step = 0.020;
    constexpr double radius = 0.05;
    constexpr double wallLeft = 0.95;
    constexpr double wallRight = 1.05;

    const double endX = startX + speed * step;

    auto overlapsWall = [&](double centerX) {
        return centerX + radius >= wallLeft &&
               centerX - radius <= wallRight;
    };

    const bool discreteHit =
        overlapsWall(startX) || overlapsWall(endX);

    // 오른쪽 이동, 시작점이 벽 밖에 있다는 가정
    const double firstContactX = wallLeft - radius;
    const double hitTime = (firstContactX - startX) / speed;
    const bool sweptHit =
        hitTime >= 0.0 && hitTime <= step;
    const double fraction = hitTime / step;

    assert(!discreteHit);
    assert(sweptHit);
    assert(std::abs(hitTime - 0.005) < 1e-9);
    assert(std::abs(fraction - 0.25) < 1e-9);

    std::cout << "discrete=" << discreteHit
              << ", sweep=" << sweptHit
              << ", t=" << hitTime << "s"
              << ", fraction=" << fraction << '\n';
}
```

결과는 `discrete=0, sweep=1, t=0.005s, fraction=0.25`입니다. 코드에서 `discreteHit`가 거짓이라고 해서 물리 엔진의 모든 이산 충돌 처리가 언제나 이렇다는 뜻은 아닙니다. 예제는 **시작·종료 시점의 겹침만 확인하는 방식**을 모델링합니다.

실제 충돌 응답은 TOI에서 속도와 접촉 법선을 이용해 미끄러짐, 반발, 정지 등을 결정해야 합니다. 또 총알이 이미 벽 안에서 시작했거나 벽도 움직인다면 별도 초기 겹침 검사·상대 운동 계산이 필요합니다.

## Unity와 Box2D에서는 무엇을 선택할까요?

**Unity 6.0(6000.0) 공식 문서 기준**, Rigidbody의 Collision Detection에는 `Discrete`, `Continuous Speculative`, `Continuous`, `Continuous Dynamic` 모드가 있습니다. Unity는 일반 물체에는 `Discrete`부터 사용하고, 빠른 이동에서 누락이 관찰되면 `Continuous Speculative`를 먼저 시험한 뒤 필요할 때 sweep 계열 모드를 선택하도록 안내합니다. 모든 Rigidbody를 무조건 가장 비싼 모드로 바꾸는 것은 권장되지 않습니다. [Unity 6 충돌 모드 안내](https://docs.unity3d.com/ja/6000.0/Manual/choose-collision-detection-mode.html) · [Unity 6 성능 안내](https://docs.unity3d.com/ja/6000.0/Manual/physics-optimization-cpu-rigidbody-collision-modes.html)

별도로 **직접 움직이는 투사체**라면 구간을 따라 `Physics.SphereCast`를 호출하는 선택도 있습니다. 아래는 Unity 6.0의 공개 API를 사용한 **간소화된 실제 C# 코드**입니다. Rigidbody로 물리 이동을 하는 물체에 중복 적용하기보다, 스크립트가 이동을 직접 담당하는 구형 투사체의 기본 흐름을 보여줍니다.

```csharp
using UnityEngine;

public sealed class SimpleProjectile : MonoBehaviour
{
    [SerializeField] private float speed = 20f;
    [SerializeField] private float radius = 0.05f;
    [SerializeField] private LayerMask blockers;

    private void FixedUpdate()
    {
        Vector3 direction = transform.forward;
        float distance = speed * Time.fixedDeltaTime;

        if (Physics.SphereCast(
            transform.position, radius, direction,
            out RaycastHit hit, distance, blockers,
            QueryTriggerInteraction.Ignore))
        {
            transform.position += direction * hit.distance;
            enabled = false; // 실제 게임에서는 충돌 처리 후 제거·풀 반환
            return;
        }

        transform.position += direction * distance;
    }
}
```

`SphereCast`는 구의 중심, 반지름, 방향, 최대 검사 거리를 받습니다. 이 예제에는 충돌 효과·대미지·풀 반환·시작 시 겹침 검사·빠르게 움직이는 대상의 상대 운동 처리가 없습니다. **초기부터 겹쳐 있는 콜라이더는 SphereCast가 놓칠 수 있으므로** 생성 위치를 검증해야 합니다. [Unity 6 PhysicsScene.SphereCast API](https://docs.unity3d.com/cn/current/ScriptReference/PhysicsScene.SphereCast.html)

**Box2D 3.x 공식 문서**에서는 물리 스텝이 이산적으로 진행되더라도 TOI 계산과 예측 충돌(Speculative Collision)을 함께 사용해 터널링을 줄인다고 설명합니다. 다만 Box2D 개발자는 정확한 투사체 명중 시점이 중요한 경우 `bullet` 설정에만 의존하지 말고 ray cast나 shape cast 같은 명시적 쿼리를 고려하라고 안내합니다. [Box2D Overview](https://box2d.org/documentation/) · [Box2D Body 문서](https://box2d.org/documentation/group__body.html)

선택의 핵심은 **정확성·비용·게임플레이 요구사항**입니다. 물리적인 공이나 핀볼은 엔진 CCD가 유리할 수 있고, 발사부터 명중까지의 첫 접촉만 중요한 총알은 명시적인 cast가 더 단순할 수 있습니다. 반대로 레이 하나만 사용하면 반지름이 있는 투사체의 모서리 충돌을 놓칠 수 있습니다.

## 오늘 얻어갈 것

**벽을 뚫는 총알은 벽이 없어서가 아니라, 물리 갱신 사이의 경로를 보지 못해서 통과할 수 있습니다.** 오늘의 수치 예제에서 총알은 20ms 동안 0.80m에서 1.20m로 이동하지만, 첫 접촉은 5ms 시점인 중심 0.90m에서 발생합니다.

먼저 디버그 화면에 **이전 위치, 다음 위치, 충돌체 반지름, 실제 검사 구간**을 함께 표시해 보세요. Unity에서는 Rigidbody의 `collisionDetectionMode`와 Fixed Timestep을 확인하고, 직접 움직이는 투사체는 `SphereCast` 및 시작점 겹침 처리 여부를 점검합니다. 그 뒤 Profiler에서 물리 CPU 비용과 누락된 명중 사례를 함께 측정해 자신에게 맞는 충돌 판정 방식을 고르는 것이 좋습니다.

## 출처

- [Box2D — Collision / Time of impact](https://box2d.org/documentation/md_collision.html), Box2D 공식 문서, 2026-11-21 확인. 터널링, 쓸기 검사, TOI 한계 근거.
- [Box2D — Overview](https://box2d.org/documentation/), Box2D 3.x 공식 문서, 2026-11-21 확인. 이산 스텝과 연속 충돌의 관계.
- [Box2D — Body](https://box2d.org/documentation/group__body.html), Box2D 공식 API 문서, 2026-11-21 확인. 정확한 투사체 처리 시 cast 권고.
- [Unity — Choose a collision detection mode](https://docs.unity3d.com/ja/6000.0/Manual/choose-collision-detection-mode.html), Unity 6.0(6000.0) 공식 문서, 2026-11-21 확인.
- [Unity — Optimize Rigidbody collision detection modes](https://docs.unity3d.com/ja/6000.0/Manual/physics-optimization-cpu-rigidbody-collision-modes.html), Unity 6.0(6000.0) 공식 문서, 2026-11-21 확인.
- [Unity — PhysicsScene.SphereCast](https://docs.unity3d.com/cn/current/ScriptReference/PhysicsScene.SphereCast.html), Unity 6.0 API 문서, 2026-11-21 확인.
