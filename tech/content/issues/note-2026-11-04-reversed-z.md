# 멀리 있는 두 면은 왜 같은 깊이가 될까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 1km 앞의 1cm를 구분할 수 있을까요?

카메라 앞 1km 지점에 벽이 있고, 그 뒤 1cm 지점에 다른 벽이 있다고 해 보겠습니다. 두 벽이 같은 화면 위치에 겹친다면 앞쪽 벽이 보여야 합니다. 그런데 렌더러가 두 벽의 깊이를 같은 숫자로 저장한다면 어떨까요? 어느 쪽이 앞인지 판단할 정보부터 부족해집니다.

오늘의 질문은 이것입니다. **깊이를 저장하는 방향만 뒤집어서, 멀리 있는 두 면을 더 잘 구분할 수 있을까요?** 반전 깊이(Reversed-Z)는 이 질문에 답하는 기법입니다. 먼저 저장되는 숫자를 직접 계산하고, 실제 렌더러에서 함께 바꿔야 할 설정까지 이어가 보겠습니다.

## 깊이 버퍼에는 미터 단위 거리가 들어가지 않습니다

깊이 버퍼(Depth Buffer)는 화면의 각 픽셀 위치에서 앞뒤를 비교할 깊이 값을 보관합니다. 원근 투영(Perspective Projection)에서는 카메라 앞의 깊이 $z$를 그대로 저장하지 않고, 보통 $d=a/z+b$ 형태로 바꿉니다. 여기서 $z$는 **카메라의 시선 축을 따라 잰 양의 깊이**입니다. 카메라에서 점까지의 직선거리와는 다릅니다. 이 관계는 원근 나눗셈에서 나오며, Nathan Reed의 [2015년 원문 설명](https://www.reedbeta.com/blog/depth-precision-visualized/)에서 유도 과정을 확인할 수 있습니다.

기호를 줄이기 위해 가까운 절단면(Near Plane)을 $n=0.1\,\mathrm{m}$로 놓고, 먼 절단면(Far Plane)이 무한히 먼 원근 투영을 가정하겠습니다. 깊이 범위는 0부터 1입니다. 이 조건에서는 다음 두 식을 비교할 수 있습니다.

$$
d_{\mathrm{ordinary}}=1-\frac{n}{z},\qquad
d_{\mathrm{reversed}}=\frac{n}{z}
$$

일반 깊이는 가까운 절단면에서 0이고, 멀어질수록 1에 다가갑니다. 반전 깊이는 가까운 절단면에서 1이고, 멀어질수록 0에 다가갑니다. 아래 표는 이 식에 깊이를 직접 대입한 결과입니다.

![near 0.1m와 무한 far 조건에서 깊이 0.1m, 1m, 10m, 100m, 1000m를 일반 깊이와 반전 깊이로 바꾼 대응표](assets/depth-mapping.png)

*직접 만든 개념도입니다. 두 식을 같은 깊이에 대입해 비교했습니다. 1/z 대응의 근거는 [Depth Precision Visualized](https://www.reedbeta.com/blog/depth-precision-visualized/)이며, 표의 수치는 별도로 계산했습니다.*

아직은 $1-d$로 바꾸었을 뿐입니다. 실수 값을 무한히 정확하게 보관할 수 있다면 두 방식은 같은 앞뒤 정보를 담습니다. 차이가 생기는 지점은 **유한한 비트 수에 값을 저장할 때**입니다.

## float32에 한 번 저장해 보겠습니다

32비트 부동소수점(Float32)은 모든 구간에서 숫자 사이 간격이 같지 않습니다. 0에 가까운 작은 양수 구간에는 더 촘촘한 표현값이 있습니다. Reversed-Z는 원근 깊이의 먼 영역을 이 구간으로 보냅니다. 이 분포와 $1/z$의 조합이 부동소수점 깊이에서 이득을 만드는 이유입니다. 단순히 모든 거리에서 같은 미터 간격을 확보한다는 뜻은 아닙니다. [Khronos의 원문 규격](https://registry.khronos.org/OpenGL/extensions/ARB/ARB_clip_control.txt)도 부동소수점 깊이와 반전된 near/far 대응을 함께 설명합니다.

이제 처음의 두 벽으로 돌아오겠습니다. $z_A=1000.00\,\mathrm{m}$, $z_B=1000.01\,\mathrm{m}$를 앞의 식에 넣고, 결과를 float32로 한 번 반올림해 저장했습니다.

![1000.00m와 1000.01m의 두 평면을 float32에 저장하면 일반 깊이는 같은 비트 값이 되고 반전 깊이는 서로 다른 비트 값이 되는 비교](assets/depth-rounding.png)

*직접 만든 계산 결과입니다. 그림의 소수는 소수점 아래 13자리로 표시했으며, 같은 값인지 여부는 실제 32비트를 비교했습니다. GPU 실측이 아니라 저장 양자화만 분리한 예시입니다. float32 변환은 [Python struct의 f 형식](https://docs.python.org/3/library/struct.html)을 사용했습니다.*

일반 깊이는 두 값이 모두 `0x3f7ff972`로 저장됩니다. 반전 깊이는 앞쪽 벽이 `0x38d1b717`, 뒤쪽 벽이 `0x38d1b68e`로 남습니다. 소수점 표시 자릿수를 줄여서 같아 보이는 현상이 아닙니다. 전자는 실제 저장 비트가 같고, 후자는 다릅니다.

다음은 직접 실행할 수 있는 **Python 코드**입니다. 엔진 API나 의사 코드가 아닙니다. `f` 형식은 IEEE 754 binary32, `I` 형식은 그 비트를 확인하기 위한 부호 없는 32비트 정수 표현으로 사용했습니다. [형식의 공식 정의](https://docs.python.org/3/library/struct.html#format-characters)를 참고하시면 됩니다.

```python
import struct

def stored_bits(value):
    return struct.unpack("<I", struct.pack("<f", value))[0]

near = 0.1
depths = (1000.00, 1000.01)

ordinary = [stored_bits(1.0 - near / z) for z in depths]
reversed_z = [stored_bits(near / z) for z in depths]

print("ordinary:", [f"0x{v:08x}" for v in ordinary])
print("reversed:", [f"0x{v:08x}" for v in reversed_z])
print("same:", ordinary[0] == ordinary[1],
      reversed_z[0] == reversed_z[1])
```

```text
ordinary: ['0x3f7ff972', '0x3f7ff972']
reversed: ['0x38d1b717', '0x38d1b68e']
same: True False
```

이 계산에서는 Python의 계산 결과를 마지막에 float32로 저장했습니다. 실제 GPU의 정점 변환, 보간, 래스터화 과정은 재현하지 않았습니다. 따라서 “실제 게임에서 1km 앞의 모든 1cm 차이가 반드시 보존된다”는 보장은 아닙니다. **같은 입력 깊이와 같은 저장 형식에서도, 대응 방식을 바꾸면 두 값이 합쳐지는 결과가 달라진다**는 점을 확인한 것입니다.

이미 같은 값으로 저장된 두 깊이에 나중에 `1 - depth`를 적용해도 잃은 차이가 돌아오지는 않습니다. 두 입력이 같은 숫자가 된 뒤에는 같은 계산을 거쳐 같은 결과가 나오기 때문입니다.

## 투영 행렬과 깊이 비교를 함께 바꿉니다

실제 구현에서는 깊이를 생성하는 단계부터 반전된 대응을 사용합니다. Microsoft는 [XMMatrixPerspectiveFovLH](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmmatrixperspectivefovlh) 문서에서 `NearZ`와 `FarZ`에 넘기는 값을 뒤집으면 반전 깊이를 만들 수 있다고 설명합니다. 두 인수는 모두 양수여야 하며 같으면 안 됩니다. 문서 갱신일은 2024년 2월 22일입니다.

다음은 **DirectXMath의 실제 API 호출 예시**입니다. 앞의 숫자 실험과 달리 먼 절단면이 유한합니다. `nearDistance`와 `farDistance`는 장면에서 의도한 물리적 거리이고, 호출할 때 두 거리의 순서를 뒤집습니다.

```cpp
// DirectXMath: left-handed, finite far plane.
const float nearDistance = 0.1f;
const float farDistance = 10000.0f;

const auto projection = DirectX::XMMatrixPerspectiveFovLH(
    fovYRadians, aspectRatio, farDistance, nearDistance);
```

여기까지 바꾸면 가까운 물체의 깊이 값이 더 커집니다. 따라서 앞쪽을 선택하는 비교도 그 뜻에 맞아야 합니다. 아래는 흔한 불투명 패스의 기본 설정을 비교한 표입니다. 같은 깊이를 허용하는지 여부는 프리패스 등 실제 패스의 의도에 따라 결정합니다.

| 확인할 설정 | 일반 깊이 | 반전 깊이 |
| --- | --- | --- |
| 가까운 면의 값 | 0 | 1 |
| 먼 쪽의 값 | 1 또는 1에 가까운 값 | 0 또는 0에 가까운 값 |
| 버퍼 초기화 값 | 1 | 0 |
| 더 가까운 값을 통과시키는 비교 | `LESS` 계열 | `GREATER` 계열 |

이 표는 0~1 깊이 범위의 대응에서 도출한 설정입니다. [Khronos 규격](https://registry.khronos.org/OpenGL/extensions/ARB/ARB_clip_control.txt)도 깊이 방향을 뒤집을 때 비교 함수를 함께 바꾸도록 설명합니다. 한편 OpenGL의 기본 투영 후 깊이 범위는 -1~1입니다. 해당 기능을 지원하는 환경에서는 `glClipControl(GL_LOWER_LEFT, GL_ZERO_TO_ONE)`과 그에 맞는 투영 행렬을 함께 검토해야 합니다. DirectX용 행렬 호출을 다른 API에 그대로 옮겼다고 가정하지 않는 편이 좋습니다.

## 깊이를 읽는 코드도 같은 뜻으로 읽어야 합니다

설정 몇 개를 바꾼 뒤 장면이 보인다고 전환을 끝내기 쉽습니다. 하지만 깊이를 다시 거리로 바꾸는 코드도 살펴봐야 합니다. 오늘 사용한 무한 far 예시만 보더라도 역변환은 서로 다릅니다.

$$
z_{\mathrm{ordinary}}=\frac{n}{1-d},\qquad
z_{\mathrm{reversed}}=\frac{n}{d}
$$

반전 깊이에서 $d=0.0001$을 읽었다면 $z=1000\,\mathrm{m}$입니다. 여기에 일반 깊이용 역변환을 잘못 쓰면 약 $0.10001\,\mathrm{m}$가 됩니다. 안개처럼 깊이로 강도를 정하는 효과에 이 값이 들어간다면, 화면은 떠 있어도 효과의 의미는 어긋나겠지요. 이 숫자 역시 위 식에 직접 대입한 계산입니다. 유한 far를 쓰는 실제 엔진에서는 그 엔진의 투영 행렬과 깊이 복원 함수를 따라야 합니다.

그래서 전환을 검토할 때는 깊이 값을 만드는 곳과 소비하는 곳을 한 쌍으로 찾아보는 편이 좋습니다. 다음 순서로 작은 테스트 장면을 살펴보겠습니다.

1. **저장 형식부터 확인합니다.** 부동소수점 깊이인지, 정규화된 정수 깊이인지 구분합니다. 오늘 확인한 저장 간격의 이득을 정수 형식에 그대로 대입하지 않습니다.
2. **같은 픽셀을 두 면이 덮게 만듭니다.** 카메라와 면의 위치를 고정하고, 캡처 도구에서 깊이 형식·초기화 값·비교 상태를 함께 확인합니다.
3. **깊이 복원 결과를 표시합니다.** 셰이더에서 복원한 시선 축 깊이가 실제 테스트 장면의 값과 맞는지 확인합니다. 화면 효과가 있는 장면은 이 확인 뒤에 붙입니다.
4. **문제가 저장 전인지 살펴봅니다.** 월드 좌표나 정점 변환 단계에서 두 위치가 이미 구분되지 않는다면, 깊이 버퍼만 바꿔서는 해결할 수 없습니다.

이는 특정 엔진의 내부 동작을 단정한 목록이 아니라, 오늘의 예제로부터 구성한 점검 순서입니다. 처음부터 큰 장면의 깜빡임을 전부 설명하려 하기보다, 입력·저장·복원 중 어디에서 차이를 잃는지 좁혀 볼 수 있습니다.

## 오래된 발표에서도 구현의 손익을 볼 수 있습니다

이 기법을 실제 게임의 선택과 연결해서 보고 싶다면 Emil Persson의 **SIGGRAPH 2012 발표 자료 [Creating Vast Game Worlds](https://www.humus.name/Articles/Persson_CreatingVastGameWorlds.pdf)** 중 14쪽을 추천합니다. Avalanche Studios가 큰 게임 월드의 깊이 정밀도를 다룬 부분입니다. 발표자는 반전 깊이를 사용한 경험과 함께, PC에서는 스텐실과 형식 선택을 고려해 24비트 고정소수점 깊이를 사용했다고 설명합니다.

여기서 배울 점은 “반전하면 언제나 같은 결과를 얻는다”는 결론이 아닙니다. 발표는 **저장 형식의 정밀도와 변환 과정의 오차를 따로 살펴볼 필요**를 보여 줍니다. 정수 깊이는 저장값 간격이 균일하므로 오늘의 float32 예시와 같은 이유로 이득이 생기지는 않습니다. 그렇다고 실제 변환 과정에서도 개선이 전혀 없다고 단정할 수는 없습니다. 발표자는 그 차이도 다룹니다.

이 자료는 발표자가 공개한 원본 슬라이드 PDF입니다. 오늘의 두 그림은 그 슬라이드를 복사한 이미지가 아니라, 위의 조건과 숫자로 새로 만든 설명용 도식입니다.

## 오늘 얻어갈 것

처음 질문의 답은 **“부동소수점 깊이를 쓸 때, 깊이 대응을 뒤집으면 멀리 있는 두 면을 더 잘 구분할 수 있습니다”**입니다. 오늘의 계산에서는 일반 깊이가 1km 앞의 두 면을 같은 float32 값으로 저장했고, Reversed-Z는 서로 다른 값으로 남겼습니다. 핵심은 비트를 추가하는 것이 아니라, 표현 가능한 값의 분포와 원근 깊이의 대응을 맞추는 데 있습니다.

코드에서 가져갈 확인 지점도 분명합니다. **깊이 저장 형식 → 투영 행렬 → 초기화와 비교 → 깊이 복원**을 연결해서 읽어 보세요. 특히 렌더러에 `1 - depth`가 있다는 사실만으로 Reversed-Z를 올바르게 쓰고 있다고 판단하지 마세요. 어느 단계의 깊이를 뒤집는지, 그전에 이미 차이를 잃었는지 확인해야 합니다.

완전히 겹친 면이나 저장 이전의 좌표 정밀도 문제까지 이 기법 하나로 해결되지는 않습니다. 작은 장면에서 입력과 저장 비트, 복원된 깊이를 함께 비교하는 습관이 다음 디버깅에도 남는 도구가 됩니다.

## 출처

- Nathan Reed, [Depth Precision Visualized](https://www.reedbeta.com/blog/depth-precision-visualized/), 2015-07-03. 원근 깊이 대응과 정밀도 설명의 원문입니다.
- Microsoft, [XMMatrixPerspectiveFovLH function](https://learn.microsoft.com/en-us/windows/win32/api/directxmath/nf-directxmath-xmmatrixperspectivefovlh), 문서 갱신 2024-02-22. 실제 API의 반전 near/far 인수와 조건을 확인했습니다.
- Khronos, [ARB_clip_control](https://registry.khronos.org/OpenGL/extensions/ARB/ARB_clip_control.txt), ARB 승인 2014-06-26, 규격 수정 2018-04-06. 깊이 범위·부동소수점 정밀도·비교 방향의 근거입니다.
- Emil Persson, [Creating Vast Game Worlds — Experiences from Avalanche Studios](https://www.humus.name/Articles/Persson_CreatingVastGameWorlds.pdf), SIGGRAPH 2012, 14쪽. 실제 게임의 깊이 형식과 반전 깊이 적용 경험입니다.
- Python Software Foundation, [struct — Interpret bytes as packed binary data](https://docs.python.org/3/library/struct.html). 위 재현 코드의 binary32 저장 형식을 확인했습니다.

자료와 수치 확인: 2026-11-03. 별도의 GPU 성능 측정이나 특정 엔진 버전의 내부 구현 검증을 수행한 글은 아닙니다.
