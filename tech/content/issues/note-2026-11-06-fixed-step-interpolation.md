# 물리는 50번 움직이는데 화면은 60번 그리면 왜 떨릴까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 60FPS로 그리는데 공이 한 칸씩 움직입니다

초당 60프레임으로 카메라를 따라가는 공을 보는데, 공은 가끔 멈췄다가 한 번에 앞으로 튀는 것처럼 보입니다. FPS 수치만 보면 충분히 높습니다. 왜 이런 일이 생길까요? 오늘은 **화면을 그리는 시각과 물리를 계산하는 시각이 서로 다르기 때문**이라는 가설을 숫자로 검증해 보겠습니다.

게임은 보통 **고정 시간 단계(Fixed Timestep)**로 물리를 계산합니다. 예를 들어 Unity의 `Time.fixedDeltaTime`이 `0.02`초라면 물리 쪽 목표 시뮬레이션 간격은 **20ms, 초당 50회**입니다. 그런데 화면을 그리는 간격은 모니터와 실행 부하에 따라 달라집니다. Unity 6.0의 고정 업데이트 설명에 따르면 빠른 렌더 프레임에는 물리 갱신이 아예 없을 수 있고, 느린 프레임에는 한 번 이상 실행될 수 있습니다. 이는 각 프레임에 `FixedUpdate`가 반드시 한 번씩 대응하는 구조가 아니라는 뜻입니다. [Unity 고정 업데이트 문서](https://docs.unity3d.com/kr/current/Manual/fixed-updates.html)를 참고했습니다.

![물리는 20ms 간격으로 갱신되고 50ms 렌더 순간에는 앞선 두 물리 상태를 이용해 30ms의 표시 위치를 만드는 시간선](assets/fixed-render-timeline.svg)

*그림 1 · 직접 제작한 시간선입니다. 고정 간격 20ms, 예시 렌더 시각 50ms, 보간 표시 시각 30ms를 구분했습니다. 실제 엔진의 내부 호출 타임스탬프를 측정한 그림이 아닙니다. 근거: [Unity 고정 업데이트](https://docs.unity3d.com/kr/current/Manual/fixed-updates.html), [Unity Rigidbody 보간](https://docs.unity3d.com/kr/2022.3/Manual/rigidbody-interpolation.html).*

## 50ms 순간에 어떤 위치를 그려야 할까요?

조건을 단순하게 잡겠습니다. 공이 x축을 따라 **초속 2m**로 움직이고, 물리 스텝은 20ms입니다. 충돌과 가속은 없다고 가정합니다. 물리 갱신 시점에 계산된 위치는 다음과 같습니다.

| 시뮬레이션 시각 | 공의 x 위치 |

| --- | ---: |

| 0ms | 0.000m |

| 20ms | 0.040m |

| 40ms | 0.080m |

| 60ms | 0.120m |

화면을 **50ms**에 그린다고 하겠습니다. 이 순간 완료된 물리 상태 중 가장 최신은 40ms의 **0.080m**입니다. 보간 없이 최신 물리 위치만 그리면, 다음 물리 스텝이 완료되기 전까지 같은 0.080m가 여러 렌더 프레임에 반복될 수 있습니다. 이것이 눈에 보이는 계단식 움직임의 한 원인입니다. 다만 실제 지터의 원인이 언제나 보간 부족인 것은 아닙니다.

## 미래를 계산하지 않고 중간을 그리는 방법

**보간(Interpolation)**은 *이미 알고 있는 두 시점 사이*의 값을 구하는 방법입니다. 50ms에 렌더할 때, 알고 있는 20ms와 40ms의 두 위치를 쓰되 표시 시각을 한 물리 스텝 늦춘 **30ms**로 놓아 보겠습니다. 그러면 두 위치의 딱 중간을 그릴 수 있습니다.

```text

물리 간격 dt = 20ms

최근에 완료된 물리 시각 = 40ms

렌더 시각 = 50ms

보간 비율 alpha = (50 - 40) / 20 = 0.5

표시 위치 = 0.040 + (0.080 - 0.040) × 0.5 = 0.060m

```

즉 **50ms에 보이는 공은 0.060m**에 있습니다. 이를 일반화하면 `renderPosition = previous + (current - previous) * alpha`이며 `0 ≤ alpha < 1`인 구간에서 생각할 수 있습니다. 이것은 한 물리 스텝만큼 뒤로 민 화면 표시 시간을 기준으로 한 **설명용 모델**입니다. Unity의 내부 보간 구현 코드를 그대로 옮겼다는 뜻은 아닙니다.

초속 2m가 계속 유지됐다면 50ms의 실제 운동 경로상 위치는 **0.100m**였을 것입니다. 0.060m가 실제 순간 위치에 더 가깝다는 이야기가 아닙니다. **알고 있는 상태만 이용하면서 화면 간 이동을 매끈하게 만드는 대신, 한 물리 스텝의 시각적 지연을 감수한다**는 것이 핵심입니다. Unity 2022.3 공식 매뉴얼도 `Interpolate`가 이전 두 물리 상태를 사용하므로 한 스텝의 지연이 생긴다고 설명합니다. [Unity 보간 설명](https://docs.unity3d.com/kr/2022.3/Manual/rigidbody-interpolation.html).

![렌더 시각 50ms에서 보간을 끈 값 0.080m와 한 스텝 지연 보간값 0.060m 및 등속 운동 기준값 0.100m를 구분한 위치 비교](assets/position-comparison.svg)

*그림 2 · 직접 만든 수치 비교입니다. 색은 표시 전략을 구분하며 위치값은 초속 2m인 가상 예제의 산술 결과입니다. 0.100m는 미래를 미리 안다는 가정 아래의 비교 기준이지, 실제 엔진이 측정한 위치가 아닙니다. 근거: [Unity Rigidbody 보간 매뉴얼](https://docs.unity3d.com/kr/2022.3/Manual/rigidbody-interpolation.html).*

## 그럼 보간 대신 50ms 위치를 예측하면 되지 않을까요?

그것이 **외삽(Extrapolation)**입니다. 이전 두 점 사이를 메우는 보간과 달리, 외삽은 현재 속도 등의 정보로 **아직 계산되지 않은 미래 위치**를 추정합니다. 위의 등속 예제에서는 `0.080m + 2m/s × 0.010s = 0.100m`가 됩니다.

하지만 40ms 직후 공이 벽에 부딪혀 멈췄다면 이야기가 달라집니다. 단순한 등속 예측은 충돌을 미리 알지 못해 0.100m까지 그린 뒤, 다음 물리 업데이트에서 위치를 되돌리는 눈에 띄는 수정이 발생할 수 있습니다. Unity 공식 문서는 `Extrapolate`가 충돌 경계를 넘어 보였다가 정정될 수 있다고 주의합니다. 충돌·가속이 잦은 대상이라면 정확성과 부드러움의 타협에서 `Interpolate`가 유리할 때가 많습니다. [Unity Rigidbody 보간 매뉴얼](https://docs.unity3d.com/kr/2022.3/Manual/rigidbody-interpolation.html).

여기서 중요한 점이 하나 더 있습니다. 보간은 **물리 시뮬레이션 횟수를 늘리지 않습니다.** 물리의 정확도나 충돌 판정을 고치는 기술이 아니라 **이미 계산한 상태를 화면에 제시하는 방법**입니다. 렌더링이 실제로 느리거나 물리 스텝이 밀리는 문제라면 시간 관리와 프로파일링을 따로 살펴봐야 합니다. 고정 스텝의 비용과 누적 지연 문제는 Glenn Fiedler가 **2004년 6월 10일** 발표한 [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/)에서도 설명합니다.

## Unity에서는 어디서 설정해 볼까요?

다음은 **Unity 2022.3의 3D `Rigidbody`를 대상으로 한 실제 C# 사용 예**입니다. 2m/s 숫자 모델을 보이기 위해 *키네마틱(kinematic)* 리지드바디를 매 고정 스텝에 일정 거리 이동시킵니다. `MovePosition`은 키네마틱 리지드바디의 위치를 옮길 때 보간 설정을 따릅니다. 비교를 위해 `Interpolate`와 `None`을 번갈아 설정해 보세요. 이 코드는 플레이어 입력·충돌 반응을 포함한 완성형 이동 시스템은 아닙니다. [Unity Rigidbody.MovePosition API](https://docs.unity3d.com/kr/2022.2/ScriptReference/Rigidbody.MovePosition.html).

```csharp

using UnityEngine;



[RequireComponent(typeof(Rigidbody))]

public sealed class ConstantMotion : MonoBehaviour

{

    private Rigidbody body;

    [SerializeField] private float speed = 2f;



    private void Awake()

    {

        body = GetComponent<Rigidbody>();

        body.isKinematic = true;

        body.interpolation = RigidbodyInterpolation.Interpolate;

    }



    private void FixedUpdate()

    {

        Vector3 next = body.position

            + Vector3.right * (speed * Time.fixedDeltaTime);

        body.MovePosition(next);

    }

}

```

`Time.fixedDeltaTime`은 물리 갱신 간격(초)이고, `RigidbodyInterpolation.Interpolate`는 **렌더링 표시용 보간 설정**입니다. `FixedUpdate` 안에서 일정 거리씩 이동시키되, 표시할 때는 엔진의 보간을 쓰는 흐름입니다. Unity가 보간 중인 리지드바디의 Transform을 물리 시스템에서 관리한다는 점도 기억해야 합니다. Transform을 외부에서 직접 바꾸는 코드를 섞는 경우 `Physics.SyncTransforms` 등 동기화 요건을 확인해야 하며, 임의로 직접 덮어쓰는 구현은 피하는 편이 안전합니다. [Unity 2022.3 보간 지침](https://docs.unity3d.com/kr/2022.3/Manual/rigidbody-interpolation.html).

실험에서는 **Time 설정의 Fixed Timestep 0.02**, 움직이는 물체를 추적하는 카메라, `None`/`Interpolate` 비교를 준비하세요. Profiler에서 CPU 프레임 시간과 물리 업데이트 실행 패턴을 보고, Game 뷰에서 실제 움직임을 함께 확인합니다. 카메라를 움직이는 시점과 추적 대상의 표시 시점이 어긋날 수도 있으므로 `Update`/`LateUpdate`의 읽기 시점도 조사 대상입니다. 여기서 특정 FPS 향상이나 CPU 절감 수치는 예측하지 않습니다.

## 모든 물체에 켜면 더 좋은가요?

그렇지는 않습니다. 카메라가 가까이 따라가는 캐릭터·차량에서 떨림이 보일 때 먼저 적용하고, 배경의 수많은 리지드바디에는 실제 증상이 있는지부터 보세요. 시각적 지연 한 스텝과 추가 상태 보관·처리 비용이 선택의 대가입니다. Unity는 모든 리지드바디에 무조건 보간을 켜라고 권장하지 않습니다. [Unity Rigidbody.interpolation API](https://docs.unity3d.com/kr/6000.0/ScriptReference/Rigidbody-interpolation.html).

게임이 네트워크에서 위치를 받는다면 서버 스냅샷 보간이나 예측·재보정은 **다른 시간축의 문제**입니다. 오늘 설명한 `Rigidbody` 보간을 켠다고 서버 지연이나 권위 상태의 불일치까지 해결되지는 않습니다. 반대로 물리 지터가 아닌 애니메이션 클립의 샘플링 문제도 별도 원인을 살펴봐야 합니다.

## 오늘 얻어갈 것

**물리 50Hz, 화면 60FPS가 어긋나면 같은 물리 위치가 여러 렌더 프레임에 반복되어 움직임이 떨려 보일 수 있습니다.** 보간은 이미 얻은 두 물리 상태 사이를 잇되, 최신 시각보다 한 고정 스텝 뒤의 모습을 그려 화면 움직임을 부드럽게 만듭니다. 예제의 렌더 50ms에서는 20ms의 0.040m와 40ms의 0.080m를 0.5로 섞어 **0.060m**를 표시했습니다.

프로젝트에서는 `Time.fixedDeltaTime`과 각 프레임의 `FixedUpdate` 횟수, `Rigidbody.interpolation`, `MovePosition`의 사용 방식, 카메라가 위치를 읽는 시점을 점검하세요. 먼저 `None`과 `Interpolate`를 비교해 실제 지터를 확인하고, 충돌이 잦다면 미래를 추정하는 `Extrapolate`의 수정 비용도 살펴보는 것이 좋습니다.

## 출처

- [Unity 6.0 매뉴얼 · 고정 업데이트](https://docs.unity3d.com/kr/current/Manual/fixed-updates.html) — 2025년 12월 빌드 문서, `FixedUpdate`와 0~여러 회 실행 패턴.

- [Unity 2022.3 매뉴얼 · 리지드바디에 보간 적용](https://docs.unity3d.com/kr/2022.3/Manual/rigidbody-interpolation.html) — 이전 두 상태, 한 스텝 지연, 외삽의 한계.

- [Unity 2022.2 API · Rigidbody.MovePosition](https://docs.unity3d.com/kr/2022.2/ScriptReference/Rigidbody.MovePosition.html) — 키네마틱 이동 및 보간 설정과의 관계.

- [Glenn Fiedler · Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) — 2004년 6월 10일, 고정 스텝과 렌더 보간 해설.
