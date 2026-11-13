# 멀리 있는 바닥 무늬는 왜 깜빡일까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 멀어질수록 무늬가 흔들리는 이유

게임에서 촘촘한 체크무늬 바닥을 카메라로 멀리서 바라보면, 분명히 멈춰 있는 무늬가 움직이거나 반짝이는 것처럼 보일 때가 있습니다. 원본 텍스처가 선명한데 왜 화면은 불안정할까요?

원인은 **축소 샘플링(minification)**에 있습니다. 카메라에서 멀어진 표면은 화면의 한 픽셀(pixel)에 원본 텍스처의 여러 텍셀(texel, 텍스처를 이루는 개별 화소)을 욱여넣습니다. 그런데 그 많은 텍셀 중 한 점이나 너무 작은 범위만 읽으면, 카메라가 조금 움직였을 때 전혀 다른 색을 집어 올 수 있습니다. 이를 **에일리어싱(aliasing)**이라고 합니다.

텍스처 좌표(UV)는 표면의 어느 위치에서 텍스처를 읽을지 나타내는 보통 0~1 범위의 좌표입니다. 화면 픽셀의 UV가 조금 달라지는 것만으로도 원본 텍스처에서는 여러 텍셀을 건너뛸 수 있습니다.

## 한 화면 픽셀이 텍셀 몇 개를 차지할까요?

가로·세로 **1,024×1,024 텍스처**를 떠올려 보겠습니다. 화면에서 오른쪽으로 한 픽셀 이동할 때 UV가 `(1/128, 0)`, 아래로 한 픽셀 이동할 때 `(0, 1/128)` 변한다고 가정합니다. 두 방향이 직각인 단순한 예제입니다.

UV 단위는 텍스처 전체의 비율이므로, 텍셀 단위 변화량은 각 축에 1,024를 곱해서 구합니다.

- 가로 방향: `1,024 × (1/128) = 8` 텍셀
- 세로 방향: `1,024 × (1/128) = 8` 텍셀
- 따라서 화면 한 픽셀이 보는 영역은 이 예제에서 대략 `8×8 = 64`개의 원본 텍셀에 대응합니다.

![한 화면 픽셀이 8×8 체크무늬 텍셀을 덮는 개념도와 평균 색 비교](assets/pixel-footprint.svg)

*직접 만든 개념도. 왼쪽의 흑백 8×8 텍셀은 화면 1픽셀에 대응하는 단순한 정사각형 영역이며, 오른쪽 회색은 32개의 밝은 텍셀과 32개의 어두운 텍셀을 평균 낸 값 0.5입니다. 실제 GPU의 필터 발자국은 표면 방향에 따라 기울거나 길쭉해질 수 있습니다.*

가령 흑백이 번갈아 나타나는 8×8 체크무늬라면 그중 한 점만 읽어 0 또는 1을 결정하는 것은 무척 불안정합니다. 영역 전체의 평균은 `(32×0 + 32×1)/64 = 0.5`이지만, 매번 원본의 한 점만 뽑으면 0과 1 사이를 오가며 깜빡일 수 있습니다. 바로 이 때문에 **미리 축소한 텍스처**가 필요합니다.

## 밉맵은 왜 피라미드일까요?

**밉맵(mipmap)**은 원본을 단계적으로 미리 축소·필터링한 텍스처들의 묶음입니다. 가장 높은 해상도인 레벨 0에서 시작해 레벨이 1 높아질 때마다 가로와 세로 해상도가 일반적으로 절반이 됩니다. 이 발상은 Lance Williams가 1983년 SIGGRAPH 논문 *Pyramidal Parametrics*에서 체계적으로 제안한 사전 필터링 접근과 맞닿아 있습니다.

![밉 레벨 0에서 3까지 텍스처 크기가 1024, 512, 256, 128로 줄어드는 도식](assets/mipmap-pyramid.svg)

*직접 만든 밉맵 피라미드 개념도. 1,024×1,024 원본에서 레벨 1은 512×512, 레벨 2는 256×256, 레벨 3은 128×128이 됩니다. 실제 전체 체인은 1×1까지 이어질 수 있습니다. 근거: [Unity 공식 Mipmaps 문서](https://docs.unity.com/en-us/engine/6000.5/manual/materials-and-shaders/textures/textures-getting-started/texture-mipmaps-introduction).*

오늘의 예제는 원본에서 8텍셀씩 묶어 대표 색을 얻어야 하므로, 가로와 세로가 8분의 1인 **레벨 3**이 자연스러운 출발점입니다.

```text
원본 1024×1024  →  level 0
       512×512  →  level 1
       256×256  →  level 2
       128×128  →  level 3 (원본의 8분의 1)
```

완전한 2D 밉 체인을 만들면 각 레벨의 텍셀 수는 이전의 약 1/4이므로, 메모리 합계는 원본의 약 `1 + 1/4 + 1/16 + … ≈ 4/3`입니다. 압축 형식·패딩·작은 레벨의 저장 방식에 따라 실제 바이트 수는 달라질 수 있습니다. 밉맵이 공짜는 아니지만, 실시간으로 넓은 영역의 원본 텍셀을 매번 직접 평균 내는 부담을 사전에 옮겨 놓는 셈입니다. [Unity 6.5 문서](https://docs.unity.com/en-us/engine/6000.5/manual/materials-and-shaders/textures/textures-getting-started/texture-mipmaps-introduction)는 이 저장 공간 증가와 축소 시의 화면 품질 이점을 함께 안내합니다.

## GPU는 레벨 3을 어떻게 알아낼까요?

화면의 인접 픽셀 사이에서 UV가 얼마나 변하는지를 알려주는 **화면 공간 미분(screen-space derivatives)**을 사용합니다. HLSL의 `ddx(uv)`와 `ddy(uv)`는 픽셀 셰이더에서 가로·세로 방향의 UV 변화량을 구합니다.

여기서는 설명을 위해 각 방향의 변화량을 텍셀 단위로 바꾼 후, 두 벡터 길이 중 큰 값을 `ρ`라고 놓겠습니다.

```text
dx = (1/128, 0) × (1024, 1024) = (8, 0)
dy = (0, 1/128) × (1024, 1024) = (0, 8)

ρ = max(length(dx), length(dy)) = 8
LOD = log2(ρ) = log2(8) = 3
```

여기서 **세부 수준(LOD, Level of Detail)**은 읽을 밉 레벨의 추정값입니다. 실제 하드웨어의 레벨 선택은 샘플러 필터·바이어스·이방성 필터링·셰이더 명령에 따라 달라집니다. 위 계산은 동작을 이해하기 위한 일반적인 등방성 근사이지 모든 GPU가 똑같이 수행한다는 보장은 아닙니다.

다음은 **HLSL 픽셀 셰이더에서 사용할 수 있는 실제 문법의 함수**입니다. 엔진 전체에 바로 붙여 넣는 완성 셰이더가 아니라, 픽셀 단계의 UV와 텍스처 크기를 받는 보조 함수입니다.

```hlsl
float EstimateIsotropicLod(float2 uv, float2 textureSize)
{
    float2 dxTexel = ddx(uv) * textureSize;
    float2 dyTexel = ddy(uv) * textureSize;
    float footprint = max(length(dxTexel), length(dyTexel));

    return log2(max(footprint, 1e-8));
}
```

`ddx`와 `ddy`는 픽셀 셰이더에서 사용하는 함수입니다. 호출 결과가 분기마다 달라지는 영역에서는 미분이 기대대로 계산되지 않을 수 있으므로, 일반 텍스처 읽기는 가능한 한 GPU의 보통 샘플링 경로에 맡기는 편이 안전합니다. Microsoft의 [HLSL ddx 문서](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-ddx)와 [SampleGrad 문서](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-samplegrad)가 미분 및 명시적 기울기 샘플링을 설명합니다.

필터의 종류도 구분해야 합니다. **이중 선형 필터링(bilinear filtering)**은 한 밉 레벨 안의 이웃 텍셀을 섞습니다. **삼중 선형 필터링(trilinear filtering)**은 두 밉 레벨 사이도 보간해 레벨 경계를 덜 눈에 띄게 합니다. 바닥을 비스듬히 바라볼 때처럼 픽셀 영역이 길쭉하면 **이방성 필터링(anisotropic filtering)**이 흐림과 세부 표현의 손익을 조절하는 데 도움이 됩니다. 밉맵만 켰다고 모든 경사면이 선명해지는 것은 아닙니다.

## 실제 프로젝트에서는 무엇을 고를까요?

Unity 6.5 기준으로 3D 바닥 텍스처의 Import Settings에서 밉맵 생성을 확인하고, 거리에 따른 깜빡임을 관찰해 보세요. `Filter Mode`의 Trilinear와 이방성 설정을 바꾸어 비교할 수 있습니다. 과도한 음수 mip bias로 먼 거리를 억지로 날카롭게 만들면 다시 에일리어싱이 드러날 수 있습니다. [Unity 텍스처 설정 문서](https://docs.unity.com/en-us/engine/6000.5/manual/materials-and-shaders/textures/textures-reference)와 [밉맵 문서](https://docs.unity.com/en-us/engine/6000.5/manual/materials-and-shaders/textures/textures-getting-started/texture-mipmaps-introduction)를 기준으로 옵션을 확인하면 좋습니다.

반대로 화면에 거의 항상 원본 크기로만 표시되는 UI나 일부 의도적인 픽셀아트에는 밉맵이 필요하지 않을 수 있습니다. 목적은 모든 텍스처를 흐리게 만드는 것이 아니라, **화면 픽셀이 실제로 대표해야 할 영역을 알맞게 샘플링**하는 것입니다.

실험할 때는 같은 카메라 경로를 녹화해 밉맵 생성 전후의 깜빡임과 멀리 있는 무늬의 선명도를 비교해 보세요. GPU 캡처 도구에서는 바인딩된 텍스처의 밉 체인, 샘플러 설정, 픽셀 셰이더의 텍스처 샘플 명령을 살펴봅니다. 이 글의 8×8 예제만으로 특정 게임의 성능 향상이나 GPU 내부의 정확한 샘플 수를 예측하지는 않습니다.

## 오늘 얻어갈 것

멀리 있는 바닥이 깜빡이는 것은 원본 텍스처의 화질이 나빠서가 아니라, **한 화면 픽셀이 대표해야 할 여러 텍셀을 충분히 필터링하지 못하는 축소 샘플링 문제**일 수 있습니다. 오늘의 예제에서는 화면 한 픽셀이 원본의 8×8 텍셀을 덮었고, `log2(8)=3`으로 밉 레벨 3을 선택하는 이유를 계산했습니다.

코드에서는 `ddx`·`ddy`로 UV의 변화량을 확인하고, 엔진에서는 밉맵 생성·삼중 선형 필터링·이방성 설정을 비교해 보세요. 캡처 도구에서 샘플러와 실제 밉 체인을 살피면, 멀리 있는 패턴이 왜 흔들리는지 한층 구체적으로 좁혀 갈 수 있습니다.

## 출처

- Lance Williams, [*Pyramidal Parametrics*](https://dl.acm.org/doi/10.1145/800059.801126), SIGGRAPH 1983, pp. 1–11.
- Unity Technologies, [Mipmaps — Unity Editor 6000.5](https://docs.unity.com/en-us/engine/6000.5/manual/materials-and-shaders/textures/textures-getting-started/texture-mipmaps-introduction), 2026년 문서 확인.
- Unity Technologies, [Textures reference — Unity Editor 6000.5](https://docs.unity.com/en-us/engine/6000.5/manual/materials-and-shaders/textures/textures-reference).
- Microsoft, [HLSL ddx](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-ddx), [SampleGrad](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-samplegrad).
