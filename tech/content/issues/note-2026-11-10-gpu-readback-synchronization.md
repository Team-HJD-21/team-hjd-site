# 16바이트만 읽는데 왜 프레임이 멈출까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 작은 결과인데 큰 기다림

적이 몇 명 보이는지 GPU에서 계산했다고 해 보겠습니다. 네 그룹의 결과는 **12, 6, 3, 1**입니다. 그룹마다 32비트 정수 하나이므로 모두 합쳐 **4 × 4 = 16바이트**뿐입니다.

그런데 게임 로직이 그 값을 즉시 가져오려고 할 때 화면이 순간적으로 끊길 수 있습니다. 16바이트를 복사하는 데 시간이 오래 걸리는 걸까요?

핵심은 전송량보다 **동기화(Synchronization)**입니다. CPU가 결과를 지금 당장 요구하면, GPU가 앞서 제출된 작업을 끝낼 때까지 기다려야 할 수 있습니다. Unity의 `ComputeBuffer.GetData` 문서는 GPU가 버퍼에 쓰는 작업을 제출한 상태라면 읽기 전에 그 작업의 완료를 기다린다고 명시합니다. [Unity 공식 API: ComputeBuffer.GetData, 6000.7](https://docs.unity.com/en-us/engine/6000.7/script-reference/unityengine/computebuffer/getdata)

## GPU 명령을 보냈다는 것과 끝났다는 것은 다릅니다

CPU는 그래픽 명령을 제출하고 자기 일을 계속할 수 있습니다. GPU도 별도의 실행 흐름에서 명령을 처리합니다. 두 장치가 **비동기적으로 진행**한다는 뜻이지, 어떤 결과든 요청 즉시 준비된다는 뜻은 아닙니다.

가상의 시간선을 계산해 볼까요? 시각 0ms에 계산 명령이 제출되고, GPU는 6ms에 결과를 완성합니다. CPU가 2ms에 동기 읽기를 호출한다면 결과가 준비될 때까지 **6 − 2 = 4ms**를 기다리는 상황이 가능합니다. 16바이트는 이 기다림의 원인이 아니라 기다림이 끝난 뒤 가져올 결과의 크기입니다. 이 4ms는 **설명용 가정**이며 실제 Unity나 특정 GPU의 벤치마크가 아닙니다.

![동기 읽기는 2~6ms 동안 CPU가 기다리지만 비동기 요청은 CPU가 다른 일을 계속할 수 있음을 비교한 가상 시간선](assets/readback-timeline.svg)

*직접 만든 개념도. 두 방식 모두 GPU는 0~6ms에 작업한다는 가정입니다. 동기 읽기는 2ms 시점부터 4ms 대기하고, 비동기 요청은 완료 후 결과를 처리합니다. 실제 하드웨어의 측정값이 아닙니다. 원리 근거: [Unity ComputeBuffer.GetData](https://docs.unity.com/en-us/engine/6000.7/script-reference/unityengine/computebuffer/getdata), [AsyncGPUReadback](https://docs.unity.com/en-us/engine/6000.5/script-reference/unityengine/rendering/asyncgpureadback).*

비동기 GPU 읽기(Asynchronous GPU Readback)는 이 즉시 대기를 피하도록, 나중에 결과를 받는 방법입니다. Unity의 `AsyncGPUReadback` 문서는 CPU·GPU를 멈추지 않는 읽기를 제공하지만 몇 프레임의 지연이 더해질 수 있다고 설명합니다. **프레임 정지 위험을 줄이는 대신, 결과의 신선도를 포기**하는 교환입니다. [Unity 공식 API: AsyncGPUReadback, 6000.5](https://docs.unity.com/en-us/engine/6000.5/script-reference/unityengine/rendering/asyncgpureadback)

## 네 그룹의 카운터를 직접 읽어 봅시다

이번에는 GPU가 실제로 네 개의 숫자를 쓰고 CPU가 돌려받는 예제입니다. 먼저 Unity Compute Shader 자산 `CountGroups.compute`에 다음 코드를 넣습니다. 예제를 좁게 유지하려고 입력이 아닌 고정된 결과를 기록합니다. 따라서 이 부분은 **실제 HLSL 코드이지만 가시성 판정 알고리즘 자체는 아닙니다.**

```hlsl
#pragma kernel CSMain

RWStructuredBuffer<uint> Counts;

[numthreads(1, 1, 1)]
void CSMain(uint3 id : SV_DispatchThreadID)
{
    Counts[0] = 12;
    Counts[1] = 6;
    Counts[2] = 3;
    Counts[3] = 1;
}
```

`ComputeBuffer`는 셰이더와 CPU 사이에서 사용할 GPU 데이터 버퍼입니다. 이번 버퍼는 정수 네 개이므로 요소 수 4, 요소 크기 4바이트로 만듭니다. Unity 문서에서 기본 `ComputeBuffer`가 셰이더의 `RWStructuredBuffer<T>`에 대응함을 확인할 수 있습니다. [Unity 공식 API: ComputeBuffer, 6000.5](https://docs.unity.com/en-us/engine/6000.5/script-reference/unityengine/computebuffer)

아래는 **Unity C# 실제 API 사용 예제**입니다. `CountGroups.compute` 자산을 `ComputeShader` 필드에 연결하고 빈 게임 오브젝트에 붙여 실행합니다. `synchronousForComparison`을 켜면 `GetData`, 끄면 비동기 읽기를 사용합니다.

```csharp
using UnityEngine;
using UnityEngine.Rendering;

public sealed class ReadbackDemo : MonoBehaviour
{
    [SerializeField] private ComputeShader countGroups;
    [SerializeField] private bool synchronousForComparison;

    private void Start()
    {
        if (countGroups == null || !SystemInfo.supportsComputeShaders)
        {
            Debug.LogWarning("Compute shader를 사용할 수 없습니다.");
            return;
        }

        var counts = new ComputeBuffer(4, sizeof(uint));
        int kernel = countGroups.FindKernel("CSMain");
        countGroups.SetBuffer(kernel, "Counts", counts);
        countGroups.Dispatch(kernel, 1, 1, 1);

        if (synchronousForComparison || !SystemInfo.supportsAsyncGPUReadback)
        {
            try
            {
                var values = new uint[4];
                counts.GetData(values); // GPU 완료를 기다릴 수 있는 지점
                Debug.Log($"동기 읽기: {values[0]}, {values[1]}, {values[2]}, {values[3]}");
            }
            finally
            {
                counts.Release();
            }

            return;
        }

        AsyncGPUReadback.Request(counts, request =>
        {
            try
            {
                if (request.hasError)
                {
                    Debug.LogWarning("GPU 읽기 요청 실패");
                    return;
                }

                var values = request.GetData<uint>();
                Debug.Log($"비동기 읽기: {values[0]}, {values[1]}, {values[2]}, {values[3]}");
            }
            finally
            {
                counts.Release(); // 요청이 끝날 때까지 버퍼 유지
            }
        });
    }
}
```

`AsyncGPUReadback.Request`는 결과 준비 후 콜백을 호출합니다. `request.hasError`를 확인한 다음 `GetData<uint>()`로 내용을 가져옵니다. 이 API가 돌려주는 `NativeArray`는 완료된 요청의 데이터를 가리키므로 **콜백 안에서 읽고, 나중에 쓸 값은 자체 저장소로 복사**해야 합니다. [Unity 공식 API: AsyncGPUReadback.Request, 6000.0](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/rendering/asyncgpureadback/request), [GetData, 6000.0](https://docs.unity.cn/6000.0/Documentation/ScriptReference/Rendering.AsyncGPUReadbackRequest.GetData.html)

이 예제는 **한 번 요청하는 실험**입니다. 실제 게임에서는 화면 전환·오브젝트 파괴·종료와 요청 완료의 순서가 엇갈릴 수 있습니다. 요청 중인 리소스를 너무 빨리 해제하지 않도록, 수명과 취소 정책을 별도의 관리 객체에서 설계해야 합니다.

![계산 명령 제출, 비동기 요청, 완료 콜백, 결과 복사, 버퍼 해제 순서와 결과 데이터 수명을 나타낸 구조도](assets/readback-lifecycle.svg)

*직접 만든 개념도. GPU 결과의 소유권과 완료 이후 CPU 처리를 구분한 것입니다. 콜백에서 반환된 임시 데이터를 오래 보관하지 않고 필요한 값만 복사합니다. 근거: [Unity AsyncGPUReadback.Request](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/rendering/asyncgpureadback/request), [ComputeBuffer.Release](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/computebuffer/release).*

## 비동기가 항상 정답일까요?

**지금 이 프레임에 반드시 필요한 값**이라면 몇 프레임 뒤에 받는 결과로 대체할 수 없습니다. 대신 GPU에서 소비할 판단은 GPU에서 끝내거나, 이전 프레임의 결과를 써도 되는지 요구사항부터 살펴야 합니다. 반대로 통계·디버깅·한두 프레임 늦어도 되는 UI 표시라면 비동기 읽기가 적합할 수 있습니다.

한 번만 읽는 예제와 달리 매 프레임 요청하면 완료 전 요청이 여러 개 쌓일 수 있습니다. 버퍼 수명·대역폭·결과 순서·메모리를 관리하고, 동시에 진행할 요청 수에 상한을 두는 편이 안전합니다. 결과에 프레임 번호를 함께 기록하면 늦게 온 결과를 최신 상태로 착각하는 일을 줄일 수 있습니다.

실험할 때는 개발 빌드의 **Unity Profiler CPU Timeline**에서 동기 `GetData` 호출을 포함한 프레임 시간을 비교하세요. 이후 `AsyncGPUReadback`으로 바꾸고 **CPU 주 스레드 시간, 결과 도착까지의 프레임 수, 메모리·요청 수**를 함께 기록합니다. 동기 읽기 하나가 반드시 눈에 띄게 느리다는 뜻도, 비동기로 바꾸면 전체 게임 FPS가 특정 비율로 오른다는 뜻도 아닙니다. 실제 병목인지 측정하는 것이 먼저입니다.

## 오늘 얻어갈 것

16바이트만 읽어도 프레임이 멈출 수 있는 이유는 **작은 복사 작업 때문이 아니라 GPU가 결과를 쓰기 끝낼 때까지 CPU가 기다리는 동기화 지점** 때문입니다. 동기 `ComputeBuffer.GetData`는 최신 결과를 즉시 돌려주는 대신 대기를 만들 수 있고, `AsyncGPUReadback.Request`는 요청 후 다른 일을 진행하는 대신 결과가 늦게 도착합니다.

코드에서는 `GetData`와 `Request`를 구별하고, 요청 완료·오류·버퍼 해제 순서를 확인해 보세요. 엔진에서는 비동기 읽기 지원 여부를 검사하고, Profiler에서는 CPU의 대기 시간과 결과 지연을 **서로 다른 수치**로 측정하면 좋겠습니다.

## 출처

- [Unity ComputeBuffer.GetData — GPU 작업 완료 대기와 읽기, Unity 6000.7 문서](https://docs.unity.com/en-us/engine/6000.7/script-reference/unityengine/computebuffer/getdata)
- [Unity AsyncGPUReadback — 동기 대기와 지연의 교환, Unity 6000.5 문서](https://docs.unity.com/en-us/engine/6000.5/script-reference/unityengine/rendering/asyncgpureadback)
- [Unity AsyncGPUReadback.Request — 콜백 API, Unity 6000.0 문서](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/rendering/asyncgpureadback/request)
- [Unity AsyncGPUReadbackRequest.GetData — 완료된 데이터의 유효성, Unity 6000.0 문서](https://docs.unity.cn/6000.0/Documentation/ScriptReference/Rendering.AsyncGPUReadbackRequest.GetData.html)
- [Unity ComputeBuffer — 셰이더 데이터 구조, Unity 6000.5 문서](https://docs.unity.com/en-us/engine/6000.5/script-reference/unityengine/computebuffer)
- [Unity SystemInfo — 비동기 GPU 읽기 지원 여부, Unity 6000.0 문서](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityengine/systeminfo)
