# 170도에서 -170도로 돌리는데 왜 한 바퀴 가까이 돌아갈까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 20도만 돌면 되는데 340도를 돌아갑니다

캐릭터가 왼쪽 뒤를 향해 **Y축 기준 170°**만큼 돌아서 있습니다. 다음 목표 방향은 **-170°**입니다. 각도 숫자를 그대로 보간하면 절반 지점은 0°입니다. 하지만 실제로 가까운 방향은 180°를 지나가는 **20° 회전**입니다. **왜 같은 출발점과 도착점인데 보간 방법에 따라 340°를 돌아갈까요?**

오늘은 캐릭터의 회전 전환을 사례로 **사원수(Quaternion)**와 **구면 선형 보간(Spherical Linear Interpolation, SLERP)**을 살펴보겠습니다. 이 설명은 한 축을 중심으로 한 회전을 먼저 사용하지만, 사원수 보간 자체는 임의의 3차원 회전에도 적용할 수 있습니다. 고전적인 출발점은 Ken Shoemake가 1985년 SIGGRAPH에서 발표한 [*Animating Rotation with Quaternion Curves*](https://doi.org/10.1145/325334.325242)입니다.

## 각도 숫자를 평균 내면 왜 틀릴까요?

회전 각도는 한 바퀴를 돌면 같은 방향으로 돌아옵니다. **170°와 -170°는 숫자로는 340° 떨어져 있지만**, 원 위에서는 180°를 사이에 두고 20°밖에 차이 나지 않습니다. 여기서 '최단'은 이동 거리나 애니메이션 시간을 뜻하지 않고 **두 방향 사이의 최소 회전각**을 뜻합니다.

| 보간 방식 | 시작 | 중간(t=0.5) | 끝 | 이동한 회전각 |
| --- | ---: | ---: | ---: | ---: |
| 각도 숫자 단순 보간 | 170° | 0° | -170° | 340° |
| 짧은 회전 호 선택 | 170° | 180° | 190° (= -170°) | 20° |

두 방법은 같은 끝 방향으로 도착하지만, 중간 자세가 완전히 다릅니다. 아래 개념도는 **평면의 각도 눈금**을 그린 것으로 Unity 화면 좌표축이나 실제 월드 방향을 측정한 이미지가 아닙니다.

![원형 각도 눈금의 170도에서 -170도까지 짧은 20도 호와 긴 340도 호를 비교한 그림](assets/angle-arcs.svg)

*그림 1 · 직접 만든 평면 회전 개념도입니다. 시작 170°와 목표 -170°(190°) 사이의 짧은 호는 20°, 반대쪽의 긴 호는 340°입니다. 원형 회전 표현과 보간의 근거: [Shoemake(1985)](https://doi.org/10.1145/325334.325242).*

## 서로 반대 부호의 사원수가 같은 회전인 이유

**단위 사원수(Unit Quaternion)**는 회전을 표현하는 네 성분 `(x, y, z, w)`의 길이가 1인 값입니다. 한 축을 각도 θ만큼 회전시키면, 그 축 방향 성분에는 `sin(θ/2)`, 나머지 스칼라 성분 `w`에는 `cos(θ/2)`가 들어갑니다. 이처럼 **각도의 절반**을 쓰므로, 네 성분을 모두 뒤집은 `q`와 `-q`는 **동일한 3차원 회전**을 나타냅니다. 사원수는 방향을 표현할 때 이런 이중 표현(Double Cover)을 갖습니다.

이번 예제는 Y축 회전 하나만 있으므로 `q=(0, sin(θ/2), 0, cos(θ/2))`입니다. 소수 넷째 자리까지 반올림하면 다음과 같습니다.

| 값 | x | y | z | w |
| --- | ---: | ---: | ---: | ---: |
| 시작 q₀ (170°) | 0 | +0.9962 | 0 | +0.0872 |
| 목표 q₁ (-170°) | 0 | -0.9962 | 0 | +0.0872 |
| 동등한 목표 -q₁ | 0 | +0.9962 | 0 | -0.0872 |

**내적(Dot Product)**은 같은 위치의 성분을 곱해 더하는 계산입니다. 이 두 단위 사원수의 내적은 약 **-0.9848**입니다. 부호를 바꾼 목표와의 내적은 **+0.9848**이 됩니다. 가까운 호를 선택하는 사원수 보간에서는 내적이 음수일 때 목표 사원수의 모든 성분에 음수를 곱하는 방법을 사용합니다. **회전 목표를 바꾸는 게 아니라 같은 목표의 다른 표현을 택하는 것**입니다.

![시작 q0와 목표 q1의 내적이 음수일 때 목표의 네 성분을 반전하면 내적이 양수로 바뀌고 가까운 회전 호를 고른다는 흐름도](assets/quaternion-sign-flip.svg)

*그림 2 · 직접 만든 부호 선택 흐름도입니다. Y축 ±170° 예시의 내적은 반올림해 -0.9848, 부호 반전 후 +0.9848입니다. 실제 분기 근거: [Unity.Mathematics 공개 slerp 소스](https://github.com/Unity-Technologies/Unity.Mathematics/blob/master/src/Unity.Mathematics/quaternion.cs).*

이 예제의 가까운 사원수 호는 `acos(0.9848) ≈ 10°`입니다. 이 값은 **사원수 공간의 각도**이고, 실제 자세 사이의 회전각은 두 배인 약 **20°**입니다. 실전에서 단위 사원수의 회전 차이를 계산할 때는 부동소수점 오차를 고려해 내적을 유효 범위로 제한해야 합니다.

## SLERP는 왜 선형 보간과 다를까요?

**구면 선형 보간(SLERP)**은 단위 사원수가 놓인 구면 위의 호를 따라 두 회전 사이를 보간합니다. 목표 부호를 올바르게 선택하면 이번 예제의 중간 자세는 **180°**가 됩니다. 한 구간에서 매개변수 `t`를 일정한 속도로 증가시키면 회전각도 일정하게 변합니다. 반면 성분을 단순히 평균 내는 방식은 단위 길이를 잃을 수 있어 정규화가 필요하고, 일반적으로 회전 각속도가 균일하지 않습니다.

그렇다고 언제나 SLERP가 최선인 것은 아닙니다. 가까운 자세를 아주 자주 섞는 경우 **정규화 선형 보간(Normalized Linear Interpolation, NLERP)**이 계산 비용 면에서 유리할 수 있습니다. Unity의 공개 수학 라이브러리 `math.slerp`는 내적이 음수면 목표 부호를 바꾸고, 두 값이 충분히 가까우면 `nlerp`로 전환합니다. 이 공개 소스는 알고리즘을 이해하기 좋은 예이며, `UnityEngine.Quaternion.Slerp`와 내부 구현이 완전히 같다고 주장하는 근거는 아닙니다. [Unity.Mathematics 소스](https://github.com/Unity-Technologies/Unity.Mathematics/blob/master/src/Unity.Mathematics/quaternion.cs)를 확인해 보세요.

## Unity에서는 회전을 직접 풀어 쓸 필요가 있을까요?

보통은 아닙니다. Unity 6의 `UnityEngine.Quaternion.Slerp(a, b, t)`는 단위 사원수 사이를 구면 보간하며, `t`를 0~1로 제한합니다. `Quaternion.Angle(a, b)`는 두 자세 사이의 각도(0~180°)를 반환합니다. 아래는 **UnityEngine의 실제 C# API**로 두 고정된 목표 방향을 0.5초 동안 전환하는 예제입니다. 프로덕션 캐릭터 컨트롤러가 아니라 회전 보간 확인용 컴포넌트입니다.

```csharp
using UnityEngine;

public sealed class ShortestTurnExample : MonoBehaviour
{
    [SerializeField, Min(0.01f)] private float duration = 0.5f;

    private Quaternion from;
    private Quaternion to;
    private float elapsed;

    private void Start()
    {
        from = Quaternion.Euler(0f, 170f, 0f);
        to = Quaternion.Euler(0f, -170f, 0f);
        transform.rotation = from;
        elapsed = 0f;

        // 두 목표 자세의 최소 회전각은 약 20도입니다.
        Debug.Log(Quaternion.Angle(from, to));
    }

    private void Update()
    {
        elapsed += Time.deltaTime;
        float t = Mathf.Clamp01(elapsed / Mathf.Max(duration, 0.01f));
        transform.rotation = Quaternion.Slerp(from, to, t);
    }
}
```

핵심은 **출발 자세 `from`과 목표 자세 `to`를 전환 시작 시점에 고정**하고, `elapsed / duration`으로 진행률을 계산하는 것입니다. 매 프레임 바뀐 `transform.rotation`을 새 출발점으로 사용하면서 같은 `t`를 적용하면, 앞 예제의 일정한 구간 진행과 다른 동작이 됩니다. 목표가 바뀌는 추적 회전이라면 새 전환을 시작하거나, 원하는 초당 회전각을 제한하는 별도의 정책을 정해야 합니다.

이 예제는 **회전의 경로와 시간 진행**을 보여줍니다. 실제 NPC에서는 회전과 이동 애니메이션의 루트 모션, 캐릭터 충돌 처리, 네트워크 동기화가 별도 조건입니다. `t=0.5`인 순간을 임의로 기록하거나 `Quaternion.Angle(from, transform.rotation)`을 측정하면 기대값이 약 10°인지 확인할 수 있습니다. [Unity 6 Slerp API](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/quaternion/slerp), [Quaternion.Angle API](https://docs.unity3d.com/jp/current/ScriptReference/Quaternion.Angle.html)를 참고해 주세요.

## 모든 회전에서 '짧은 길'이 원하는 연출일까요?

반드시 그렇지는 않습니다. 날개가 360° 회전하는 묘기, 바퀴의 누적 회전, 일부 카메라 연출에서는 **방향은 같아도 몇 바퀴를 돌았는지**가 중요한 데이터입니다. 시작 자세와 끝 자세 두 개만으로는 '한 바퀴 더 돌기'를 표현할 수 없습니다. 이때는 누적 각도나 회전 횟수를 별도로 보존해 회전을 진행해야 합니다. 또한 정확히 180° 떨어진 두 자세는 짧은 길의 선택이 하나로 정해지지 않을 수 있어 회전축이나 방향 정책을 명시하는 편이 안전합니다.

## 오늘 얻어갈 것

처음 질문의 답은 **각도 숫자의 차이와 실제 회전 공간에서의 거리가 다르기 때문**입니다. 170°→-170°를 숫자만 보간하면 340°를 돌아 0°를 지나지만, 같은 목표를 나타내는 사원수의 부호를 적절히 선택하면 180°를 경유하는 **20° 회전**을 얻습니다.

코드에서는 **목표 회전의 표현과 출발·도착값 고정 여부**, 엔진에서는 **`Quaternion.Slerp`와 `Quaternion.Angle`의 결과**, 프로파일러에서는 **실제로 많은 회전을 처리할 때 SLERP와 단순 보간 비용이 의미 있는지**를 확인해 보세요. 계산량이 적은 곳에 무작정 최적화를 적용하기보다, 먼저 요구하는 회전 경로와 속도가 맞는지 재현하는 것이 출발점입니다.

## 출처

- [Ken Shoemake, *Animating Rotation with Quaternion Curves*](https://doi.org/10.1145/325334.325242) — SIGGRAPH 1985, 사원수 곡선과 회전 보간의 원전.
- [Unity 6.0, Quaternion.Slerp](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/quaternion/slerp) — 실제 `UnityEngine` API, `t` 범위와 인수.
- [Unity, Quaternion.Angle](https://docs.unity3d.com/jp/current/ScriptReference/Quaternion.Angle.html) — 두 회전 사이 각도 0~180°.
- [Unity, Quaternion.Euler](https://docs.unity3d.com/jp/current/ScriptReference/Quaternion.Euler.html) — 세 축 각도로 사원수를 생성하는 API.
- [Unity-Technologies, Unity.Mathematics `quaternion.cs`](https://github.com/Unity-Technologies/Unity.Mathematics/blob/master/src/Unity.Mathematics/quaternion.cs) — `math.slerp`의 음수 내적 처리 및 가까운 두 값에서 `nlerp` 사용.
