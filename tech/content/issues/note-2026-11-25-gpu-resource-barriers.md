# GPU가 그릴 개수를 계산했는데 왜 바로 그리면 안 될까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## CPU가 모르는 개수로 그림을 그려 봅시다

입자 8개 중 카메라에 보이는 입자만 그리려고 합니다. 컴퓨트 셰이더(Compute Shader)가 검사한 결과는 5개입니다. CPU로 이 숫자를 돌려받지 않고 GPU가 직접 그리기 명령의 인자로 사용하면 어떨까요?

이것이 간접 그리기(Indirect Drawing)의 기본 아이디어입니다. CPU는 명령의 형식을 미리 정하고, 실제 그리기에 사용할 인자는 GPU 메모리에서 읽습니다. Direct3D 12의 `ExecuteIndirect`가 이런 일을 합니다. 그런데 계산 명령 다음에 그리기 명령을 기록하는 것만으로는 충분하지 않습니다. 같은 버퍼를 쓰는 작업과 읽는 작업 사이에 어떤 의존성이 있는지 GPU에 알려 줘야 합니다.

오늘은 CPU가 GPU 결과를 기다리는 문제가 아니라, GPU 내부의 생산자와 소비자 사이의 동기화를 살펴보겠습니다. Direct3D 11에서는 드라이버가 리소스 사용 상태를 추적하던 일을 Direct3D 12에서는 애플리케이션이 더 명시적으로 책임집니다. [Microsoft의 리소스 상태 문서](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12)를 기준으로 기존 ResourceBarrier API를 다룹니다.

## 명령 기록 순서와 메모리 사용 조건

리소스(Resource)는 GPU가 접근하는 버퍼나 텍스처입니다. 리소스 상태(Resource State)는 해당 리소스를 어떤 용도로 접근할 수 있는지 표현합니다. 컴퓨트 셰이더에서 쓰는 버퍼는 비순차 접근 뷰(Unordered Access View, UAV)로 바인딩할 수 있고, 이때 사용하는 상태는 `D3D12_RESOURCE_STATE_UNORDERED_ACCESS`입니다.

반면 간접 명령을 해석하는 단계는 같은 버퍼를 `D3D12_RESOURCE_STATE_INDIRECT_ARGUMENT` 상태에서 사용해야 합니다. 두 사용법은 서로 다릅니다. 셰이더가 쓰는 중에 다음 작업이 그 데이터를 읽어서는 안 됩니다. 앞서 기록된 작업의 모든 메모리 접근이 후속 작업에 대해 자동으로 완료되고 보인다고 가정할 수 없기 때문입니다.

이처럼 쓰기 이후 읽기(Read After Write, RAW)가 필요한 관계를 리소스 배리어(Resource Barrier)로 표현합니다. 이번에는 상태도 달라지므로 전이 배리어(Transition Barrier)를 사용합니다. 이것은 CPU가 GPU 전체가 끝날 때까지 기다리는 명령이 아닙니다. GPU 작업 사이에서 필요한 사용 전환과 동기화를 지정합니다. 실제 내부 캐시 처리와 기다림의 범위는 하드웨어와 드라이버에 따라 달라집니다.

![컴퓨트 쓰기에서 전이 배리어를 거쳐 간접 그리기 읽기로 연결되는 동일 GPU 큐의 리소스 사용 순서](assets/resource-transition.svg)

*직접 제작한 개념도. 같은 DIRECT 큐에서 명령을 기록하는 순서를 표시합니다. 상자의 폭은 GPU 시간이나 실제 병렬 실행 구간을 뜻하지 않습니다. 근거: [Microsoft ResourceBarrier 문서](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12).*

## 8개 입자에서 5개를 그리는 16바이트

입자 하나를 삼각형 한 개로 그린다고 가정합니다. 카메라 검사 결과를 1과 0으로 표시하면 다음과 같습니다.

```text
입자 ID:  0 1 2 3 4 5 6 7
가시성:   1 0 1 1 0 1 0 1
가시 ID:  0 2 3 5 7
```

직접 그리기와 동일한 네 인자를 담는 `D3D12_DRAW_ARGUMENTS`는 32비트 정수 네 개입니다. 따라서 한 명령의 데이터 크기는 16바이트입니다. 앞 프레임에 보였던 입자가 2개였다고 가정하면 이전 데이터는 (3, 2, 0, 0), 이번 데이터는 (3, 5, 0, 0)이 됩니다.

| 바이트 위치 | 필드 | 이전 프레임 | 현재 프레임 |
| --- | --- | ---: | ---: |
| 0 | VertexCountPerInstance | 3 | 3 |
| 4 | InstanceCount | 2 | 5 |
| 8 | StartVertexLocation | 0 | 0 |
| 12 | StartInstanceLocation | 0 | 0 |

이번 프레임에는 3 × 5 = 15개의 논리적인 정점 제출이 필요합니다. 이전 인자를 읽었다면 3 × 2 = 6개에 그칠 수 있습니다. 다만 배리어가 누락된 잘못된 프로그램이 반드시 이전 값 2를 읽는다는 뜻은 아닙니다. 오류가 발생하거나 다른 결과가 나올 수 있으며 정상 실행처럼 보일 수도 있습니다.

![8개 입자 중 가시 ID 0 2 3 5 7과 16바이트 간접 명령의 인스턴스 수 2에서 5로의 변경](assets/indirect-arguments.svg)

*직접 제작한 수치 예제. 현재 명령의 네 필드는 3, 5, 0, 0이며 각 4바이트입니다. 실제 GPU 캡처가 아닙니다. 필드 근거: [D3D12_DRAW_ARGUMENTS](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_draw_arguments).*

실제 입자 시스템이라면 5개라는 개수뿐 아니라 가시 입자 ID 목록도 필요합니다. 그 목록을 읽는 정점 셰이더 역시 올바른 상태 전환이 필요합니다. 예제를 좁게 유지하기 위해 아래에서는 고정된 가시성 배열을 사용하며, 인스턴스마다 동일한 삼각형을 그릴 수 있는 별도의 그래픽 파이프라인이 준비되었다고 가정합니다.

## 실제 HLSL과 Direct3D 12 코드

먼저 아래 컴퓨트 셰이더는 고정된 가시성 값을 합산해 간접 명령 하나를 만듭니다. 한 스레드만 사용하므로 작업 그룹 간 합산이나 원자적 연산이 필요하지 않습니다. 실제 공간 컬링을 구현한 코드는 아닙니다.

```hlsl
RWByteAddressBuffer Args : register(u0);

[numthreads(1, 1, 1)]
void CSMain(uint3 id : SV_DispatchThreadID)
{
    const uint visible[8] = {1, 0, 1, 1, 0, 1, 0, 1};
    uint count = 0;
    for (uint i = 0; i < 8; ++i)
        count += visible[i];

    Args.Store4(0, uint4(3, count, 0, 0));
}
```

호스트에서는 최소 16바이트의 UAV 쓰기 가능 기본 힙 버퍼와 raw UAV를 만들고, u0에 연결합니다. 명령 시그니처(Command Signature)는 간접 버퍼의 바이트를 어떤 명령으로 해석할지를 정의합니다. 이번에는 DRAW 인자 하나와 16바이트 stride를 설정합니다. 다음은 실제 C++ Direct3D 12 API 사용 코드입니다. 장치, DIRECT 명령 목록, 파이프라인, 루트 시그니처와 디스크립터 생성 및 제출 코드는 생략했습니다.

```cpp
#include <d3d12.h>

HRESULT CreateDrawSignature(
    ID3D12Device* device,
    ID3D12CommandSignature** signature)
{
    D3D12_INDIRECT_ARGUMENT_DESC arg{};
    arg.Type = D3D12_INDIRECT_ARGUMENT_TYPE_DRAW;

    D3D12_COMMAND_SIGNATURE_DESC desc{};
    desc.ByteStride = sizeof(D3D12_DRAW_ARGUMENTS);
    desc.NumArgumentDescs = 1;
    desc.pArgumentDescs = &arg;

    return device->CreateCommandSignature(
        &desc, nullptr, IID_PPV_ARGS(signature));
}
```

호출자는 HRESULT 성공을 확인한 시그니처를 사용합니다. 아래 함수의 진입 조건은 명령 목록에 컴퓨트 파이프라인과 UAV가 설정되어 있고 args 버퍼가 UNORDERED_ACCESS 상태라는 것입니다. 그래픽 루트 시그니처, PSO, 렌더 타깃, 뷰포트와 정점 입력은 유효하게 설정되어 있어야 합니다. 컴퓨트와 그래픽 바인딩 설정을 구분하기 위해 그래픽 PSO 전환도 명시합니다.

```cpp
void RecordDraw(
    ID3D12GraphicsCommandList* cmd,
    ID3D12Resource* args,
    ID3D12CommandSignature* signature,
    ID3D12PipelineState* graphicsPSO)
{
    cmd->Dispatch(1, 1, 1);

    D3D12_RESOURCE_BARRIER barrier{};
    barrier.Type = D3D12_RESOURCE_BARRIER_TYPE_TRANSITION;
    barrier.Transition.pResource = args;
    barrier.Transition.Subresource =
        D3D12_RESOURCE_BARRIER_ALL_SUBRESOURCES;
    barrier.Transition.StateBefore =
        D3D12_RESOURCE_STATE_UNORDERED_ACCESS;
    barrier.Transition.StateAfter =
        D3D12_RESOURCE_STATE_INDIRECT_ARGUMENT;
    cmd->ResourceBarrier(1, &barrier);

    cmd->SetPipelineState(graphicsPSO);
    cmd->ExecuteIndirect(signature, 1, args, 0, nullptr, 0);
}
```

이 코드는 완성된 실행 프로젝트가 아니라 실제 API 호출을 분리한 예제입니다. GPU 실행을 실측하거나 Windows SDK로 컴파일했다고 주장하지 않습니다. `ExecuteIndirect`의 MaxCommandCount가 1이고 별도 count buffer가 없으므로 명령 자체는 한 개입니다. 그 한 개의 명령이 읽은 InstanceCount가 5이므로 인스턴스 5개를 그립니다. 명령 개수와 인스턴스 개수를 혼동하지 않는 것이 중요합니다.

같은 버퍼를 다시 UAV로 쓸 때에는 현재 상태를 추적해 필요한 전환을 기록해야 합니다. 같은 제출 내라면 INDIRECT_ARGUMENT에서 UNORDERED_ACCESS로 돌아가는 전이가 필요합니다. 다만 버퍼는 ExecuteCommandLists 작업 완료 시 COMMON으로 되돌아갈 수 있으므로 실제 제출 경계를 고려해야 합니다. 여러 프레임이 겹칠 때는 프레임별 버퍼와 fence로 수명도 관리합니다.

## 전이 배리어와 UAV 배리어는 언제 다를까요?

두 컴퓨트 작업이 같은 UAV를 연속 사용하고 두 번째 작업이 첫 번째 결과에 의존하지만 상태는 그대로 UNORDERED_ACCESS라면 UAV 배리어를 사용합니다. 두 작업의 쓰기가 독립적이고 순서에 상관없이 안전하다면 불필요할 수 있습니다. 이번 예제는 상태 자체가 달라지므로 전이 배리어를 사용하며, 같은 의존성을 해결하려고 UAV 배리어를 무조건 하나 더 붙일 필요는 없습니다.

또한 서로 다른 큐에서 계산과 그리기를 실행하면 큐 사이의 실행 순서도 명시해야 합니다. 배리어만으로 다른 큐의 완료를 보장하지 않습니다. Microsoft의 [D3D12ExecuteIndirect 예제](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-executeindirect)는 별도 컴퓨트 명령 목록과 그래픽 명령 목록, 리소스 전환을 사용하는 더 실제적인 컬링 사례를 보여 줍니다. 큐 간 fence와 버퍼 재사용 조건까지 함께 설계해야 합니다.

배리어를 과하게 넣으면 독립적인 GPU 작업이 겹쳐 실행될 기회를 줄일 수 있습니다. 반대로 필요한 배리어를 빼는 것은 최적화가 아니라 잘못된 동기화입니다. 먼저 리소스별 읽기·쓰기 목록을 작성하고, 동일한 접근을 묶으며 필요한 상태 전환을 결정하세요. 여러 전환을 한 번의 ResourceBarrier 호출에 담는 것도 검토할 수 있습니다.

## 오늘 얻어갈 것

GPU가 계산한 5개라는 숫자를 CPU로 가져오지 않고 바로 그리기에 사용할 수 있습니다. 다만 생산자인 컴퓨트 셰이더와 소비자인 간접 그리기 명령 사이의 쓰기·읽기 관계를 올바르게 표현해야 합니다. 이번 예제에서는 16바이트 인자 버퍼를 UNORDERED_ACCESS에서 INDIRECT_ARGUMENT로 전환합니다.

코드에서 먼저 버퍼의 이전 상태와 다음 상태, 명령 시그니처 stride, InstanceCount와 MaxCommandCount의 차이를 확인하세요. D3D12 Debug Layer와 GPU-Based Validation으로 잘못된 사용 상태를 검사하고, [PIX GPU Capture](https://devblogs.microsoft.com/pix/gpu-captures/)의 Events와 Warnings에서 실제 Dispatch, ResourceBarrier, ExecuteIndirect 및 불필요한 전이를 찾아보세요. GPU 시간은 별도로 측정합니다. 16바이트의 크기만 보고 동기화 비용을 판단하지 않는 것이 핵심입니다.

## 출처

- [Microsoft Learn — Using Resource Barriers to Synchronize Resource States in Direct3D 12](https://learn.microsoft.com/en-us/windows/win32/direct3d12/using-resource-barriers-to-synchronize-resource-states-in-direct3d-12), Direct3D 12 기존 배리어 API 공식 설명, 2026-11-25 확인.
- [Microsoft Learn — D3D12_DRAW_ARGUMENTS](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/ns-d3d12-d3d12_draw_arguments), 최종 갱신 2024-02-22. 인자 구조.
- [Microsoft Learn — ID3D12GraphicsCommandList::ExecuteIndirect](https://learn.microsoft.com/en-us/windows/win32/api/d3d12/nf-d3d12-id3d12graphicscommandlist-executeindirect), 공식 API 및 컬링 예제, 2026-11-25 확인.
- [Microsoft PIX — GPU Captures](https://devblogs.microsoft.com/pix/gpu-captures/), 공식 도구 설명, 2026-11-25 확인.
