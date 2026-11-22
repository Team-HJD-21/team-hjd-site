# 조건문 하나로 줄였는데 왜 GPU는 두 경로를 모두 지나갈까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 가벼운 효과는 건너뛰었는데 셰이더가 느려졌습니다

게임에서 폭발 주변의 빛나는 파편은 복잡한 조명을, 멀리 있는 파편은 단순한 조명을 적용한다고 생각해 보겠습니다. 셰이더에 `if` 문을 넣고 필요한 계산만 하도록 바꿨는데 GPU 시간이 생각만큼 줄지 않습니다. **분명 한 픽셀은 한쪽 경로만 실행할 텐데, 어디에 비용이 남는 걸까요?**

GPU는 여러 작업을 작은 실행 묶음으로 처리합니다. NVIDIA의 **워프(Warp)**는 보통 32개 스레드를 묶은 실행 단위입니다. AMD에서는 비슷한 개념을 **웨이브프런트(Wavefront)**라고 부르며, RDNA 계열에서는 Wave32와 Wave64를 모두 사용합니다. 이처럼 프로그래머에게는 각각 독립적인 스레드처럼 보이지만 하드웨어는 묶음으로 명령을 발행하는 방식을 **SIMT(Single Instruction, Multiple Threads)**라고 합니다. [NVIDIA CUDA 가이드](https://docs.nvidia.com/cuda/archive/11.6.1/cuda-c-programming-guide/index.html#simt-architecture) · [AMD GPUOpen, 2024](https://gpuopen.com/learn/occupancy-explained/)

같은 묶음의 스레드가 조건문에서 서로 다른 방향을 고르면 **분기 발산(Branch Divergence)**이 발생합니다. 분기 구현에 따라 GPU는 한쪽 경로를 실행하는 동안 그 경로에 해당하지 않는 스레드를 비활성화하고, 이어 다른 경로를 처리할 수 있습니다. 따라서 각 스레드가 두 결과를 모두 계산한다는 뜻은 아니지만, **묶음 전체로 보면 두 명령 경로가 모두 발행될 수 있습니다.** [NVIDIA SIMT 설명](https://docs.nvidia.com/cuda/archive/11.6.1/cuda-c-programming-guide/index.html#simt-architecture)

## 32개를 묶어서 보면 달라집니다

한 워프에 파편 처리 스레드 32개가 있다고 하겠습니다. 무거운 조명 계산이 필요한 파편은 H, 간단한 계산만 필요한 파편은 L로 표시합니다. 여기서부터의 명령 수는 **실측값이 아닌 원리를 보기 위한 가상 모델**입니다.

- H 경로에 워프 명령 8개, L 경로에 워프 명령 4개가 필요하다고 가정합니다.
- 한 워프에서 H가 16개, L이 16개 섞여 있습니다.
- 분기가 실제 분기 명령으로 남아 있고, 양쪽 경로가 순서대로 발행된다고 가정합니다.

그렇다면 이 워프는 H 경로의 명령 8개를 H 스레드 16개만 활성화한 채 발행하고, L 경로의 명령 4개를 나머지 16개만 활성화해 발행합니다. **워프 단위 명령 발행 수는 8+4=12개**입니다.

두 워프, 즉 총 64개 파편을 생각하면 더 흥미롭습니다. 두 워프 모두 H 16개와 L 16개가 섞여 있을 때는 워프당 12개, **총 24개**의 가상 명령 발행이 필요합니다. 하지만 H 32개를 첫 워프에, L 32개를 둘째 워프에 모으면 첫 워프는 8개, 둘째 워프는 4개만 발행해 **총 12개**가 됩니다. 처리할 H와 L의 개수는 그대로 32개씩입니다.

![두 워프의 H·L 파편 64개를 교차 배치했을 때와 H 32개, L 32개로 묶었을 때를 비교하는 32레인 배치도](assets/wave-lane-layout.svg)

*직접 제작한 개념도입니다. 한 줄은 NVIDIA의 32레인 워프 한 개를 뜻합니다. 위쪽의 혼합 배치는 각 워프에서 H와 L이 16개씩이고, 아래쪽은 H 전용 워프와 L 전용 워프입니다. 실제 GPU의 스레드 배치를 측정한 자료가 아닙니다. 개념 근거: [NVIDIA SIMT](https://docs.nvidia.com/cuda/archive/11.6.1/cuda-c-programming-guide/index.html#simt-architecture).*

## 명령 수가 반으로 줄어도 FPS가 두 배라는 뜻은 아닙니다

가상 모델에서 두 혼합 워프가 실제 수행하는 유효 레인 명령 수는 `2 × (16 × 8 + 16 × 4) = 384`입니다. 발행한 워프 명령은 24개이고 각 명령에 최대 32레인이 참여하므로 단순 활성 비율은 `384 / (24 × 32) = 50%`입니다.

반면 두 워프를 유형별로 묶으면 유효 레인 명령 384개는 같지만 발행한 워프 명령이 12개이므로 `384 / (12 × 32) = 100%`입니다. **분기 경로 부분만** 계산한 이상화된 비율입니다.

![두 혼합 워프의 가상 발행 명령 24개와 유형별로 분리한 워프의 12개를 비교하는 누적 막대](assets/wave-path-cost.svg)

*직접 제작한 수치 모형입니다. H 경로 8개와 L 경로 4개라는 가정에 따라 혼합 2 × (8+4)=24, 분리 8+4=12를 나타냅니다. 서로 다른 워프의 명령 발행 수를 합한 값이지 실제 GPU 실행 시간이나 FPS를 나타내지 않습니다.*

실제 GPU 성능에는 메모리 접근, 캐시, 분기·합류 비용, 레지스터 사용량, 컴파일러의 코드 변환, 다른 워프와의 병렬 실행이 영향을 줍니다. 특히 별개의 워프는 스케줄러에서 겹쳐 실행될 수 있으므로 **24 대 12를 곧장 2배 성능 향상으로 해석할 수 없습니다.** NVIDIA는 Volta 이후 독립 스레드 스케줄링도 설명하므로, 모든 GPU가 한 개의 고정된 프로그램 카운터로 움직인다고 일반화해서는 안 됩니다. [NVIDIA SIMT 가이드](https://docs.nvidia.com/cuda/archive/11.6.1/cuda-c-programming-guide/index.html#simt-architecture)

## HLSL 코드는 한쪽만 선택하도록 작성합니다

다음은 **실제 HLSL 컴퓨트 셰이더 문법으로 작성한 작은 예제**입니다. 호스트 애플리케이션에서 길이 64인 `Values`·`Kinds`·`Results` 버퍼를 바인딩하고 `Dispatch(2, 1, 1)`에 해당하는 두 그룹을 실행하는 구성을 전제합니다. 완성된 엔진 프로젝트나 GPU 성능 실측 코드는 아닙니다.

```hlsl
StructuredBuffer<float> Values : register(t0);
StructuredBuffer<uint> Kinds : register(t1);
RWStructuredBuffer<float> Results : register(u0);

[numthreads(32, 1, 1)]
void CSMain(uint3 dispatchId : SV_DispatchThreadID)
{
    uint i = dispatchId.x;
    float value = Values[i];

    if (Kinds[i] != 0u)
    {
        value = value * value + 0.25f;
        value = sqrt(value + 1.0f);
    }
    else
    {
        value = value * 0.75f;
    }

    Results[i] = value;
}
```

`Kinds`의 64개 값을 `1,0,1,0,...`처럼 배치하면 두 그룹 모두 조건이 섞입니다. `1`을 앞의 32개에, `0`을 뒤의 32개에 넣으면 각 그룹 안의 조건은 같습니다. 여기서 **그룹당 32스레드가 NVIDIA에서 한 워프를 구성한다는 가정**을 사용합니다. 다른 제조사나 다른 실행 너비에서는 같은 배치를 같은 단위라고 보장할 수 없습니다.

위 셰이더의 계산 자체는 두 배치에서 종류별로 동일합니다. 다만 종류를 재배열하려면 입력값·결과 인덱스의 대응 관계도 함께 바꾸거나 복원해야 합니다. 화면 픽셀을 임의로 정렬하는 것은 일반적으로 불가능하므로 **재정렬은 주로 입자 데이터나 컴퓨트 작업 목록처럼 순서를 제어할 수 있는 경우**에 검토합니다.

또한 소스의 두 계산 줄이 실제로 워프 명령 8개, 4개라는 뜻은 아닙니다. 그 숫자는 앞 절의 독립적인 산수 모델입니다. 컴파일러는 조건에 따라 분기를 없애거나, 조건부 실행으로 바꾸거나, 공통 연산을 합칠 수 있습니다.

## C++17로 배치에 따른 숫자를 검산해 봅니다

다음 코드는 GPU 성능을 흉내 낸 벤치마크가 아닌 **실행 가능한 C++17 계산 검증 코드**입니다. 각 워프에 H와 L이 하나라도 있으면 그 경로의 가상 명령 수를 더합니다.

```cpp
#include <array>
#include <cassert>
#include <iostream>

int CountIssued(const std::array<int, 64>& kinds) {
    constexpr int warpSize = 32;
    int issued = 0;

    for (int start = 0; start < 64; start += warpSize) {
        bool hasHeavy = false;
        bool hasLight = false;

        for (int i = start; i < start + warpSize; ++i) {
            hasHeavy |= (kinds[i] == 1);
            hasLight |= (kinds[i] == 0);
        }

        if (hasHeavy) issued += 8;
        if (hasLight) issued += 4;
    }
    return issued;
}

int main() {
    std::array<int, 64> mixed{};
    std::array<int, 64> grouped{};

    for (int i = 0; i < 64; ++i) {
        mixed[i] = (i % 2 == 0) ? 1 : 0;
        grouped[i] = (i < 32) ? 1 : 0;
    }

    assert(CountIssued(mixed) == 24);
    assert(CountIssued(grouped) == 12);

    std::cout << "mixed=" << CountIssued(mixed)
              << ", grouped=" << CountIssued(grouped) << '\n';
}
```

출력은 `mixed=24, grouped=12`입니다. 이 검사는 **두 경로가 실제 분기되어 각 워프에서 모두 실행된다는 조건부 모델**만 검증합니다. 드라이버·하드웨어에서 명령 수가 실제로 이렇게 나오는지를 검증한 결과는 아닙니다.

## 분기를 없애거나, 묶음을 바꾸거나, 그냥 두거나

조건문이 나쁘다고 일괄 결론내릴 수는 없습니다. 모든 레인이 같은 조건을 고르는 **일관된 분기(Uniform Branch)**는 불필요한 계산을 건너뛰는 데 유리할 수 있습니다. 한쪽 계산이 아주 가볍다면 반대로 양쪽을 계산하고 결과만 선택하는 **분기 평탄화(Branch Flattening)**가 더 나을 수도 있습니다.

Microsoft의 HLSL `if` 문서는 `[branch]`를 선택한 경로 평가, `[flatten]`을 양쪽 평가 후 선택이라는 컴파일 방식으로 설명합니다. 다만 이것은 모든 GPU에서의 속도 보증이 아니며, 일부 경사도 함수와 조합하면 컴파일 제약도 있습니다. 특히 픽셀 셰이더의 텍스처 미분은 분기 안에서 별도 주의를 요구합니다. [Microsoft HLSL if 문서](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-if)

입자·타일·컴퓨트 작업을 종류별로 묶으면 분기 발산을 줄일 가능성이 있지만, **정렬·버퍼 생성·추가 디스패치 비용**이 생기고 원래 인덱스를 복구해야 할 수도 있습니다. 작은 작업에서는 그 준비 비용이 절감액을 넘을 수 있습니다. AMD GPUOpen은 실제 RDNA 셰이더의 Wave32/Wave64 선택과 레지스터·점유율(Occupancy)의 관계도 설명합니다. [AMD GPUOpen](https://gpuopen.com/learn/occupancy-explained/)

측정할 때는 같은 장면·같은 데이터 개수로 분기 있는 버전, 평탄화 버전, 가능한 경우 분리 버전을 비교합니다. NVIDIA **Nsight Graphics Shader Profiler**에는 `Active Threads Per Warp`가 있으며, 활성화된 스레드 명령 수를 워프 명령 수와 관련지어 살펴볼 수 있습니다. 이 지표만 높다고 무조건 빠른 것은 아니므로 GPU 소요 시간과 함께 확인해야 합니다. [NVIDIA Nsight Graphics 공식 가이드](https://docs.nvidia.com/nsight-graphics/UserGuide/shader-profiler.html)

## 오늘 얻어갈 것

**GPU의 `if`가 항상 두 계산을 모든 픽셀에서 수행하는 것은 아닙니다.** 서로 다른 조건을 고른 스레드가 같은 워프에 섞여 있으면, 그 워프가 두 경로를 차례로 발행하는 비용이 생길 수 있다는 뜻입니다. 두 워프에서 H·L이 각각 16개씩 섞인 가상 예제는 발행 명령 24개였지만, H 32개와 L 32개로 묶자 12개가 됐습니다.

실제 게임에서는 셰이더의 분기 조건이 **같은 실행 묶음 안에서 얼마나 비슷한지** 먼저 살펴보세요. HLSL을 컴파일한 코드에서 분기가 남았는지 확인하고, Nsight Graphics 등의 프로파일러에서 활성 레인 비율과 실제 GPU 시간을 같이 비교하는 것이 좋습니다. 재정렬이 가능한 컴퓨트 작업이라면 그룹화 비용까지 합쳐 판단해야 합니다.

## 출처

- [NVIDIA — CUDA C++ Programming Guide 11.6.1, SIMT Architecture](https://docs.nvidia.com/cuda/archive/11.6.1/cuda-c-programming-guide/index.html#simt-architecture), 2022년 공개된 아카이브 설명, 2026-11-22 확인. 32스레드 워프, 분기 발산과 스케줄링 근거.
- [AMD GPUOpen — Occupancy explained](https://gpuopen.com/learn/occupancy-explained/), AMD 기술 해설, 2024년 게시, 2026-11-22 확인. RDNA의 Wave32/Wave64와 점유율 손익.
- [Microsoft Learn — if Statement (HLSL)](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-if), 공식 문서, 최종 갱신 표기 2021-08-19, 2026-11-22 확인. branch·flatten의 동작과 제약.
- [NVIDIA — Nsight Graphics Shader Profiler](https://docs.nvidia.com/nsight-graphics/UserGuide/shader-profiler.html), 공식 도구 문서, 2026-11-22 확인. Active Threads Per Warp 지표 설명.
