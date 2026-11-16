# 몬스터를 지웠는데 왜 예전 ID가 새 몬스터를 가리킬까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 삭제한 몬스터가 다시 나타난 걸까요?

몬스터 세 마리를 배열에 담았습니다. 세 번째 몬스터를 처치하고 그 자리에 새 몬스터를 생성했습니다. 그런데 오래된 공격 예약이 보관하던 **배열 인덱스 2**를 사용하자 새 몬스터의 체력이 줄어듭니다. 같은 배열 칸에 들어왔다는 이유만으로 이전 몬스터와 같은 대상이라고 볼 수 있을까요?

게임에서는 오브젝트를 자주 만들고 지웁니다. 빈 배열 칸을 재사용하면 저장 공간을 관리하기 편하지만, 인덱스(Index, 배열에서의 위치)만으로 대상을 식별하면 **누가 그 칸을 점유하고 있는지** 구분할 수 없습니다.

이를 해결하는 대표적인 설계가 **세대 핸들(Generational Handle)**입니다. 핸들(Handle)은 실제 데이터의 주소 대신 객체를 찾아가는 작은 식별자이고, 세대(Generation)는 같은 칸이 다시 사용될 때 바뀌는 번호입니다. 서로 다른 생애의 객체가 같은 칸을 쓰더라도 식별자가 달라지게 만드는 것이 핵심입니다. 실제 ECS 라이브러리 Flecs도 삭제된 엔티티 ID를 재사용할 때 세대 값을 높이고 이전 ID를 살아 있는 ID로 취급하지 않습니다([Flecs 공식 문서](https://www.flecs.dev/flecs/EntitiesComponents.html)).

## 세 마리에서 하나를 지우는 계산

우리 예제의 핸들은 `Handle{index, generation}` 형태입니다. 최초 생성 시 세대는 1이고, 삭제된 칸을 재사용하기 전에 세대를 하나 올린다고 약속하겠습니다. 아래 값은 **설명을 위해 정한 예시**이지 특정 엔진의 고정된 비트 배치는 아닙니다.

| 시점 | 0번 칸 | 1번 칸 | 2번 칸 | 보관한 옛 핸들 |
|---|---|---|---|---|
| 최초 | 적 A, 세대 1 | 적 B, 세대 1 | 적 C, 세대 1 | (2, 1) |
| C 삭제 직후 | 적 A, 세대 1 | 적 B, 세대 1 | 빈 칸, 세대 2 | (2, 1) |
| 적 D 생성 | 적 A, 세대 1 | 적 B, 세대 1 | 적 D, 세대 2 | (2, 1) |

![적 C를 삭제한 2번 칸을 적 D가 세대 2로 재사용하는 세 단계 시간선](assets/generation-timeline.svg)

*직접 만든 개념도. 핸들 (2, 1)은 C의 생애를 가리키며, 같은 칸에 새로 생성한 D는 (2, 2)입니다. 예제의 시작 세대는 1로 정했습니다. 구현 원리 참고: [Flecs Entity Liveliness](https://www.flecs.dev/flecs/group__liveliness.html).*

마지막에 옛 공격 예약이 핸들 `(2, 1)`을 조회하면, 저장된 2번 칸의 세대 `2`와 일치하지 않아 **조회가 실패**합니다. 반대로 새 핸들 `(2, 2)`는 살아 있는 적 D를 조회합니다. 인덱스는 같지만 둘은 다른 객체입니다.

이를 수식처럼 적으면 조회 조건은 다음 세 가지의 논리곱입니다.

```text
index < 슬롯 개수
AND 슬롯[index].alive == true
AND 슬롯[index].generation == handle.generation
```

검사를 생략하면 인덱스가 배열 범위 안에 있어도 **잘못된 객체에 정상적으로 접근하는** 오류가 발생할 수 있습니다. C++에서 삭제된 포인터를 역참조하는 문제와는 다르지만, 게임 로직에서 특히 찾기 어려운 잘못된 대상 선택을 만들 수 있습니다.

## C++17로 작게 구현해 보기

아래는 **표준 C++17만 사용하는 실행 가능한 예제**입니다. 엔진 API가 아니라 개념을 확인하기 위해 직접 구현한 `EnemyPool`입니다. 재사용할 빈 칸은 `freeIndices`에 저장하고, 각 칸은 생존 여부·세대·체력을 갖습니다.

```cpp
#include <cstdint>
#include <iostream>
#include <limits>
#include <optional>
#include <stdexcept>
#include <vector>

struct Handle {
    std::uint32_t index;
    std::uint32_t generation;
};

class EnemyPool {
    struct Slot {
        std::uint32_t generation = 1;
        int hp = 0;
        bool alive = false;
    };

    std::vector<Slot> slots;
    std::vector<std::uint32_t> freeIndices;

public:
    Handle create(int hp) {
        std::uint32_t index;
        if (!freeIndices.empty()) {
            index = freeIndices.back();
            freeIndices.pop_back();
        } else {
            if (slots.size() >= std::numeric_limits<std::uint32_t>::max()) {
                throw std::length_error("too many enemy slots");
            }
            index = static_cast<std::uint32_t>(slots.size());
            slots.push_back(Slot{});
        }

        Slot &slot = slots[index];
        slot.hp = hp;
        slot.alive = true;
        return {index, slot.generation};
    }

    bool valid(Handle h) const {
        return h.index < slots.size() &&
               slots[h.index].alive &&
               slots[h.index].generation == h.generation;
    }

    std::optional<int> health(Handle h) const {
        if (!valid(h)) return std::nullopt;
        return slots[h.index].hp;
    }

    void destroy(Handle h) {
        if (!valid(h)) return;
        Slot &slot = slots[h.index];
        slot.alive = false;

        // 세대가 끝까지 찬 칸은 재사용하지 않아 순환 충돌을 막습니다.
        if (slot.generation != std::numeric_limits<std::uint32_t>::max()) {
            ++slot.generation;
            freeIndices.push_back(h.index);
        }
    }
};

int main() {
    EnemyPool pool;
    auto a = pool.create(100);
    auto b = pool.create(90);
    auto oldC = pool.create(80);  // (2, 1)
    pool.destroy(oldC);
    auto newD = pool.create(60);  // (2, 2)

    std::cout << std::boolalpha
              << "old valid: " << pool.valid(oldC) << '\n'
              << "new valid: " << pool.valid(newD) << '\n'
              << "new hp: " << *pool.health(newD) << '\n';
}
```

결과는 다음과 같습니다.

```text
old valid: false
new valid: true
new hp: 60
```

`create`는 빈 칸이 있으면 그 인덱스를 다시 사용합니다. `destroy`는 **전달받은 핸들이 현재 유효할 때만** 슬롯을 비우므로, 오래된 핸들로 새 객체를 삭제할 수 없습니다. `health`는 무효한 핸들을 `std::nullopt`로 돌려주어 호출자가 실패를 다루도록 합니다. 예시에서 A와 B는 세 번째 객체의 인덱스가 2가 되도록 만들었으며, 실제 검사에는 사용하지 않습니다.

`std::vector`가 커질 때 내부 데이터 주소가 이동할 수 있지만, 이 구현의 핸들은 **주소가 아닌 인덱스**를 저장하므로 그 영향은 받지 않습니다. 다만 `Slot&`나 `Slot*`를 프레임 사이에 별도로 저장한다면 이 안전성은 적용되지 않습니다.

## 조회 때 반드시 검사해야 하는 이유

![오래된 핸들의 범위 검사 생존 검사 세대 비교를 거쳐 무효 판정되는 흐름](assets/handle-validation.svg)

*직접 만든 개념도. (2, 1)은 2번 슬롯의 현재 세대 2와 비교해 실패하고, (2, 2)만 성공합니다. 이 흐름은 위 C++17 `valid` 함수의 세 조건에 대응합니다.*

이 설계는 엔티티 컴포넌트 시스템(Entity Component System, ECS)에서 특히 잘 어울립니다. ECS는 객체의 정체성을 식별자로 나타내고 데이터는 별도 저장소에서 관리할 수 있기 때문입니다. EnTT의 공개 소스에도 엔티티 식별자에서 인덱스 부분과 버전 부분을 분리하는 `to_entity`, `to_version`가 있으며, 레지스트리의 `destroy`는 엔티티를 제거하고 식별자를 재활용할 수 있게 합니다([EnTT entity.hpp](https://github.com/skypjack/entt/blob/main/src/entt/entity/entity.hpp), [registry.hpp](https://github.com/skypjack/entt/blob/main/src/entt/entity/registry.hpp)). 다만 **EnTT와 Flecs의 실제 비트 배치·예약 값은 다를 수 있으므로** 위의 (32비트 인덱스, 32비트 세대) 예제를 그대로 해당 라이브러리 내부 구조라고 해석해서는 안 됩니다.

세대 검사에도 경계가 있습니다. 첫째, 세대 카운터가 한 바퀴 돌아 예전 값과 다시 같아지면 오래된 핸들이 살아날 수 있습니다. 위 코드는 `uint32_t` 최댓값에 도달한 칸을 **영구 퇴역**시켜 그 경우를 피합니다. 이는 저장 공간을 끝없이 재활용하는 것과 안전성 사이의 선택입니다. 둘째, 같은 핸들을 여러 스레드에서 접근·삭제한다면 **동기화**가 별도로 필요합니다. 세대 숫자만으로 동시 접근의 데이터 경합(Race Condition)을 해결하지 못합니다.

셋째, 외부에 저장한 핸들은 풀 자체의 수명도 고려해야 합니다. 풀을 통째로 초기화해 같은 인덱스·세대를 다시 발급한다면 이전 핸들까지 유효해 보일 수 있습니다. 씬·월드 경계를 넘나드는 참조에는 월드 식별자나 명확한 무효화 정책도 필요합니다. 또한 이 설계는 지연 호출에서 잘못된 대상을 선택하는 문제를 막지만, **포인터의 모든 수명 문제를 자동으로 해결하는 기술은 아닙니다**.

## 오늘 얻어갈 것

삭제된 적 C의 자리인 인덱스 2를 새 적 D가 재사용하더라도 **(2, 1)과 (2, 2)는 다른 핸들**이므로 옛 공격 요청이 새 적을 건드리지 않게 할 수 있습니다. 중요한 것은 단순히 인덱스를 범위 검사하는 데 그치지 않고 **살아 있는지와 현재 세대가 일치하는지 함께 확인하는 것**입니다.

엔진을 만들거나 객체 풀(Object Pool)을 설계한다면, 삭제 직후·같은 칸 재사용 후·오래된 핸들로 삭제 요청을 한 경우를 각각 테스트해 보세요. 프로파일러에서는 임의의 성능 개선 배율을 기대하기보다 할당과 조회 비용을 실제 워크로드로 비교하고, 코드 리뷰에서는 세대 순환·월드 초기화·다중 스레드 경계를 확인하는 편이 좋겠습니다.

## 출처

- [Flecs 공식 문서, Entities and Components — Deletion](https://www.flecs.dev/flecs/EntitiesComponents.html) — 삭제된 ID 재사용과 버전 증가, 2026-11-16 확인.
- [Flecs 공식 API, Entity Liveliness](https://www.flecs.dev/flecs/group__liveliness.html) — 이전 세대의 ID를 무효 처리하는 생존 검사, 2026-11-16 확인.
- [EnTT 공식 공개 소스, entity.hpp](https://github.com/skypjack/entt/blob/main/src/entt/entity/entity.hpp) — 엔티티 부분·버전 부분 추출, 2026-11-16 확인.
- [EnTT 공식 공개 소스, registry.hpp](https://github.com/skypjack/entt/blob/main/src/entt/entity/registry.hpp) — 삭제·식별자 재활용, 2026-11-16 확인.
