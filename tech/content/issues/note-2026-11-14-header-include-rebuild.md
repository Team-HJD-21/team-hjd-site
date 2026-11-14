# 헤더 한 줄 바꿨는데 왜 C++ 파일 200개를 다시 컴파일할까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 주석 한 줄을 고쳤을 뿐인데

게임 클라이언트의 `debug_overlay.hpp`에서 표시 문구만 바꿨습니다. 그런데 빌드 로그에는 `player.cpp`, `enemy.cpp`, `ui.cpp`가 차례로 다시 등장합니다. 플레이어와 적의 로직은 건드리지 않았는데, 왜 다시 컴파일할까요?

문제는 **변경한 코드가 얼마나 중요한가**가 아니라, **그 파일을 어떤 번역 단위가 입력으로 읽는가**입니다. C++에서 전처리기(Preprocessor)는 `#include`를 만날 때 다른 파일을 읽어 소스에 포함합니다. 이렇게 전처리된 하나의 `.cpp`가 컴파일되는 단위를 번역 단위(Translation Unit)라고 부릅니다. [GCC의 Include Operation 문서](https://gcc.gnu.org/onlinedocs/cpp/Include-Operation.html)는 파일의 내용이 포함 위치에 들어간다는 점을 설명합니다.

여기서 중요한 구분이 있습니다. **헤더가 직접 포함되었는지**와 **실제로 그 안의 함수가 호출되는지**는 같은 문제가 아닙니다. 사용하지 않는 헤더도 `#include` 경로에 들어 있으면 해당 번역 단위의 빌드 의존성(Dependency)이 될 수 있습니다.

## 파일 네 개로 직접 세어 보기

다음은 실제 C++17 문법으로 작성한 작은 정적 라이브러리입니다. 설명을 위해 필요한 파일 내용만 보여드립니다. 각 주석의 파일 이름마다 **별도 파일**로 저장하는 예제입니다.

```cpp
// debug_overlay.hpp
#pragma once
inline int debugLabelWidth(int hp) { return hp >= 100 ? 3 : 2; }

// core.hpp
#pragma once
#include "debug_overlay.hpp" // 원래는 여기 둘 필요가 없습니다.
struct Position { float x; float y; };
```

```cpp
// player.cpp
#include "core.hpp"
float playerX() { Position p{1.0f, 2.0f}; return p.x; }

// enemy.cpp
#include "core.hpp"
float enemyX() { Position p{3.0f, 4.0f}; return p.x; }

// ui.cpp
#include "core.hpp"
int uiWidth() { return debugLabelWidth(80); }

// audio.cpp
int audioChannels() { return 2; }
```

```cmake
# CMakeLists.txt (CMake 3.16 이상)
cmake_minimum_required(VERSION 3.16)
project(HeaderDependencyExample LANGUAGES CXX)
add_library(client STATIC player.cpp enemy.cpp ui.cpp audio.cpp)
target_compile_features(client PRIVATE cxx_std_17)
```

`player.cpp`와 `enemy.cpp`는 `debugLabelWidth`를 사용하지 않습니다. 그래도 `core.hpp`가 `debug_overlay.hpp`를 포함하고 있으니 두 소스 역시 이 헤더를 읽습니다.

![debug_overlay.hpp에서 core.hpp를 거쳐 세 개의 cpp로 퍼지는 포함 의존성](assets/header-dependency-graph.svg)

*직접 만든 개념도. 화살표는 헤더가 포함되어 번역 단위의 입력이 되는 관계를 뜻합니다. 오디오는 이 헤더를 읽지 않습니다. 근거: [GCC Include Operation](https://gcc.gnu.org/onlinedocs/cpp/Include-Operation.html).*

이때 `debug_overlay.hpp`만 수정했다고 가정하겠습니다. 다른 파일과 컴파일 옵션은 그대로이고, 이전 빌드 결과가 유효하며, 일반적인 헤더 의존성 기반 증분 빌드를 사용합니다.

| 번역 단위 | `debug_overlay.hpp`를 읽는 경로 | 다시 컴파일? |
|---|---|---|
| `player.cpp` | `player.cpp → core.hpp → debug_overlay.hpp` | 예 |
| `enemy.cpp` | `enemy.cpp → core.hpp → debug_overlay.hpp` | 예 |
| `ui.cpp` | `ui.cpp → core.hpp → debug_overlay.hpp` | 예 |
| `audio.cpp` | 경로 없음 | 아니요 |

총 네 번역 단위 가운데 **세 개가 재컴파일 대상**입니다. 빌드 시스템은 일반적으로 주석이 프로그램의 동작을 바꾸는지 먼저 판단하는 것이 아니라, 기록된 입력의 변경 여부로 작업을 다시 수행할지 결정합니다. 따라서 위 헤더의 주석만 수정해도 의존성 기반 빌드에서는 컴파일 명령이 재실행될 수 있습니다. 다만 내용 해시 캐시 등 다른 기능을 사용하는 환경의 실제 재컴파일 횟수는 달라질 수 있습니다.

## 컴파일러가 의존성 목록을 알려줍니다

빌드 도구가 무작정 모든 파일을 검사하는 것은 아닙니다. GCC의 `-MMD`는 컴파일하면서 시스템 헤더를 제외한 사용자 헤더 의존성을 기록하고, `-MF`는 기록 파일 위치를 지정합니다. 다음 명령은 별도 `player.d` 파일을 만들 수 있습니다.

```text
g++ -std=c++17 -MMD -MF player.d -c player.cpp -o player.o
```

이 예제에서 나오는 의존성의 핵심은 다음과 같습니다. 실제 출력의 공백·순서는 도구 환경에 따라 달라질 수 있습니다.

```text
player.o: player.cpp core.hpp debug_overlay.hpp
```

Ninja는 GCC/Clang의 의존성 파일(depfile)을 수집하거나 자체 의존성 데이터베이스에 저장해 어떤 출력이 영향을 받는지 판단합니다. MSVC에는 `/showIncludes` 기반의 별도 경로가 있습니다. [Ninja 공식 매뉴얼](https://ninja-build.org/manual.html)에서 `depfile`, `deps = gcc`, `deps = msvc`를 확인할 수 있습니다.

**직접 확인할 명령**도 간단합니다. CMake와 Ninja가 설치된 환경에서 위 파일을 저장한 후 아래처럼 빌드해 보세요.

```text
cmake -S . -B build -G Ninja
cmake --build build -v
touch debug_overlay.hpp
cmake --build build -v
```

마지막 명령에서 어떤 `.cpp`의 컴파일 명령이 다시 실행되는지 보시면 됩니다. `touch`는 파일 수정 시각을 갱신하는 명령으로, Unix 계열 셸에서 사용할 수 있습니다. `-v`는 빌드 명령을 표시합니다. 위 예제의 **3/4라는 값은 의존성 그래프로 계산한 결과**이지, 특정 개발 PC에서 측정한 컴파일 성능 수치가 아닙니다.

## 헤더 위치를 옮기면 무슨 일이 달라질까요?

`debugLabelWidth`를 실제로 사용하는 파일은 `ui.cpp`뿐입니다. 따라서 `core.hpp`에서 `#include "debug_overlay.hpp"`를 제거하고, `ui.cpp`에 해당 include를 직접 추가할 수 있습니다.

```cpp
// 수정 후 core.hpp
#pragma once
struct Position { float x; float y; };

// 수정 후 ui.cpp
#include "core.hpp"
#include "debug_overlay.hpp"
int uiWidth() { return debugLabelWidth(80); }
```

이 리팩터링 자체를 적용하는 순간에는 `core.hpp`가 바뀌므로 관련 소스가 다시 빌드됩니다. **그 다음부터** `debug_overlay.hpp`만 수정한다면 영향받는 번역 단위가 `ui.cpp` 하나로 줄어듭니다.

![의존성 정리 전 세 파일과 정리 후 한 파일만 다시 컴파일하는 비교](assets/rebuild-fanout.svg)

*직접 만든 개념도. 동일한 `debug_overlay.hpp` 변경에 대한 재컴파일 대상 수를 예제 의존성만으로 계산한 것입니다. 실제 시간 단축 배율을 의미하지 않습니다.*

흔히 이런 비용이 **포함 의존성의 퍼짐(Fan-out)**으로 나타납니다. 예제에서는 `3 → 1`이고, 200개 소스가 공통 헤더를 간접 포함한다면 그 헤더 변경이 200개 번역 단위를 무효화할 수도 있습니다. 정확한 범위는 실제 의존성 그래프로 세어야 합니다.

## 왜 모든 헤더를 미리 컴파일하면 끝나지 않을까요?

사전 컴파일 헤더(Precompiled Header, PCH)는 자주 읽는 헤더를 미리 처리해 반복 파싱 비용을 줄이는 방법입니다. CMake는 3.16부터 `target_precompile_headers`를 제공합니다. 하지만 PCH가 있다고 해서 변경된 헤더의 의존성이 사라지는 것은 아닙니다. PCH에 자주 바뀌는 프로젝트 헤더를 넣으면 PCH 자체가 다시 만들어지고 그에 의존하는 소스에도 비용이 생길 수 있습니다.

반대로 헤더 분리는 항상 이득인 것도 아닙니다. include가 필요하다면 명시해야 하며, 여러 헤더로 지나치게 쪼개면 관리 비용이 늘어납니다. 헤더가 공통 타입의 완전한 정의를 정말 요구하는지, 선언만으로 가능한지, 구현 파일로 옮길 수 있는지를 먼저 봐야 합니다. 전방 선언(Forward Declaration)은 포인터·참조 선언 등 일부 경우에 유용하지만, 객체의 크기나 멤버에 접근해야 한다면 완전한 정의가 필요합니다. 별도 코드 구조 없이 기계적으로 전방 선언만 늘리는 방식은 권하지 않습니다.

빌드 개선 작업은 **재컴파일된 번역 단위 수**, **각 컴파일 명령 소요 시간**, **전체 빌드 시간**을 구분해 평가하는 것이 좋습니다. 이 글에서 확인한 것은 첫 번째, 즉 바뀐 헤더가 불필요하게 얼마나 멀리 전파되는가입니다.

## 오늘 얻어갈 것

헤더 한 줄을 고쳤는데 여러 `.cpp`가 다시 컴파일되는 이유는 컴파일러가 그 헤더를 직접 또는 간접적으로 읽어 **서로 다른 번역 단위의 입력으로 사용했기 때문**입니다. 함수 호출 여부와는 다릅니다.

실제 프로젝트에서는 수정한 헤더가 어느 번역 단위의 의존성에 나타나는지 GCC `-MMD`·`-MF`나 Ninja 의존성 기록, MSVC `/showIncludes`로 확인해 보세요. 공용 헤더에 불필요한 include가 몰려 있다면 사용 지점으로 옮긴 뒤 다시 빌드 범위를 비교하는 것이 출발점입니다. 마지막으로 PCH·컴파일 캐시·병렬 빌드는 **비용을 줄이는 도구**이지, 잘못된 의존성 그래프를 자동으로 고치는 기능은 아니라는 점을 기억하시면 좋겠습니다.

## 출처

- [GCC, *Include Operation* — 전처리기 #include의 동작](https://gcc.gnu.org/onlinedocs/cpp/Include-Operation.html) (공식 문서, 2026-11-14 확인)
- [GCC, *Preprocessor Options* — -MD, -MMD, -MF](https://gcc.gnu.org/onlinedocs/gcc/Preprocessor-Options.html) (공식 문서, 2026-11-14 확인)
- [Ninja, *The Ninja build system* — depfile 및 deps](https://ninja-build.org/manual.html) (공식 매뉴얼, 2026-11-14 확인)
- [CMake 3.31, *target_precompile_headers*](https://cmake.org/cmake/help/v3.31/command/target_precompile_headers.html) (버전 고정 공식 문서, CMake 3.16에 명령 추가)
