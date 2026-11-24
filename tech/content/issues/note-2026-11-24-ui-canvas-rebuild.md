# 체력바 하나를 바꿨는데 왜 UI 전체가 다시 계산될까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 체력바는 작은데 프레임 비용은 작지 않습니다

게임 HUD에 장식 아이콘 100개와 체력바 하나가 있습니다. 체력바의 채워진 비율만 바꾸는데 CPU Profiler에서 UI 관련 비용이 늘어납니다. 장식 아이콘은 그대로인데 왜 체력바 하나의 수정이 더 넓은 범위의 계산을 유발할까요?

Unity UI(uGUI)의 Canvas는 단순히 UI 오브젝트를 모아 놓는 부모가 아닙니다. 화면에 표시할 그래픽을 모아서 렌더링에 필요한 배치를 구성하는 경계입니다. **배치(Batch)**는 렌더링 상태가 호환되는 그래픽을 함께 제출하기 위한 단위입니다. 텍스처, 머티리얼, 마스킹과 그리기 순서에 따라 한 Canvas 안에서도 여러 배치가 생길 수 있습니다.

UI가 바뀌면 이전 계산 결과를 그대로 사용해도 되는지 확인해야 합니다. 갱신이 필요하다고 표시하는 일을 **더티 플래그(Dirty Flag)**라고 합니다. Unity의 [UI 최적화 가이드](https://unity.com/how-to/unity-ui-optimization-tips)는 한 요소의 변경으로 Canvas의 배치 분석이 다시 필요해질 수 있으며, 자식 Canvas로 배치 경계를 나눌 수 있다고 설명합니다.

## 요소의 메시 갱신과 Canvas의 배치 갱신은 다릅니다

UI 갱신을 이해할 때는 세 가지 일을 구분하는 편이 좋습니다. **레이아웃(Layout)**은 요소의 위치와 크기를 결정합니다. **그래픽 재구축(Graphic Rebuild)**은 변경된 그래픽의 정점 또는 머티리얼을 갱신합니다. **배치 재구성(Batch Rebuild)**은 Canvas 안의 렌더링 요소를 어떤 순서와 묶음으로 제출할지 다시 분석하는 작업입니다.

예를 들어 Image의 채워진 비율을 0.8에서 0.6으로 바꾸면, 체력바의 표시 영역이 줄어듭니다. 이때 Canvas의 배치 정보도 갱신 대상이 될 수 있습니다. 하지만 정적 아이콘 100개의 정점 생성 함수가 매번 모두 실행된다는 의미는 아닙니다. 요소의 메시 재생성과 Canvas 단위의 배치 분석을 구분해야 합니다.

uGUI의 공개 소스인 [CanvasUpdateRegistry.cs](https://github.com/Unity-Technologies/uGUI/blob/main/com.unity.ugui/Runtime/UGUI/UI/Core/CanvasUpdateRegistry.cs)에는 레이아웃과 그래픽의 재구축 대기열이 별도로 존재합니다. 이는 관리 코드에서 서로 다른 갱신 단계를 다룬다는 근거입니다. 네이티브 Canvas 배치 구현 전체가 이 파일에 공개되어 있는 것은 아닙니다.

## 체력바가 60번 바뀌는 1초를 생각해 봅시다

설명을 위한 가상 HUD를 구성합니다. 장식 100개는 내용과 위치가 고정되어 있고, 체력바 하나는 60프레임 동안 매 프레임 다른 비율을 표시합니다. 화면 해상도와 레이아웃은 바뀌지 않으며, 최초 구성 비용은 제외합니다.

배치 분석의 영향을 받는 Canvas에 포함된 그래픽 수를 단순히 합산하는 모형을 사용하겠습니다. 실제 내부 반복 횟수나 CPU 시간은 아닙니다.

- 하나의 Canvas: 매번 장식 100개와 체력바 1개가 포함된 배치 경계가 갱신 대상입니다.
- 분리된 Canvas: 장식 Canvas는 변하지 않고 체력바 Canvas만 갱신 대상입니다.

![100개 장식과 체력바를 하나의 Canvas에 배치한 경우와 정적 Canvas 및 체력바 Canvas로 분리한 경우의 갱신 경계](assets/canvas-boundary.svg)

*직접 제작한 개념도. 초록색 영역은 체력바 변경 시 영향을 받는 배치 경계를 나타냅니다. 실제 엔진의 프로파일링 화면이 아닙니다. 개념 근거: [Unity UI 최적화 가이드](https://unity.com/how-to/unity-ui-optimization-tips).*

한 Canvas의 영향 범위를 합산하면 101 × 60 = 6,060입니다. 두 Canvas로 나누면 1 × 60 = 60입니다. 이 숫자는 동일한 그래픽 101개를 60번 렌더링한다는 사실을 바꾸지 않습니다. GPU는 여전히 정적 장식을 화면에 그려야 합니다.

![60번 갱신할 때 단일 Canvas는 영향 범위 합 6060, 분리 Canvas는 60인 가상 계산 비교](assets/rebuild-scope.svg)

*직접 제작한 계산도. 동일한 갱신 횟수에서 영향 범위의 합만 계산했습니다. 정점 생성 수, 드로우 콜 수, CPU 시간 또는 실측 성능 배율을 뜻하지 않습니다.*

Canvas 분리는 GPU가 그릴 그래픽을 없애는 기술이 아니라 CPU에서 다시 준비해야 할 범위를 줄이는 선택입니다. 서로 다른 Canvas의 그래픽을 같은 Canvas 배치로 묶을 수 없으므로, 오히려 렌더링 제출 비용이 늘어날 수도 있습니다.

## 실제 체력바 코드와 계층을 바꿔 봅니다

Unity UI 2.0의 [Image API](https://docs.unity3d.com/Packages/com.unity.ugui%402.0/api/UnityEngine.UI.Image.html)는 Image.Type.Filled에서 fillAmount로 표시 영역을 제어할 수 있다고 설명합니다. Inspector에서 Image Type을 Filled로, Fill Method를 Horizontal로 설정합니다.

아래는 실제 C# 컴포넌트입니다. 체력 수치가 변경될 때 게임 로직이 SetHealth를 호출합니다. 컴포넌트에는 자체 Update 루프가 없습니다.

```csharp
using UnityEngine;
using UnityEngine.UI;

public sealed class HealthBarView : MonoBehaviour
{
    [SerializeField] private Image fill;

    public void SetHealth(int current, int maximum)
    {
        float ratio = maximum > 0
            ? Mathf.Clamp01((float)current / maximum)
            : 0f;

        if (fill.fillAmount == ratio)
            return;

        fill.fillAmount = ratio;
    }
}
```

fill은 Inspector에서 연결합니다. 체력이 100점 만점에 80점이었다가 60점으로 감소하면 표시 비율은 0.8에서 0.6이 됩니다. 60이라는 값이 계속 전달되는 경우에는 이 코드가 UI 속성에 다시 대입하지 않습니다. uGUI 자체에도 속성별 변경 검사가 있으므로 이 조건 하나만 추가한다고 항상 눈에 띄는 성능 향상이 생기는 것은 아닙니다.

부드러운 체력바 애니메이션이 필요하면 표시 비율을 보간하는 별도 로직이 매 프레임 값을 갱신할 수 있습니다. 이 경우에도 값이 변하는 동안만 실행하고, 정적 HUD에서 분리된 자식 Canvas 안에 체력바를 두는 편이 합리적인 출발점입니다.

다음은 Inspector에서 만들 계층의 예입니다. 코드가 아닌 구조 설명입니다.

```text
HUD (Canvas, Screen Space - Overlay)
  Decorations (100 graphics, static)
  HealthOverlay (child Canvas)
    HealthFill (Image, Filled)
```

HealthOverlay의 영역은 앵커로 고정하고, 장식과 겹칠 때의 정렬 순서를 확인합니다. 부모 레이아웃 그룹이 자식 크기를 계속 변경하거나 해상도가 바뀌면 정적 영역도 다시 계산될 수 있습니다. Canvas가 분리되었다고 모든 레이아웃 의존성까지 사라지는 것은 아닙니다.

## Canvas를 많이 만들수록 유리할까요?

아닙니다. 각 Canvas는 독립적으로 배치를 구성하므로 같은 텍스처를 사용하던 그래픽도 Canvas 경계를 넘어 하나의 배치로 합쳐지지 않습니다. 체력바 하나마다 Canvas를 무조건 추가하면 CPU의 갱신 비용을 낮추는 대신 배치 수를 늘리는 설계가 될 수 있습니다.

같은 시점에 바뀌는 탄약, 체력, 스킬 재사용 대기시간 표시를 한 동적 Canvas에 두고, 거의 바뀌지 않는 장식은 다른 Canvas에 두는 방식부터 비교해 보세요. 사용자 입력이 없는 장식 Canvas에는 불필요한 GraphicRaycaster를 두지 않는 것도 좋습니다. 다만 입력을 처리해야 하는 자식 Canvas에는 필요한 입력 구성을 유지해야 합니다.

측정은 동일한 해상도와 기기, 동일한 체력 변경 패턴으로 단일 Canvas와 분리 Canvas를 비교합니다. Unity UI 2.0 [UI and UI Details Profiler](https://docs.unity.cn/Packages/com.unity.ugui%402.0/manual/ProfilerUI.html)의 Self Batch Count, Self Vertex Count, Batch Breaking Reason을 확인해 배치 수가 얼마나 달라졌는지 살펴봅니다. CPU Profiler에서는 변경 프레임의 UI 관련 시간과 스파이크를 비교하고, Frame Debugger에서는 실제 렌더링 제출이 어떻게 나뉘었는지 확인합니다.

## 오늘 얻어갈 것

체력바의 변화가 더 큰 UI 비용을 만드는 이유는 변경된 그래픽 자체의 갱신뿐 아니라 그 그래픽이 속한 Canvas의 배치 결과도 다시 분석해야 할 수 있기 때문입니다. 오늘의 가상 HUD에서 배치 경계의 그래픽 수를 60회 합산하면 6,060과 60이라는 차이가 나오지만, 이는 성능이 101배 좋아진다는 주장이 아닙니다.

먼저 값이 실제로 바뀌는 코드와 불필요한 속성 갱신을 구분하세요. 이어 Canvas를 갱신 빈도 기준으로 나누고 CPU Profiler의 UI 비용과 UI Details의 배치 수를 함께 측정하면, 갱신 범위와 제출 비용 사이에서 근거 있는 선택을 할 수 있습니다.

## 출처

- [Unity — Optimization tips for Unity UI](https://unity.com/how-to/unity-ui-optimization-tips), 공식 가이드, 2026-11-24 확인. 자식 Canvas의 배치 경계와 갱신 빈도 기준 분리.
- [Unity Learn — Working with Static and Dynamic Canvases](https://learn.unity.com/tutorial/working-with-static-and-dynamic-canvases-1), Unity 2019.3 기준 공식 튜토리얼. 정적·동적 Canvas 설계의 기존 설명.
- [Unity — uGUI 공개 소스 CanvasUpdateRegistry.cs](https://github.com/Unity-Technologies/uGUI/blob/main/com.unity.ugui/Runtime/UGUI/UI/Core/CanvasUpdateRegistry.cs), main 공개 소스, 2026-11-24 확인. 레이아웃·그래픽 재구축 대기열.
- [Unity — Image](https://docs.unity3d.com/Packages/com.unity.ugui%402.0/api/UnityEngine.UI.Image.html), uGUI 2.0 API, 2026-11-24 확인. Filled 이미지와 fillAmount.
- [Unity — UI and UI Details Profiler](https://docs.unity.cn/Packages/com.unity.ugui%402.0/manual/ProfilerUI.html), uGUI 2.0 공식 문서, 2026-11-24 확인. 배치·정점 수와 배치 분리 원인.
