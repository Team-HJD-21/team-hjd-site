# 정수 같은 작은 값인데 왜 매 프레임 GC 할당이 생길까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 체력을 읽었을 뿐인데 새 객체가 생겼다고요?

적 수천 마리의 체력을 읽는 게임 루프를 떠올려 보겠습니다. 체력은 정수 하나이고 소스 코드에는 눈에 띄는 객체 생성도 없습니다. 그런데 Unity Profiler의 **GC Alloc**에 작은 할당이 반복해서 표시됩니다. 숫자를 읽기만 했는데 어디서 메모리를 새로 쓴 걸까요?

범인 후보 중 하나는 **박싱(Boxing)**입니다. C#의 값 형식(Value Type)은 정수나 구조체처럼 값을 표현하는 타입입니다. 이 값을 object 또는 자신이 구현한 인터페이스(Interface) 참조로 변환할 때, 값을 담은 별도의 객체를 만드는 것을 박싱이라고 합니다. Microsoft의 [C# 공식 해설](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/types/boxing-and-unboxing)은 이때 관리 힙(Managed Heap)에 객체가 만들어지고 값이 복사된다고 설명합니다.

반대로 **언박싱(Unboxing)**은 박싱한 객체에서 원래 값 형식을 꺼내는 변환입니다. 오늘은 게임 루프에서 무심코 반복하기 쉬운 **박싱**에 집중하겠습니다.

## 인터페이스 매개변수 하나가 바꾸는 것

체력 50을 가진 구조체 HealthValue가 IHealthRead 인터페이스를 구현한다고 가정하겠습니다. 인터페이스는 여러 구현을 같은 약속으로 다루기 위한 형식입니다. 아래는 핵심만 떼어 낸 **실제 C# 코드 조각**입니다.

```csharp
public interface IHealthRead
{
    int GetHp();
}

public struct HealthValue : IHealthRead
{
    public int Hp;
    public int GetHp() => Hp;
}

static int ReadInterface(IHealthRead value) => value.GetHp();

HealthValue health = new HealthValue { Hp = 50 };
int hp = ReadInterface(health); // struct -> interface: boxing
```

ReadInterface는 IHealthRead 참조를 받습니다. 구조체 health를 이 자리에 넘기면 **원본의 값 50을 담은 박싱 객체**가 생성됩니다. 이 객체는 원본 구조체와 별도이므로, 이후 원본의 체력을 바꾸더라도 이미 박싱한 복사본이 따라 바뀌지는 않습니다.

![체력 50을 가진 HealthValue 구조체에서 인터페이스 인수로 변환할 때 별도 박싱 객체로 값이 복사되는 경로](assets/boxing-flow.svg)

*직접 제작한 구조도입니다. 값 형식에서 인터페이스 인수로 변환할 때 복사가 생기는 원리를 나타냈습니다. 실제 객체 크기나 주소의 측정치는 아닙니다. 근거: [Microsoft C# Boxing and Unboxing](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/types/boxing-and-unboxing).*

**구조체를 쓴다고 항상 박싱되는 것은 아닙니다.** 같은 값 형식 변수로 그대로 값을 계산하는 것과, 이를 인터페이스·object 참조로 바꾸는 것은 다릅니다. 예컨대 제네릭 타입으로 값을 보존한 컬렉션을 쓰는 것만으로 각 구조체가 박싱되는 것은 아닙니다.

## 1만 번 읽으면 어떤 일이 1만 번 일어날까요?

우리 예제에서 한 프레임에 같은 체력값을 10,000번 읽어 보겠습니다. ReadInterface(health)를 10,000번 호출하면 **인터페이스 변환에 의한 박싱 지점**을 10,000번 거칩니다.

대안은 **제네릭(Generic)** 메서드로 값 형식 정보를 유지하는 것입니다. where T : struct, IHealthRead 제약은 T가 값 형식이고 해당 인터페이스를 구현해야 한다는 조건입니다. ref T는 호출자가 가진 변수를 참조로 전달합니다.

```csharp
static int ReadGeneric<T>(ref T value)
    where T : struct, IHealthRead
{
    return value.GetHp();
}

int hp = ReadGeneric(ref health); // no interface boxing
```

이 호출에서는 인수를 인터페이스 참조로 변환하지 않으므로 해당 **박싱 변환이 없습니다**. Microsoft의 [제네릭 인터페이스 해설](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/generics/generic-interfaces)도 값 형식의 박싱·언박싱을 줄일 수 있다고 설명합니다.

| 비교할 호출 경로 | 호출 수 | 인터페이스 변환 박싱 지점 |
|---|---:|---:|
| ReadInterface(health) | 10,000회 | 10,000회 |
| ReadGeneric(ref health) | 10,000회 | 0회 |

![동일한 호출 1만 번에서 인터페이스 참조 경로는 1만 번의 박싱 변환 지점을 거치고 제네릭 ref 경로는 거치지 않는 비교도](assets/boxing-count.svg)

*직접 제작한 호출 경로 비교도입니다. 10,000은 예시의 반복 횟수이고, 박싱 변환 지점 수를 센 것입니다. 실제 할당 바이트·프레임 시간·GC 실행 횟수를 계측한 그림은 아닙니다.*

각 호출의 체력이 50이라면 결과 합계는 양쪽 모두 **50 × 10,000 = 500,000**입니다. 값은 같은데 매개변수 전달 방식이 달라지는 것입니다. 이는 곧바로 실제 프레임 시간이 특정 배수만큼 빨라진다는 주장은 아닙니다.

## Unity C#에서 직접 확인하기

다음은 Unity 6 계열의 빈 게임 오브젝트에 부착할 수 있는 **실제 MonoBehaviour 예제**입니다. 파일 이름은 BoxingProbe.cs로 만듭니다. Inspector의 Use Interface Parameter를 바꿔 같은 횟수의 호출을 비교할 수 있습니다.

```csharp
using UnityEngine;

public interface IHealthRead
{
    int GetHp();
}

public struct HealthValue : IHealthRead
{
    public int Hp;
    public int GetHp() => Hp;
}

public sealed class BoxingProbe : MonoBehaviour
{
    [SerializeField] private bool useInterfaceParameter = true;
    private HealthValue health;
    private int checksum;

    public int LastTotal => checksum;

    private void Awake()
    {
        health = new HealthValue { Hp = 50 };
    }

    private void Update()
    {
        int sum = 0;
        for (int i = 0; i < 10000; ++i)
        {
            if (useInterfaceParameter)
                sum += ReadInterface(health);
            else
                sum += ReadGeneric(ref health);
        }
        checksum = sum; // Both modes: 500000
    }

    private static int ReadInterface(IHealthRead value)
    {
        return value.GetHp();
    }

    private static int ReadGeneric<T>(ref T value)
        where T : struct, IHealthRead
    {
        return value.GetHp();
    }
}
```

Unity Profiler에서 **CPU Usage → Hierarchy의 GC Alloc 열**을 비교해 보세요. 필요하면 GC.Alloc 호출 스택도 활성화합니다. [Unity 6000.6 CPU Profiler 공식 문서](https://docs.unity.com/en-us/engine/6000.6/manual/analysis/profiler/visualizing-data/cpu/cpu)는 할당을 표시하는 GC.Alloc과 수거 작업인 GC.Collect를 구분합니다. 가능하면 동일한 플랫폼·스크립팅 백엔드의 Development Build에서 실제 플레이어를 측정해 에디터의 잡음을 줄이세요.

컴파일러 출력·IL 뷰어에서 박싱 명령인 **box**를 찾아보는 것도 방법입니다. 다만 Mono와 IL2CPP, 컴파일러 최적화에 따라 실제 실행·할당 결과는 달라질 수 있습니다. 1만 번의 *코드상 변환 지점*이 반드시 특정 바이트 수나 GC 수거 횟수로 일대일 대응한다고 단정하지 마세요.

## 박싱을 없애는 게 언제나 정답일까요?

런타임에 서로 다른 구현을 한데 모아 관리한다면 인터페이스 참조가 설계를 단순하게 만들 수 있습니다. 값 형식이 아닌 **클래스**를 인터페이스로 다루는 것은 그 자체로 값 형식 박싱이 아닙니다. 제네릭으로 바꾼 뒤에도 문자열 생성, 배열, 캡처 람다, 다른 API 사용으로 할당이 남을 수 있습니다.

Unity 6000.7의 [관리 메모리 최적화 문서](https://docs.unity.com/en-us/engine/6000.7/manual/analysis/performance-memory/managed-memory/optimizing-code-managed-memory/reference-types)는 박싱을 빈번한 임시 할당 원인으로 설명합니다. 디자인의 유연성과 호출 빈도, 실제 할당을 비교하면서 최적화할 지점을 정하는 편이 좋습니다.

## 오늘 얻어갈 것

**작은 정수·구조체를 읽는 루프에서도 GC 할당이 생기는 이유는 값의 크기가 아니라, 값을 object나 인터페이스 참조로 변환하며 박싱 객체를 만들기 때문일 수 있습니다.** 오늘의 두 함수는 10,000번 호출해 모두 500,000을 반환하지만, 제네릭 ref 경로는 해당 인터페이스 박싱 변환을 거치지 않습니다.

먼저 Unity CPU Profiler의 GC Alloc과 호출 스택으로 실제 발생 위치를 확인하세요. 이어 C# 매개변수의 타입, 가능하다면 IL의 box 명령을 추적하고, 변경 전후 **할당량·CPU 시간·GC 발생**을 같은 조건에서 각각 비교하면 됩니다.

## 출처

- [Microsoft — Boxing and Unboxing (C#)](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/types/boxing-and-unboxing), 문서 메타데이터 2025-10-13, 2026-11-18 확인.
- [Microsoft — Generic Interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/generics/generic-interfaces), 2026-11-18 확인.
- [Unity 6000.6 — CPU Usage Profiler module reference](https://docs.unity.com/en-us/engine/6000.6/manual/analysis/profiler/visualizing-data/cpu/cpu), 2026-11-18 확인.
- [Unity 6000.7 — Reference type management](https://docs.unity.com/en-us/engine/6000.7/manual/analysis/performance-memory/managed-memory/optimizing-code-managed-memory/reference-types), 2026-11-18 확인.
