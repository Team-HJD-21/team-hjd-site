# 모자 하나만 보여주는데 왜 세 벌을 다 읽을까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 화면에는 모자 하나인데 시작할 때 세 벌을 읽습니다

캐릭터 꾸미기 메뉴를 열면 기본 모자 하나만 보입니다. 나머지 두 모자는 플레이어가 선택했을 때만 필요합니다. 그런데 메뉴를 준비하면서 세 모자의 에셋이 모두 메모리로 들어온다면 어떨까요? **아직 사용하지 않는 모자도 왜 함께 로딩되는 걸까요?**

답을 찾으려면 *참조(Reference)*와 *로드(Load)*를 구분해야 합니다. Unreal Engine은 객체에서 다른 에셋을 가리키는 방법에 따라, 소유 객체가 로드될 때 대상 에셋까지 따라 로드할지 달라집니다. 오늘은 메뉴 설정 하나와 모자 에셋 세 개만 놓고 경계를 직접 옮겨 보겠습니다. 근거는 [Epic의 에셋 참조 설명](https://dev.epicgames.com/documentation/unreal-engine/referencing-assets-in-unreal-engine)과 [비동기 에셋 로딩 문서](https://dev.epicgames.com/documentation/unreal-engine/asynchronous-asset-loading-in-unreal-engine)입니다. 아래 API 이름은 확인한 Unreal Engine **5.8 문서**를 기준으로 합니다.

## 하드 참조는 설정을 읽을 때 대상을 끌고 올 수 있습니다

**하드 참조(Hard Reference)**는 로드된 객체가 다른 에셋을 직접 참조하는 방식입니다. 예를 들어 메뉴 설정 데이터의 `UPROPERTY`에 세 모자의 `UStaticMesh`를 직접 저장했다면, 메뉴 설정을 로드하는 과정에서 그 참조 대상도 로드될 수 있습니다. 실제 참조 그래프는 Blueprint나 다른 에셋을 거쳐 더 넓게 이어질 수도 있습니다.

**소프트 참조(Soft Reference)**는 에셋의 경로를 통해 대상을 지칭하되, 그 참조 자체만으로 곧바로 대상 로드를 요구하지 않는 방식입니다. Unreal의 `TSoftObjectPtr<UStaticMesh>`가 그 예입니다. 에디터에서 에셋을 지정할 수 있지만, 실제 메시는 사용할 시점에 별도로 불러와야 합니다.

![설정 데이터가 모자 세 개를 하드 참조하는 경우와 선택된 하나만 소프트 로드하는 경우를 비교한 개념도](assets/reference-graph.svg)

*그림 1 · 직접 만든 참조 구조도입니다. 왼쪽은 설정을 로드할 때 세 대상에 하드 참조가 이어진 경우, 오른쪽은 에셋 경로만 들고 있다가 선택한 하나를 로드하는 경우입니다. 실제 로드 범위는 다른 의존성에 따라 달라집니다. 근거: [Epic Referencing Assets](https://dev.epicgames.com/documentation/unreal-engine/referencing-assets-in-unreal-engine).*

여기서 숫자를 붙여 보겠습니다. **가상의 비교 조건**으로 메뉴 설정이 1MB, 모자 에셋이 각각 12MB이며 서로 공유하는 의존성이 없다고 하겠습니다. 이는 실제 엔진에서 측정한 크기가 아니라 합계를 이해하기 위한 숫자입니다.

| 비교 조건 | 준비 시 필요한 예시 데이터 | 이후 모자 하나 선택 시 |
| --- | ---: | ---: |
| 세 모자를 하드 참조해 모두 로드 | 1 + 12 + 12 + 12 = 37MB | 추가 모자 로드 불필요 |
| 경로만 보관하고 하나를 요청 | 1MB | 선택한 12MB를 더해 13MB |

실제 메모리 사용량은 압축 방식, 텍스처와 머티리얼 의존성, 이미 로드된 에셋, GPU 자원 등에 따라 달라집니다. 이 표는 **참조 경계가 달라지면 언제 어떤 데이터를 요구하는가**만 보여줍니다. 소프트 참조가 파일 크기를 줄이거나 로드를 무료로 만들어 주는 것은 아닙니다.

## 경로를 쥐는 것과 실제 객체를 쥐는 것은 다릅니다

`TSoftObjectPtr`는 경로와 로드된 객체를 연결하지만, 에셋이 아직 메모리에 없으면 `Get()`으로 사용할 객체를 얻을 수 없습니다. 이때 경로인 `FSoftObjectPath`를 비동기 로딩(Asynchronous Loading)에 넘깁니다. **비동기 로딩**은 필요한 에셋을 요청하고 완료 시점을 콜백으로 받아, 기다리는 동안 게임 로직 전체를 동기 로드로 막지 않게 설계하는 방법입니다.

Unreal의 `FStreamableManager::RequestAsyncLoad`는 로드할 경로와 완료 콜백을 받으며 `FStreamableHandle`을 돌려줍니다. 반면 동기 로드(Synchronous Load)는 호출 지점에서 완료를 기다려 게임 스레드를 멈출 위험이 있습니다. Epic의 [`RequestAsyncLoad` API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FStreamableManager/RequestAsyncLoad)와 [`RequestSyncLoad` API](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FStreamableManager/RequestSyncLoad)가 이 차이를 명시합니다.

![메뉴 설정 로드부터 모자 선택 비동기 요청, 콜백, 사용, 참조 해제까지의 순서를 그린 타임라인](assets/load-lifecycle.svg)

*그림 2 · 직접 만든 수명 흐름도입니다. 소프트 참조가 있다고 자동 로드되는 것은 아니며, 완료 후 사용 중에는 참조 또는 활성 핸들로 필요한 에셋의 수명을 관리해야 합니다. 근거: [Epic Asynchronous Asset Loading](https://dev.epicgames.com/documentation/unreal-engine/asynchronous-asset-loading-in-unreal-engine), [FStreamableHandle](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FStreamableHandle).*

## Unreal C++에서 선택한 모자만 요청해 봅시다

다음은 `UObject` 파생 클래스 `UHatSlot`의 **멤버와 메서드 발췌 예제**입니다. `UCLASS`·`GENERATED_BODY`와 게임별 장착 컴포넌트는 생략했지만, 이름을 붙여 설명하는 의사 코드가 아니라 공식 엔진의 실제 타입·메서드를 사용하는 C++입니다. `HatAsset`은 에디터에서 지정한 선택 후보이며, `ActiveHat`은 현재 실제로 사용하는 메시입니다.

```cpp
// UHatSlot 클래스의 멤버 (헤더에 선언)
UPROPERTY(EditDefaultsOnly, Category="Cosmetic")
TSoftObjectPtr<UStaticMesh> HatAsset;

UPROPERTY(Transient)
TObjectPtr<UStaticMesh> ActiveHat = nullptr;

TSharedPtr<FStreamableHandle> HatHandle;
uint32 RequestSerial = 0;
```

```cpp
// UHatSlot의 메서드 (Engine/AssetManager.h,
// Engine/StreamableManager.h 포함 필요)
void UHatSlot::ChooseHat()
{
    if (HatAsset.IsNull()) return;
    const uint32 Serial = ++RequestSerial;
    TWeakObjectPtr<UHatSlot> WeakSlot(this);

    HatHandle = UAssetManager::GetStreamableManager().RequestAsyncLoad(
        HatAsset.ToSoftObjectPath(),
        FStreamableDelegate::CreateLambda([WeakSlot, Serial]()
        {
            if (!WeakSlot.IsValid()) return;
            UHatSlot* Slot = WeakSlot.Get();
            if (Slot->RequestSerial != Serial) return;

            Slot->ActiveHat = Slot->HatAsset.Get();
            if (!Slot->ActiveHat) return;  // 경로/로드 실패 확인

            // 여기서 실제 장착 컴포넌트에 메시를 연결합니다.
        })
    );
}

void UHatSlot::RemoveHat()
{
    ++RequestSerial;  // 오래된 요청의 결과를 사용하지 않음
    ActiveHat = nullptr;
    if (HatHandle.IsValid())
    {
        HatHandle->ReleaseHandle();
        HatHandle.Reset();
    }
}
```

`RequestSerial`은 사용자가 선택을 취소한 뒤 늦게 도착한 콜백이 이전 상태를 되살리지 않게 합니다. `TWeakObjectPtr`로 콜백 대상 `UHatSlot`의 생존 여부도 확인합니다. 이 발췌 코드는 **한 번에 한 모자 선택 요청**을 전제로 합니다. 실제 메뉴에서 빠른 연속 선택을 지원하려면 이전 요청의 취소·핸들 교체·컴포넌트 상태 전환까지 별도로 설계해야 합니다. 이 글에서 Unreal 프로젝트에 컴파일·실행해 성능을 측정했다고 주장하지 않습니다.

로딩 완료와 **메모리 유지**도 다른 문제입니다. `FStreamableHandle`은 활성 상태에서 로드한 에셋을 붙잡는 수단이며, 완료 후에도 객체가 필요하다면 이 예제처럼 `UPROPERTY`의 강한 참조를 유지하거나 정책에 맞는 활성 핸들을 관리합니다. `RemoveHat`에서 메시 참조를 끊고 핸들을 해제한다고 곧바로 OS·GPU 메모리가 즉시 반환된다는 보장은 없습니다. 다른 참조와 엔진의 정리 주기가 남을 수 있습니다. [Epic의 핸들 설명](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FStreamableHandle)과 [`ReleaseHandle` 문서](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FStreamableHandle/ReleaseHandle)에서 수명 계약을 확인할 수 있습니다.

## 무엇을 프로파일링하고, 언제 하드를 택할까요?

먼저 Unreal 에디터의 **Reference Viewer**로 메뉴 설정에서 세 모자까지 어떤 참조가 이어지는지 확인해 보세요. [Epic의 Working with Assets](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-assets-in-unreal-engine)는 Content Browser에서 해당 에셋을 우클릭해 Reference Viewer를 여는 경로를 안내합니다. 이어서 동일한 장면에서 **메뉴 진입 직후의 로드 범위·프레임 시간·메모리**와 **모자 선택 순간의 로딩 지연**을 각각 측정합니다.

항상 필요한 기본 외형이라면 하드 참조가 단순하고 즉시 사용하기 좋을 수 있습니다. 반면 상점에만 나오는 수백 개의 선택형 외형은 소프트 참조와 요청 시점 관리가 이득일 수 있습니다. 다만 비동기로 바꾸면 스피너·선택 취소·실패 처리·로드 완료 후 장착 같은 상태가 추가됩니다. **초기 로딩 비용을 줄이는 대신, 선택 순간의 대기와 수명 관리 책임을 떠안는** 선택입니다.

또 하나 빠뜨리기 쉬운 조건은 **패키징(Cooking)**입니다. 소프트 경로가 있다고 모든 대상이 자동으로 빌드에 포함되는 것은 아닙니다. 대상 에셋을 발견하고 포함하는 Asset Manager 규칙이나 프로젝트의 명시적인 패키징 설정이 필요할 수 있습니다. 에디터에서만 성공했다고 배포 빌드에서도 로딩된다고 가정하지 마세요. [Epic의 비동기 로딩·Asset Registry 설명](https://dev.epicgames.com/documentation/unreal-engine/asynchronous-asset-loading-in-unreal-engine)이 관련 출발점입니다.

## 오늘 얻어갈 것

**보이지 않는 모자까지 미리 로드되는 이유는, 메뉴 설정이 그 에셋들과 하드 참조로 연결됐기 때문일 수 있습니다.** 사용 시점이 다른 선택형 리소스는 `TSoftObjectPtr`로 경로를 보관하고 `RequestAsyncLoad`로 필요할 때 요청하면 로드 경계를 옮길 수 있습니다. 하지만 이 변경은 메모리 최적화라는 마법이 아니라 **초기 비용, 선택 순간의 지연, 수명·실패 처리** 사이의 교환입니다.

코드에서는 `UPROPERTY`의 참조 종류와 콜백의 대상 수명을, 에디터에서는 Reference Viewer와 패키징 규칙을, 실제 실행에서는 메모리·로드 지연·프레임 시간을 확인해 보세요. 무엇이 *필요한 순간*인지 먼저 정하는 것이 핵심입니다.

## 출처

- [Epic Games — Referencing Assets (Unreal Engine 5.8 문서)](https://dev.epicgames.com/documentation/unreal-engine/referencing-assets-in-unreal-engine)
- [Epic Games — Asynchronous Asset Loading (Unreal Engine 5.8 문서)](https://dev.epicgames.com/documentation/unreal-engine/asynchronous-asset-loading-in-unreal-engine)
- [Epic Games — RequestAsyncLoad API (Unreal Engine 5.8)](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FStreamableManager/RequestAsyncLoad)
- [Epic Games — FStreamableHandle API (Unreal Engine 5.8)](https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/FStreamableHandle)
- [Epic Games — Working with Assets / Reference Viewer (Unreal Engine 5.8)](https://dev.epicgames.com/documentation/en-us/unreal-engine/working-with-assets-in-unreal-engine)
