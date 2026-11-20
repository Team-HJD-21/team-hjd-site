# 화면에 적이 열두 명인데 왜 모두 매 프레임 애니메이션을 계산할까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 화면은 60번 그리는데 관절 계산도 60번 해야 할까요?

전투 장면에서 적이 열두 명 움직인다고 생각해 보겠습니다. 가까운 보스의 공격 동작은 한 프레임만 어긋나도 눈에 띕니다. 반면 화면 구석의 작은 적은 관절 자세를 매 프레임 새로 계산하지 않아도 차이를 알아보기 어려울 수 있습니다. **그렇다면 열두 명에게 같은 애니메이션 계산 비용을 써야 할까요?**

캐릭터를 그리는 일과 뼈대 자세를 새로 계산하는 일은 다릅니다. **스켈레탈 애니메이션(Skeletal Animation)**은 본(Bone)들의 자세를 계산해 메시 변형에 사용합니다. 프레임마다 화면을 제출하더라도 모든 캐릭터의 애니메이션 평가(Animation Evaluation)를 반드시 같은 빈도로 수행해야 하는 것은 아닙니다.

Unreal Engine의 **애니메이션 예산 할당기(Animation Budget Allocator)**는 이런 비용을 제한하기 위해 스켈레탈 메시 컴포넌트의 업데이트 빈도를 동적으로 조절하는 플러그인입니다. 공식 **Unreal Engine 5.9 문서**는 중요도가 높은 캐릭터의 계산을 우선하고, 덜 중요한 캐릭터의 업데이트 간격·보간 여부·작업 수준을 조절한다고 설명합니다. 이것은 단순히 화면 밖의 물체를 안 그리는 렌더링 컬링과 다른 문제입니다. [Epic 공식 설명](https://dev.epicgames.com/documentation/unreal-engine/animation-budget-allocator-in-unreal-engine)

## 예산은 프레임 시간의 일부입니다

60FPS의 한 프레임은 약 **16.67ms**입니다. 하지만 이것을 애니메이션에 전부 사용할 수는 없습니다. 입력, 게임 로직, 물리, 렌더 제출 등 다른 작업이 남아 있기 때문입니다.

예를 들어, 실제 측정값이 아닌 **계산을 위한 가상 조건**을 놓겠습니다. 적이 열두 명이고 각 적의 애니메이션 평가가 정확히 **0.20ms** 걸린다고 가정합니다. 모두 매 프레임 갱신한다면 아래와 같습니다.

\$\$
12 \times 0.20\,\mathrm{ms} = 2.40\,\mathrm{ms}
\$\$

이제 목표 예산을 **1.20ms/프레임**으로 설정했다고 해 보겠습니다. 적 네 명은 전투상 중요한 근접 캐릭터, 나머지 여덟 명은 먼 캐릭터입니다.

- 근접 네 명을 매 프레임 갱신하면 \`4 × 0.20 = 0.80ms\`입니다.
- 남은 예산은 \`1.20 - 0.80 = 0.40ms\`입니다.
- 따라서 이 단순 모델에서는 먼 적 두 명을 한 프레임에 추가로 평가할 수 있습니다.

한 프레임에서 평가할 총 대상은 **6명**, 계산 비용은 **1.20ms**입니다. 이것은 평균과 상한이 일정하다는 가정의 *산수 예제*이지 Unreal이 항상 정확히 여섯 명을 선택한다거나 실측 1.20ms를 보장한다는 뜻은 아닙니다.

![가상 예제의 전체 평가 2.40밀리초와 중요도에 따라 평가량을 나눈 1.20밀리초 예산 비교](assets/animation-budget-bars.svg)

*직접 제작한 계산 도식입니다. 12명 × 0.20ms = 2.40ms, 근접 4명 × 0.20ms + 먼 적 2명 × 0.20ms = 1.20ms를 보여줍니다. 실제 Unreal 프로파일링 측정 결과가 아닙니다. 개념 근거: [Epic Animation Budget Allocator](https://dev.epicgames.com/documentation/unreal-engine/animation-budget-allocator-in-unreal-engine).*

## 낮은 빈도로 계산하되 무작정 멈추지는 않습니다

가상 예제의 먼 적 여덟 명을 매 프레임 두 명씩 돌아가며 평가해 보겠습니다. 4프레임에 걸쳐 모든 먼 적이 한 번씩 갱신됩니다. 렌더링이 정확히 60FPS로 유지된다면 각 먼 적의 평가 빈도는 **60/4 = 15Hz**가 됩니다.

![네 프레임마다 근접 네 명은 항상 갱신하고 먼 적 여덟 명은 두 명씩 순환해 한 번씩 평가하는 시간표](assets/animation-update-calendar.svg)

*직접 제작한 4프레임 시간표입니다. 밝은 셀은 해당 프레임에 자세를 새로 평가하는 대상입니다. 실제 Animation Budget Allocator의 선택 알고리즘을 재현한 그림이 아니라, 저빈도 평가의 비용을 이해하기 위한 단순화입니다.*

여기서 **업데이트 생략(Skipping Updates)**과 **보간(Interpolation)**을 구분해야 합니다. 자세 평가를 건너뛰면 CPU 계산을 줄일 수 있지만 화면에서 자세가 계단처럼 바뀔 수 있습니다. 두 계산 결과 사이를 보간하면 움직임을 덜 거칠게 보여줄 수 있지만, 보간 자체에도 비용이 들고 급격한 동작에서는 정확성 문제가 생길 수 있습니다.

Unreal의 공식 설명에서도 시스템이 중요도(Significance)에 따라 업데이트 빈도를 낮추거나, 보간 여부를 선택하고, 일부 비싼 작업을 줄인다고 안내합니다. **중요도는 고정된 거리 하나와 같지 않습니다.** 화면에서의 역할, 크기, 플레이어와의 상호작용을 고려해 프로젝트에서 중요도를 정의해야 합니다.

## C++17로 네 프레임의 분배를 확인해 보겠습니다

아래는 예제 숫자를 재현하는 **엔진 독립 실행 코드**입니다. Unreal 내부 알고리즘을 복제한 코드가 아니라 비용 계산을 검증하는 학습용 스케줄러입니다.

\`\`\`cpp
#include <iostream>

int main() {
    constexpr int nearCount = 4;
    constexpr int farCount = 8;
    constexpr int farPerFrame = 2;
    constexpr double costPerUpdateMs = 0.20;

    int farUpdates[farCount] = {};

    for (int frame = 0; frame < 4; ++frame) {
        const int start = frame * farPerFrame;
        for (int i = 0; i < farPerFrame; ++i) {
            ++farUpdates[start + i];
        }

        const int evaluated = nearCount + farPerFrame;
        std::cout << "frame " << frame
                  << ": evaluated=" << evaluated
                  << ", cost=" << evaluated * costPerUpdateMs
                  << "ms\n";
    }

    for (int count : farUpdates) {
        if (count != 1) return 1;
    }
    return 0;
}
\`\`\`

각 프레임 출력은 \`evaluated=6, cost=1.2ms\`입니다. 먼 적 여덟 명 모두 4프레임 동안 정확히 한 번 계산했다는 것도 확인합니다. 실제 게임에서는 평가 시간이 일정하지 않고 우선순위가 변하며, 보간·애니메이션 노티파이(Animation Notify)·루트 모션(Root Motion) 같은 기능의 정확성을 고려해야 합니다. 따라서 이런 순환표를 그대로 엔진에 이식하지는 않습니다.

## Unreal에서 설정하고 측정하는 순서

Unreal Engine **5.9 공식 문서 기준**으로는 다음 순서로 실험할 수 있습니다.

1. **Edit → Plugins**에서 Animation Budget Allocator 플러그인을 켜고 에디터를 재시작합니다.
2. 캐릭터의 메시 컴포넌트를 **SkeletalMeshComponentBudgeted**로 사용합니다. 문서의 캐릭터 블루프린트에는 **Auto Calculate Significance**와 **Auto Register with Budget Allocator** 항목이 소개되어 있습니다.
3. 캐릭터 블루프린트의 **Begin Play**에서 **Enable Animation Budget** 노드를 연결해 활성화합니다.
4. Play In Editor에서 아래 **실제 엔진 콘솔 명령**을 이용해 적용 전후를 비교합니다.

\`\`\`text
a.Budget.Enabled 1
a.Budget.Debug.Enabled 1
a.Budget.BudgetMs 1.2
\`\`\`

마지막 \`1.2\`는 프로젝트를 위한 **실험 입력값**입니다. 실제 권장 예산이 아닙니다. 5.9 문서는 플랫폼별 \`DefaultScalability.ini\`에서 \`a.Budget.BudgetMs\`를 다르게 지정하는 방법도 소개합니다. 특정 캐릭터만 적용하지 않고 전체 시스템의 비용과 표현 품질을 함께 보아야 합니다.

디버그 오버레이에서는 **Budget**과 실제 **Performance**, **Num Ticked Components**, **Throttled**, **Interpolated** 등의 항목을 관찰합니다. 캐릭터 위의 숫자 \`1\`은 매 프레임 평가, \`5\`는 다섯 프레임에 한 번 평가한다는 의미입니다. 표시되는 \`Hi\`·\`Lo\`·\`I\`는 각각 높은 작업 수준·축소된 작업 수준·보간 상태를 뜻합니다. [Epic 5.9 디버그 설명](https://dev.epicgames.com/documentation/unreal-engine/animation-budget-allocator-in-unreal-engine)

**트레이드오프를 확인할 지점**도 중요합니다. 카메라에 가까운 캐릭터의 공격 모션이 끊기는지, 루트 모션에 기대는 이동·노티파이 처리에 영향이 있는지, 보간 작업이 오히려 비용을 늘리는지 확인해 보세요. Unreal 공식 [애니메이션 최적화 문서](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-optimization-in-unreal-engine)는 게임 스레드에 남는 작업과 Animation Insights에서의 분석을 별도로 설명합니다. 이것은 렌더링 드로우 콜 감소와 다른 종류의 CPU 최적화입니다.

## 오늘 얻어갈 것

**열두 명의 적을 반드시 모두 매 프레임 평가할 필요는 없습니다.** 핵심은 '덜 중요한 캐릭터를 멈춘다'가 아니라, 한 프레임에 쓸 수 있는 **애니메이션 계산 예산**을 정하고 중요도에 따라 서로 다른 갱신 빈도를 선택하는 것입니다.

가상 예제에서는 매 프레임 12명 평가 시 2.40ms였고, 근접 네 명과 먼 적 두 명만 평가하면 1.20ms였습니다. 먼 적은 4프레임 주기, 즉 60FPS 환경에서 15Hz로 계산됩니다. 실제 Unreal 프로젝트에서는 **Animation Budget Allocator의 적용 전후를 같은 장면에서 측정**하고, Budget·Performance·Throttled·Interpolated 지표와 가까운 캐릭터의 동작 품질을 함께 보세요. 계산으로 세운 예산이 실제 프레임에서 지켜지는지는 프로파일러가 답해 줍니다.

## 출처

- [Epic Games — Animation Budget Allocator](https://dev.epicgames.com/documentation/unreal-engine/animation-budget-allocator-in-unreal-engine), Unreal Engine 5.9 공식 문서, 2026-11-20 확인. 기능·설정·디버그·예산 변수 근거.
- [Epic Games — Animation Optimization](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-optimization-in-unreal-engine), Unreal Engine 공식 최적화 문서, 2026-11-20 확인. 애니메이션 처리 병렬화·프로파일링·잔여 비용의 근거.
