# 서로 다른 변수인데 왜 두 스레드가 서로를 기다릴까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 카운터 두 개를 나눴는데도 왜 느려질까요?

물리 스레드는 충돌 횟수를 세고, AI 스레드는 탐지 횟수를 센다고 해 보겠습니다. 둘은 서로의 숫자를 수정하지 않습니다. 공유된 잠금도 없습니다. 그런데 두 작업을 서로 다른 코어에서 아주 자주 실행하면, 하나씩 실행할 때보다 기대만큼 빨라지지 않을 수 있습니다.

오늘의 질문은 **서로 다른 변수인데도 왜 두 스레드가 서로의 캐시 작업을 방해할까요?**입니다. 답을 이해하려면 CPU가 변수 하나가 아니라 **캐시 라인(Cache Line)**이라는 메모리 구간을 단위로 다룬다는 점부터 봐야 합니다. 이로 인한 불필요한 간섭을 **거짓 공유(False Sharing)**라고 부릅니다. 이름에 '공유'가 들어가지만 두 스레드가 같은 변수 값을 쓰는 것은 아닙니다. [Oracle의 OpenMP 개발자 가이드](https://docs.oracle.com/cd/E77782_01/html/E77801/aewcx.html)에서 원인과 해결책을 설명합니다.

## 서로 다른 8바이트가 같은 64바이트에 있을 때

설명을 위한 가상의 CPU에서 캐시 라인이 **64바이트**라고 가정하겠습니다. 64바이트는 보편적인 고정 규칙이 아니라 이 글의 예제 조건입니다. 8바이트 정수 두 개가 한 구조체의 앞부분에 배치되어 각각 오프셋 0과 8에서 시작한다고 해 보겠습니다.

| 메모리 위치(예시) | 접근 스레드 | 갱신 대상 |
| --- | --- | --- |
| 바이트 0~7 | 물리 | 충돌 수 8바이트 |
| 바이트 8~15 | AI | 탐지 수 8바이트 |
| 바이트 16~63 | 없음 | 같은 캐시 라인의 나머지 |

스레드 A가 충돌 수를 수정하려면 그 데이터가 있는 캐시 라인에 쓰기 가능한 상태가 필요합니다. 다른 코어의 스레드 B도 탐지 수를 수정하려면 **그와 같은 캐시 라인**에 쓰기 가능한 상태가 필요합니다. 캐시 일관성(Cache Coherence)은 코어들이 서로 다른 복사본을 오래된 값으로 사용하지 않게 조정하는 규칙입니다. 수정 권한과 복사본 상태가 라인 단위로 관리되므로, 두 코어가 각자 다른 8바이트만 고쳐도 소유권 이동이나 무효화 작업이 일어날 수 있습니다.

![64바이트 캐시 라인 하나에 물리와 AI 카운터가 함께 놓여 서로 다른 코어의 쓰기가 충돌하는 배치](assets/cacheline-contention.svg)

*그림 1 · 직접 만든 구조도입니다. 예시에서는 라인이 64바이트, 두 카운터가 각 8바이트입니다. 캐시 간 실제 이동 횟수나 속도를 측정한 그림이 아닙니다. 근거: [Oracle OpenMP 가이드](https://docs.oracle.com/cd/E77782_01/html/E77801/aewcx.html).*

여기서 중요한 구별이 있습니다. 두 스레드가 **같은 카운터**를 경쟁적으로 수정하는 것은 진짜 공유(True Sharing)에 가깝습니다. 각자 **다른 카운터**를 수정하지만 같은 라인을 건드리는 것이 거짓 공유입니다. 읽기만 하는 데이터에는 같은 형태의 쓰기 무효화가 반복되지 않습니다. 거짓 공유는 특히 서로 다른 코어가 가까운 데이터를 **매우 자주 갱신할 때** 문제로 드러납니다.

## 바이트 위치만 달라져도 간섭이 줄 수 있습니다

두 카운터를 이제 서로 다른 라인에 배치하겠습니다. 첫 카운터가 0~7에 있고 다른 카운터가 64~71에 있다면, **이 예시의 64바이트 라인 기준**으로 서로의 라인에 쓰지 않습니다. 물론 CPU 캐시 구조와 스레드 배치에 따라 성능 차이는 달라집니다.

![같은 64바이트 라인에 붙어 있던 두 카운터를 서로 다른 라인에 분리한 메모리 배치 비교](assets/cacheline-separation.svg)

*그림 2 · 직접 만든 배치 비교입니다. 아래쪽 배치에서 두 카운터의 시작 오프셋은 0과 64입니다. 예시 수치는 주소 배치를 설명하며 성능 측정 결과가 아닙니다. 근거: [C++ 표준 제안 P0154R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0154r1.html).*

C++17은 이런 의도를 표현하도록 표준 헤더 `new`에 `std::hardware_destructive_interference_size`라는 **구현 정의 상수**를 제공합니다. “서로 다른 스레드가 자주 접근하는 객체를 떨어뜨려 두기 위해 권장하는 간격”입니다. 구현마다 값이 다를 수 있으며, 모든 하드웨어에서 특정 성능 향상을 보장하는 수치는 아닙니다. 이 상수가 제안된 이유와 한계는 [2016년 WG21 제안 P0154R1](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0154r1.html)에 나옵니다.

다음은 **C++17 표준 라이브러리 기능을 사용하는 실제 코드**입니다. 해당 상수를 구현한 컴파일러가 필요합니다.

```cpp
#include <atomic>
#include <cstdint>
#include <new>
#include <thread>
#include <iostream>

struct Adjacent {
    std::atomic<std::uint64_t> physics{0};
    std::atomic<std::uint64_t> ai{0};
};

struct Separated {
    alignas(std::hardware_destructive_interference_size)
        std::atomic<std::uint64_t> physics{0};
    alignas(std::hardware_destructive_interference_size)
        std::atomic<std::uint64_t> ai{0};
};

template <class Counters>
void count(Counters& counters) {
    constexpr unsigned N = 1'000'000;
    std::thread a([&] {
        for (unsigned i = 0; i < N; ++i)
            counters.physics.fetch_add(1, std::memory_order_relaxed);
    });
    std::thread b([&] {
        for (unsigned i = 0; i < N; ++i)
            counters.ai.fetch_add(1, std::memory_order_relaxed);
    });
    a.join();
    b.join();
    std::cout << counters.physics.load() << ", "
              << counters.ai.load() << '\n';
}

int main() {
    Adjacent before;
    Separated after;
    count(before);
    count(after);
}
```

`std::atomic`은 예제의 반복 갱신을 명시적으로 메모리에 남기고 데이터 경쟁을 피하기 위한 선택입니다. 서로 다른 변수라는 사실만으로 거짓 공유가 사라지는 것은 아닙니다. `memory_order_relaxed`는 다른 변수와의 순서 보장을 요구하지 않는 경우에 적절하지만 **캐시 일관성 비용까지 없애지는 않습니다**. `join()` 후 두 결과는 각각 1,000,000이어야 합니다. 이것은 **정확성 확인값**이지 속도 향상 수치가 아닙니다.

실제 프로젝트에서는 컴파일러의 지원 여부와 목표 플랫폼의 데이터 배치를 확인해야 합니다. 특히 다른 빌드 설정이나 라이브러리 사이에서 구조체 레이아웃이 달라질 수 있다는 [WG21의 2018년 ABI 논의](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p1119r0.html)도 유의할 점입니다.

## 모든 카운터를 64바이트씩 띄우는 것이 정답일까요?

반드시 그렇지는 않습니다. 8바이트 카운터를 64바이트 간격으로 두면 예시상 **카운터마다 간격에 필요한 최대 56바이트**가 추가될 수 있습니다. 이런 배치를 백만 개의 개체에 적용하면 단순 계산으로 약 56MB의 추가 공간이 생길 수 있습니다. 실제 구조체 크기·정렬·할당 방식에 따라 수치는 달라집니다. 캐시와 메모리 사용량이 중요하다면 무턱대고 패딩(Padding)을 넣는 것도 손해입니다.

게임의 작업자(Worker)별로 통계를 수집한다면, **스레드 지역 집계(Thread-local Accumulation)**가 더 나은 출발점일 수 있습니다. 각 스레드는 자기 카운터에 여러 번 더하고, 작업이 끝난 뒤 한 번만 합칩니다. 예를 들어 물리 쪽이 120개, AI 쪽이 80개를 셌다면 최종 합계는 200입니다. 두 스레드가 매 증가마다 같은 공유 카운터에 쓰지 않으므로, 데이터 공유 횟수를 줄일 수 있습니다. 단, 결과를 합칠 시점과 라이프사이클은 설계해야 합니다.

```text
// 의사 코드 — 엔진 API가 아닙니다.
worker[i].localCount += 발견한_개수   // 작업 중에는 자기 저장소만
작업이 모두 끝난 뒤:
    total = sum(worker[i].localCount)
```

데이터를 스레드별로 나눈다는 전략도 [Oracle 가이드](https://docs.oracle.com/cd/E77782_01/html/E77801/aewcx.html)가 권장하는 접근 중 하나입니다. 읽기와 쓰기 패턴에 따라 **각 스레드 소유 데이터 분리 → 필요한 시점에 결과 병합** 순서로 생각하면, 무조건 정렬을 늘리는 것보다 명확해집니다.

## 프로파일러에서 어떻게 구별할까요?

먼저 측정하고 있는 작업이 실제로 여러 코어에서 동시에 갱신되는지 확인합니다. 그리고 공유 구조체의 주소와 필드 간 오프셋을 출력해, 갱신되는 필드가 같은 라인에 놓였는지 확인합니다. `Adjacent`와 `Separated`를 같은 빌드·작업량·스레드 배치에서 여러 차례 측정하고, **전체 실행 시간과 업데이트 처리량**을 비교합니다.

느려졌다는 사실 하나만으로 거짓 공유라고 단정하지는 않습니다. 스레드 생성 비용, 진짜 공유 데이터 경쟁, 작업량 불균형, 코어 배치, 컴파일러 최적화가 결과에 영향을 줍니다. 지원하는 하드웨어라면 Intel VTune 같은 프로파일러의 메모리 접근 분석을 추가 근거로 사용할 수 있습니다. 예를 들어 [Intel의 가이드](https://www.intel.com/content/dam/develop/external/us/en/documents/gdma-2-165938.pdf)는 관련 분석 도구와 캐시 라인 공유의 관찰을 설명합니다. 다만 특정 하드웨어 이벤트 하나가 거짓 공유만을 독점적으로 뜻하지는 않습니다.

## 오늘 얻어갈 것

**서로 다른 변수를 갱신해도 같은 캐시 라인에 놓이면 코어 사이의 일관성 유지 비용으로 서로 간섭할 수 있습니다.** 오늘의 물리·AI 카운터 예시에서는 8바이트 변수 둘이 하나의 64바이트 라인에 들어간다는 배치 자체가 원인이었습니다. `alignas(std::hardware_destructive_interference_size)`로 떨어뜨리는 방법이 있지만, 모든 데이터에 적용하기보다 쓰기 빈도와 메모리 비용을 같이 봐야 합니다.

게임의 잡 시스템·C++ 작업자에서 확인할 것은 **어떤 스레드가 어느 주소를 얼마나 자주 쓰는가**, 그리고 결과를 작업자별로 모아 마지막에 합칠 수 있는가입니다. 우선 데이터 배치를 재현 가능한 방식으로 확인하고, 같은 조건의 프로파일링 결과로 최적화를 판단해 보세요.

## 출처

- [Oracle Developer Studio 12.6, OpenMP API User's Guide — Avoid False Sharing](https://docs.oracle.com/cd/E77782_01/html/E77801/aewcx.html) · 2017년 가이드.
- [JF Bastien · Olivier Giroux, P0154R1 — C++ Hardware Interference Size](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0154r1.html) · 2016-03-03, 이후 C++17에 반영.
- [WG21, P1119R0 — ABI for hardware interference size](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p1119r0.html) · 2018-06-22.
- [Intel, Graphics Developer's Guide to Microsoft Windows — False Sharing](https://www.intel.com/content/dam/develop/external/us/en/documents/gdma-2-165938.pdf) · 성능 분석 참고 자료.
