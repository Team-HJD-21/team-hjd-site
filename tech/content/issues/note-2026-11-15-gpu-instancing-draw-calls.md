# 같은 적 열 명인데 왜 그리기 명령도 열 번 보낼까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 화면의 적은 열 명인데

같은 외형의 적 열 명이 나란히 서 있습니다. 메시(Mesh)는 동일하고, 모두 같은 머티리얼(Material)을 사용합니다. 그런데 각 적의 위치만 다르다는 이유로 CPU가 GPU에 그리기 명령을 열 번 준비해야 할까요?

드로우 콜(Draw Call)은 CPU 쪽 렌더링 코드가 GPU에 특정 지오메트리를 그리도록 제출하는 작업을 뜻합니다. **GPU 인스턴싱(GPU Instancing)**은 같은 메시와 머티리얼을 여러 위치에 반복해서 그릴 때, 개별 객체를 한 번씩 제출하는 대신 여러 인스턴스(Instance, 같은 원본을 재사용한 개별 복제)를 묶어 제출하는 방법입니다. Unity 6.0의 [GPU Instancing 매뉴얼](https://docs.unity3d.com/6000.0/Documentation/Manual/GPUInstancing.html)도 여러 복사본을 적은 드로우 콜로 렌더링하는 용도로 설명합니다.

핵심은 **삼각형이 사라지는 최적화가 아니라, 반복되는 제출 비용을 줄이는 최적화**라는 점입니다.

## 열 개를 한 번에 묶는 작은 계산

다음은 **한 개의 메시, 한 개의 머티리얼, 열 개의 서로 다른 위치**라는 단순화한 상황입니다. 각 적의 월드 변환 행렬은 이동·회전·크기를 담는 4×4 행렬입니다.

| 구성 | 개별 제출 | 인스턴싱 제출 |
|---|---:|---:|
| 같은 메시를 사용하는 적 | 10개 | 10개 |
| 개념적인 그리기 명령 | 10번 | 1번 |
| GPU가 처리할 메시 복제 | 10개 | 10개 |
| 위치별 변환 정보 | 각각 전달 | 인스턴스별로 전달 |

![같은 메시 열 개를 개별 제출하는 경우와 하나의 인스턴싱 제출로 묶은 경우](assets/instancing-submissions.svg)

*직접 만든 개념도. 드로우 콜 10→1은 동일 패스·메시·머티리얼을 가정한 제출 구조 비교이며 실제 프레임의 측정 수치가 아닙니다. 근거: [Unity 6.0 GPU Instancing](https://docs.unity3d.com/6000.0/Documentation/Manual/GPUInstancing.html).*

예를 들어 인스턴스 하나의 변환을 단정밀도 실수 16개로 표현하면 행렬 데이터는 `16 × 4 = 64바이트`입니다. 열 개를 단순히 늘어놓으면 **640바이트**입니다. 이것은 행렬 배열 자체의 논리적 크기를 계산한 값일 뿐, 실제 드라이버 전송량이나 상수 버퍼의 정렬·패딩까지 측정한 수치가 아닙니다.

인스턴싱은 열 명에게 **같은 메시와 셰이더를 재사용하고, 각자 다른 행렬을 선택**하게 합니다. 따라서 드로우 콜이 줄었다고 해서 GPU의 정점 변환·픽셀 셰이딩 작업이 10분의 1로 줄어들지는 않습니다.

## 한 명만 머티리얼이 다르면 어떻게 될까요?

묶을 수 있는 조건이 중요합니다. 인스턴싱에서는 같은 메시뿐 아니라 **호환되는 셰이더·머티리얼 상태**도 공유해야 합니다. 열 명 중 여섯 명은 파란 머티리얼 A, 네 명은 빨간 머티리얼 B를 사용하면 단순한 구성에서는 두 그룹으로 나누어 제출합니다.

![같은 메시 열 개를 머티리얼 A 여섯 개와 B 네 개의 두 인스턴스 그룹으로 나누는 그림](assets/instancing-groups.svg)

*직접 만든 개념도. 이 예제의 여섯 개와 네 개는 각각 같은 머티리얼을 공유한다고 가정합니다. 두 그룹은 개념적인 제출 두 번이며 셰이더 패스·그림자 등에서 실제 명령 수는 달라질 수 있습니다.*

물론 색을 바꾸기 위해 언제나 머티리얼을 별도로 만들어야 하는 것은 아닙니다. 셰이더가 인스턴스별 색상 데이터를 읽도록 설계되어 있으면 **하나의 머티리얼을 공유하면서 색상만 달리**할 수 있습니다. 반면 머티리얼·메시가 다르거나 렌더 패스가 분리되면 하나로 뭉칠 수 없습니다.

또 하나의 손익이 있습니다. 인스턴싱한 오브젝트를 **그룹 단위로 컬링(Culling, 보이지 않는 대상을 그리지 않도록 제외하는 판정)**하면, 그룹 안의 적 일부만 카메라 밖에 나가더라도 전체 그룹에 대한 처리와 관리 비용이 생길 수 있습니다. Unity의 `Graphics.RenderMeshInstanced`는 기본적으로 인스턴스 전체의 경계(Bounds)를 계산하고 **하나의 단위로 컬링·정렬**한다고 명시합니다. [공식 API 설명](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Graphics.RenderMeshInstanced.html)을 참고해 주세요.

## Unity 6.0에서 열 개를 직접 그려 보기

다음 코드는 **Unity 6.0(6000.0) API 기준의 실제 C# 예제**입니다. 씬의 빈 GameObject에 붙이고, Inspector에서 하나의 `Mesh`와 **GPU 인스턴싱 지원 셰이더**를 사용하는 `Material`을 할당합니다. 행렬을 `Awake`에서 한 번 구성해 프레임마다 배열을 새로 만들지 않습니다.

```csharp
using UnityEngine;

public sealed class TenEnemyInstances : MonoBehaviour
{
    [SerializeField] private Mesh enemyMesh;
    [SerializeField] private Material enemyMaterial;

    private readonly Matrix4x4[] transforms = new Matrix4x4[10];

    private void Awake()
    {
        for (int i = 0; i < transforms.Length; i++)
        {
            Vector3 position = new Vector3(i * 1.5f, 0f, 5f);
            transforms[i] = Matrix4x4.TRS(
                position, Quaternion.identity, Vector3.one);
        }
    }

    private void Update()
    {
        if (enemyMesh == null || enemyMaterial == null ||
            !SystemInfo.supportsInstancing || !enemyMaterial.enableInstancing)
            return;

        RenderParams parameters = new RenderParams(enemyMaterial);
        Graphics.RenderMeshInstanced(
            parameters, enemyMesh, 0, transforms);
    }
}
```

`RenderParams`는 렌더링할 머티리얼 등의 공통 설정을 담습니다. `0`은 첫 번째 서브메시 인덱스이며, `transforms`에 들어 있는 열 개의 행렬이 각 인스턴스의 위치를 지정합니다. 이 메서드는 현재 프레임을 위한 렌더 요청이므로 `Update`에서 매 프레임 호출합니다. 게임 오브젝트 열 개를 생성하는 예제가 아니라, **한 번 만든 메시 데이터의 열 가지 배치**를 제출하는 예제입니다. API 시그니처와 배열 입력은 [`Graphics.RenderMeshInstanced` 공식 문서](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Graphics.RenderMeshInstanced.html)에서 확인할 수 있습니다.

재질의 인스턴싱 설정과 셰이더 변형(Variant)이 지원되지 않으면 그려지지 않거나 기대한 묶음이 나오지 않을 수 있습니다. 실제 프로젝트에서 오브젝트별 그림자·조명·애니메이션·가시성에 필요한 값이 더 많다면 위 코드가 그대로 전체 렌더링 시스템을 대체하는 것은 아닙니다. 특히 `SkinnedMeshRenderer`의 일반적인 자동 인스턴싱은 별도 제약이 있습니다.

## 드로우 콜 숫자만 보면 놓치는 것

Unity의 **SRP Batcher**는 셰이더·머티리얼 상태 변경을 효율화하는 또 다른 CPU 최적화입니다. URP/HDRP에서는 자동 GPU 인스턴싱보다 SRP Batcher 경로가 우선될 수 있어, 머티리얼에 인스턴싱 옵션을 켰다고 **모든 오브젝트가 자동으로 인스턴싱되는 것은 아닙니다**. 명시적으로 `Graphics.RenderMeshInstanced`를 사용한 예제와 일반 `MeshRenderer`들의 자동 최적화는 구분해야 합니다. Unity 6.0 [GPU Instancing 매뉴얼](https://docs.unity3d.com/6000.0/Documentation/Manual/GPUInstancing.html)의 렌더 파이프라인 호환성 항목이 이 차이를 설명합니다.

판단 순서는 이렇습니다. 먼저 **Frame Debugger에서 인스턴스 묶음과 렌더 패스**를 확인하고, **Profiler에서 CPU 렌더링 비용**을 비교합니다. 이후 GPU 시간도 따로 살펴봅니다. 드로우 콜 수가 감소했어도 행렬·속성 업로드, 컬링 손실, GPU 정점·픽셀 처리 때문에 전체 프레임 시간이 개선되지 않을 수 있습니다. 특히 가벼운 메시와 적은 개수에서는 인스턴싱 준비 비용이 이득을 넘을 수도 있습니다.

## 오늘 얻어갈 것

적 열 명이 같은 메시와 머티리얼을 쓰면서 위치만 다르다면, **GPU 인스턴싱으로 공통 그리기 명령에 열 개의 변환 정보를 실어** 제출 비용을 줄일 수 있습니다. 다만 삼각형을 한 번만 그리는 것은 아니며, 실제 성능 향상 배율도 위의 10→1 계산과 다릅니다.

프로젝트에서 확인할 세 지점은 **같은 메시·머티리얼이 정말 공유되는지**, **Frame Debugger의 드로우 이벤트가 인스턴싱으로 묶이는지**, **Profiler의 CPU·GPU 시간이 함께 개선되는지**입니다. 여러 개의 머티리얼과 그룹 단위 컬링을 고려하여, 필요하다면 일반 렌더링·SRP Batcher와 비교 측정하는 것이 좋겠습니다.

## 출처

- [Unity 6.0 (6000.0), Introduction to GPU instancing](https://docs.unity3d.com/6000.0/Documentation/Manual/GPUInstancing.html) — 기본 원리·호환성과 비용, 2026-11-15 확인.
- [Unity 6.0 (6000.0), Graphics.RenderMeshInstanced](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Graphics.RenderMeshInstanced.html) — 실제 API와 그룹 경계 판정, 2026-11-15 확인.
