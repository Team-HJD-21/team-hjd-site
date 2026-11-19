# 적이 목표에 도착했는데 왜 다시 뒤로 돌아갈까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 목표 좌표를 알고도 멈추지 못하는 적

플레이어에게 다가오는 적을 구현했다고 해 보겠습니다. 적은 매 프레임 목표의 방향을 계산해 최고 속도로 달립니다. 그런데 목표를 지나친 다음에는 방향이 반대로 바뀌고, 다시 지나치기를 반복합니다. 좌표 계산은 맞는데 왜 도착하지 못할까요?

**탐색(Pathfinding)**은 어디로 가야 할지 경로를 정합니다. 반면 **조향 행동(Steering Behavior)**은 지금 어떤 속도와 방향으로 움직일지를 정합니다. Craig Reynolds가 **1999년 GDC**에서 발표한 [Steering Behaviors For Autonomous Characters](https://www.red3d.com/cwr/steer/gdc99/)는 이 둘을 구분하고, 목표를 향해 움직이는 *Seek*와 가까워질수록 감속하는 **도착 조향(Arrival Steering)**을 설명합니다.

Seek는 목표를 향한 **희망 속도(Desired Velocity)**를 최대 속도로 유지합니다. 목표를 지나쳤더라도 속도가 바로 0이 되지는 않습니다. 물체가 한 번에 방향을 바꿀 수 없다면 반복해서 지나치는 현상이 생길 수 있습니다. Arrival은 목표에 가까울수록 희망 속도 자체를 줄여 이 문제를 완화합니다.

## 감속 구간에서 희망 속도를 줄입니다

Arrival에서 먼저 정할 값은 **감속 거리(Slowing Distance)**입니다. 목표까지의 거리가 이 값보다 크면 최고 속도를 원하고, 안쪽에 들어오면 거리에 비례해 희망 속도를 줄입니다.

아래는 1999년 Reynolds의 Arrival 수식을 2차원 이동에 맞게 정리한 것입니다. 현재 위치를 `p`, 목표를 `t`, 현재 속도를 `v`라고 하겠습니다.

```text
offset       = t - p
distance     = length(offset)
desiredSpeed = maxSpeed * min(distance / slowingDistance, 1)
desired      = (offset / distance) * desiredSpeed  // distance > 0
steering     = desired - v
```

**조향 벡터(Steering Vector)**인 `desired - v`는 현재 속도와 원하는 속도의 차이입니다. 이것을 즉시 속도로 대입하는지, 가속도 제한을 거쳐 반영하는지에 따라 실제 움직임은 달라집니다. `distance = 0`에서는 방향 벡터의 나눗셈을 하지 않고 희망 속도를 0으로 처리해야 합니다.

![목표까지 거리가 0에서 8미터까지 늘면 희망 속도가 0에서 초당 4미터까지 선형 증가하고 이후 4로 유지되는 그래프](assets/arrival-speed-curve.svg)

*직접 제작한 개념도입니다. 최대 속도 4m/s, 감속 거리 8m를 가정한 희망 속도 함수이며, 실제 캐릭터의 측정 속도 곡선이 아닙니다. 근거: [Reynolds, GDC 1999 — Arrival](https://www.red3d.com/cwr/steer/gdc99/).*

## 0.1초 뒤 위치를 직접 계산해 보겠습니다

직선상에서 적이 **x=6m**, 목표가 **x=10m**라고 가정하겠습니다. 현재 속도는 목표 방향으로 **4m/s**, 최대 속도도 **4m/s**, 감속 거리는 **8m**입니다.

목표까지 거리는 4m입니다. 그래서 희망 속도는 `4 × (4 / 8) = 2m/s`입니다. 하지만 현재 속도는 4m/s이므로 희망 속도와의 차이는 **-2m/s**입니다. 이 차이를 한 프레임에 전부 반영하면 제한된 가속도를 가진 적의 움직임과 맞지 않을 수 있습니다.

이번 예제에서는 속도 오차를 **0.5초의 응답 시간(Response Time)**에 걸쳐 줄이려는 제어를 사용하겠습니다. 이는 원저자의 기본 Arrival 식 뒤에 덧붙인 **예제용 구현 선택**입니다. 계산한 가속도는 `(2 - 4) / 0.5 = -4m/s²`이고, 허용 감속 크기를 **3m/s²**로 제한하면 실제 적용 가속도는 **-3m/s²**입니다.

고정 시간 간격 `dt = 0.1s`에서 다음 속도는 `4 + (-3 × 0.1) = 3.7m/s`입니다. 갱신한 속도로 위치를 적분하면 `6 + 3.7 × 0.1 = 6.37m`가 됩니다. 목표를 향해 움직이면서도 속도는 이미 줄어들기 시작했습니다.

![현재 위치 6미터에서 가속도 제한을 적용한 뒤 0.1초 후 6.37미터로 움직이는 1차원 이동 계산도](assets/arrival-step.svg)

*직접 제작한 수치 도식입니다. 6.37m는 반암시적 오일러 방식으로 계산한 이 예제의 한 단계 결과입니다. 화살표는 이동·감속 방향을 나타내며, 속도·가속도의 화살표 길이는 크기에 비례하지 않습니다.*

여기서 **희망 속도 2m/s와 실제 다음 속도 3.7m/s가 다른 것**이 중요합니다. 조향을 결정하는 계층과 실제 속도를 바꾸는 계층이 분리되어 있기 때문입니다. Reynolds의 [Arrival 시연 해설](https://www.red3d.com/cwr/steer/Arrival.html)도 유한한 가속 능력 때문에 희망 속도와 실제 속도에 차이가 생긴다고 설명합니다.

## C++17로 한 번의 이동 단계를 구현합니다

다음은 외부 엔진에 의존하지 않는 **실행 가능한 C++17 코드**입니다. 2D 벡터로 작성했지만 x축에만 값을 주어 위 계산을 그대로 재현합니다. `Limit`는 벡터 길이가 상한을 넘으면 같은 방향을 유지한 채 길이만 줄입니다.

```cpp
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>

struct Vec2 {
    double x, y;
};

Vec2 operator+(Vec2 a, Vec2 b) { return {a.x + b.x, a.y + b.y}; }
Vec2 operator-(Vec2 a, Vec2 b) { return {a.x - b.x, a.y - b.y}; }
Vec2 operator*(Vec2 a, double s) { return {a.x * s, a.y * s}; }
double Length(Vec2 a) { return std::hypot(a.x, a.y); }

Vec2 Limit(Vec2 v, double maxLength) {
    double length = Length(v);
    return length > maxLength && length > 0.0
        ? v * (maxLength / length)
        : v;
}

struct Agent {
    Vec2 position;
    Vec2 velocity;
};

void StepArrival(Agent& agent, Vec2 target, double dt) {
    constexpr double maxSpeed = 4.0;       // m/s
    constexpr double slowingDistance = 8.0; // m
    constexpr double responseTime = 0.5;   // s
    constexpr double maxAcceleration = 3.0; // m/s^2

    if (dt <= 0.0) return;

    Vec2 offset = target - agent.position;
    double distance = Length(offset);

    // 충분히 가까우면서 거의 멈춘 상태에서만 도착 확정
    if (distance < 0.05 && Length(agent.velocity) < 0.1) {
        agent.position = target;
        agent.velocity = {0.0, 0.0};
        return;
    }

    double desiredSpeed = maxSpeed *
        std::min(distance / slowingDistance, 1.0);
    Vec2 desired = distance > 1e-9
        ? offset * (desiredSpeed / distance)
        : Vec2{0.0, 0.0};

    Vec2 acceleration =
        Limit((desired - agent.velocity) * (1.0 / responseTime),
              maxAcceleration);

    agent.velocity = Limit(agent.velocity + acceleration * dt,
                           maxSpeed);
    agent.position = agent.position + agent.velocity * dt;
}

int main() {
    Agent enemy{{6.0, 0.0}, {4.0, 0.0}};
    StepArrival(enemy, {10.0, 0.0}, 0.1);

    std::cout << std::fixed << std::setprecision(2)
              << "position=" << enemy.position.x
              << ", velocity=" << enemy.velocity.x << '\n';
    // position=6.37, velocity=3.70
}
```

여기서 위치 갱신은 먼저 계산한 새 속도를 사용합니다. 이는 **반암시적 오일러(Semi-implicit Euler)** 형태로, 해당 한 단계의 수치를 재현하기 위한 선택입니다. Unity라면 자체 좌표를 갱신하는 대신 프로젝트의 실제 이동 주체(`Rigidbody`, `CharacterController`, 네비게이션 에이전트 등)와 **이중으로 이동시키지 않도록** 해야 합니다. 코드는 Unity API가 아니라 일반 C++ 구현입니다.

## 감속 거리만 늘리면 해결될까요?

그렇지는 않습니다. 감속 거리가 너무 짧으면 감속할 시간이 부족해 목표를 지나칠 수 있고, 너무 길면 멀리서부터 느려져 답답한 움직임이 됩니다. **최대 가속도**, 기존 속도, 이동 시간 간격, 도착 판정 반경을 함께 조정해야 합니다.

일직선에서 속도가 4m/s이고 최대 감속이 3m/s²인 경우, 감속을 일정하게 최대로 걸 때의 이상적인 정지 거리는 `v²/(2a) = 16/6 ≈ 2.67m`입니다. 이 값은 정지 거리의 감을 잡기 위한 별도의 역학 계산이며, **Arrival이 자동으로 정확히 그 위치에서 멈춘다는 뜻은 아닙니다.** 실제 게임에는 방향 전환, 충돌, 목표 이동, 이산 시간 적분이 더해집니다.

도착 판정은 보통 **거리와 남은 속도를 함께 확인**하는 편이 안전합니다. 위치만 가까워졌다고 바로 정지시키면 빠르게 통과 중인 적이 순간적으로 붙잡힐 수 있습니다. 측정할 때는 목표까지의 거리, 실제 속도, 희망 속도, 적용 가속도, 한 스텝에서 목표를 통과한 횟수를 기록하세요. 지나침이 반복된다면 감속 거리뿐 아니라 `maxAcceleration`, `responseTime`, `dt`부터 비교할 수 있습니다.

A* 같은 경로 탐색이 *어떤 경로로 갈지*를 결정했다면, Arrival은 그 경로의 끝에서 *어떻게 느려질지*를 결정합니다. 이것이 두 기술을 연결할 때의 역할 구분입니다. 움직이는 목표, 다수의 적 간 회피, 애니메이션 루트 모션까지 다루려면 그 위에 별도 조정이 필요합니다.

## 오늘 얻어갈 것

**적이 목표를 자꾸 지나치는 이유는 목표 좌표가 틀려서가 아니라, 현재 속도를 가진 적에게 도착 전 감속 목표와 가속도 제약을 제대로 적용하지 않았기 때문일 수 있습니다.** Seek의 최고 속도 지향을 Arrival의 거리별 희망 속도로 바꾸면 가까워질수록 감속하도록 설계할 수 있습니다.

오늘의 예제에서는 x=6m, 현재 4m/s인 적이 목표 x=10m를 향해 이동할 때, 감속 구간의 희망 속도는 2m/s이고 실제 첫 스텝은 속도 3.7m/s, 위치 6.37m였습니다. 코드에서는 `desired - velocity`를 만든 뒤 가속도를 제한하는 부분을 확인하고, 엔진에서는 **거리·실제 속도·희망 속도**를 함께 시각화해 지나침과 감속 시점을 비교해 보세요.

## 출처

- [Craig W. Reynolds — Steering Behaviors For Autonomous Characters](https://www.red3d.com/cwr/steer/gdc99/), GDC 1999 원저자 발표 자료. Arrival·Seek·기본 이동 모델의 1차 근거. 2026-11-19 확인.
- [Craig W. Reynolds — Arrival steering behavior](https://www.red3d.com/cwr/steer/Arrival.html), 원저자 시연 설명. 희망 속도의 선형 감속과 제한된 기동성 해설. 2026-11-19 확인.
