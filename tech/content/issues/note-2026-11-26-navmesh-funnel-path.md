# 최단 경로를 찾았는데 왜 캐릭터가 지그재그로 걸을까요?

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 길을 찾는 것과 걷는 선을 만드는 것은 다릅니다

3D 던전에서 적이 플레이어를 향해 달립니다. 장애물을 제대로 피해 가고 경로 탐색도 성공했는데, 넓은 복도에서도 바닥의 삼각형 경계를 따라 지그재그로 움직입니다. 경로 탐색 비용을 더 낮추거나 휴리스틱을 바꿔야 할까요?

우선 탐색 결과가 무엇인지 구분해야 합니다. **내비게이션 메시(Navigation Mesh, NavMesh)**는 이동 가능한 표면을 연결된 다각형으로 표현합니다. 탐색은 시작 다각형에서 목표 다각형까지 이어지는 다각형의 순서를 구할 수 있습니다. 이 순서를 **경로 통로(Path Corridor)**라고 부릅니다. 두 다각형 사이에서 건널 수 있는 공유 경계 선분은 **포털(Portal)**입니다. 포털의 양 끝은 통로 안에서 선택할 수 있는 범위를 정합니다.

Recast Navigation의 Detour는 이 차이를 API에서 드러냅니다. `dtNavMeshQuery::findPath`는 다각형 참조의 배열을, `findStraightPath`는 주어진 통로 안에서 따라갈 좌표를 구합니다. 탐색으로 정한 통로와 캐릭터가 따라갈 선은 서로 다른 결과물입니다. [Detour 공식 API](https://recastnav.com/classdtNavMeshQuery.html)

## 같은 통로를 두 가지 방법으로 지나가 보기

평면 위에 시작점 S=(0, 0), 목표 G=(8, 0)이 있다고 가정하겠습니다. 좌표 단위는 m이고, 다각형 경계 사이를 이동할 수 있는 세 포털은 다음과 같습니다. 모든 포털은 x축 진행 방향에 수직이며 그 사이 공간은 볼록한 다각형입니다. 캐릭터는 이동 가능한 표면 위의 점으로 취급합니다.

| 포털 | x | 아래쪽 끝 y | 위쪽 끝 y | 중점 |
| --- | ---: | ---: | ---: | --- |
| P1 | 2 | -1 | 3 | (2, 1) |
| P2 | 4 | 2 | 4 | (4, 3) |
| P3 | 6 | 0 | 2 | (6, 1) |

중점을 차례로 지나면 S → (2, 1) → (4, 3) → (6, 1) → G가 됩니다. 통로 안에 있지만 불필요하게 많이 꺾입니다. 반대로 S와 G를 곧장 연결하면 x=4에서 y=0으로 P2 아래를 지나므로 이동 가능한 영역을 벗어납니다.

![세 포털을 지나는 중점 경로와 P2 아래 끝을 지나는 최단 경로](assets/corridor-paths.svg)

*직접 제작한 평면 개념도입니다. 회색 점선은 포털 중점 경로, 연두색 선은 통로 내 최단 경로, 세로선은 포털입니다. 두 축은 같은 축척입니다. 실제 엔진 캡처가 아닙니다.*

이 문제에 쓰이는 **깔때기 알고리즘(Funnel Algorithm)**은 정해진 통로의 양쪽 경계를 따라 통과 가능한 방향 범위를 좁혀 가다가, 더 이상 범위가 겹치지 않으면 꼭 지나야 하는 모서리를 결정합니다. 통로 안에 팽팽하게 당긴 끈을 상상하면 이해하기 쉽습니다. Godot 4.5도 경로 후처리(Path Post-processing)에서 이 방식을 제공합니다. [Godot 4.5 경로 후처리 문서](https://docs.godotengine.org/en/4.5/tutorials/navigation/navigation_using_navigationpathqueryobjects.html#path-postprocessing-options)

## 기울기로 깔때기를 계산해 보겠습니다

이번 예제는 포털이 수직이며 오른쪽으로만 진행하므로 기울기로 계산할 수 있습니다. 꼭짓점(Apex)은 현재 경로에서 마지막으로 확정된 점입니다. 처음에는 S입니다. S에서 포털의 양 끝을 향하는 직선의 기울기를 구하면 해당 포털을 통과할 수 있는 직선 방향의 범위를 얻습니다.

P1은 -1/2부터 3/2까지, P2는 2/4부터 4/4까지입니다. 두 포털을 함께 통과하는 방향은 두 범위의 교집합인 [0.5, 1]입니다. 그런데 P3는 [0, 1/3]만 허용합니다. P2에서 요구한 최소 기울기 0.5가 P3의 최대 기울기 1/3보다 큽니다. S에서 세 포털을 한 직선으로 관통할 수 없다는 뜻입니다.

| 처리한 포털 | 새 포털이 허용하는 기울기 | 남은 범위 |
| --- | --- | --- |
| P1 | [-0.5, 1.5] | [-0.5, 1.5] |
| P2 | [0.5, 1] | [0.5, 1] |
| P3 | [0, 1/3] | 교집합 없음 |

이때 아래쪽 경계를 만들었던 P2의 끝 C=(4, 2)를 경로의 새 꼭짓점으로 확정합니다. S에서 C까지 가면 P1을 y=1에서 건넙니다. C에서 다시 방향을 계산하면 G까지의 기울기는 -0.5입니다. x=6에서 y=1이므로 P3도 정상적으로 건넙니다. 더 꺾일 필요가 없습니다.

![P2까지 남은 기울기 범위와 P3의 상한이 충돌하는 과정](assets/funnel-intervals.svg)

*직접 제작한 수치 개념도입니다. 각 막대는 S를 기준으로 한 허용 기울기 구간입니다. P3의 상한 1/3은 P2 처리 후 남은 하한 0.5보다 작습니다.*

길이를 비교해 보겠습니다. 포털 중점 경로는 두 구간씩 길이가 각각 √5와 √8이므로 2√5 + 2√8 ≈ 10.13m입니다. C를 지나는 경로는 각 구간이 √20이므로 2√20 ≈ 8.94m입니다. P2를 건너려면 x=4에서 y가 적어도 2여야 합니다. 따라서 그 교차점까지와 그 이후의 두 직선 거리 합은 적어도 2√20이고, C를 지나는 경로는 이 하한을 실제로 만족합니다. 이번 평면 예제에서는 이 경로가 최단임을 직접 확인할 수 있습니다. 이는 경로 길이 계산이며 경로 탐색 CPU 성능을 측정한 값은 아닙니다.

## 실제 알고리즘은 좌우 방향을 외적으로 판정합니다

일반 NavMesh에서는 포털이 수직이라는 보장이 없습니다. 따라서 기울기를 나누어 계산하는 대신 벡터의 **외적(Cross Product)** 부호로 두 방향의 상대 위치를 판정합니다. 2D 평면에서 세 점 A, B, C의 방향 판정은 다음과 같습니다.

$$
orient(A,B,C)=(B_x-A_x)(C_y-A_y)-(B_y-A_y)(C_x-A_x)
$$

수학 좌표계에서 양수는 A→B에서 A→C로 반시계 방향 회전, 음수는 시계 방향, 0은 일직선을 뜻합니다. 예제에서 orient(S, (4, 2), (6, 2)) = 8 - 12 = -4입니다. 새 포털의 위쪽 끝이 기존 아래쪽 경계보다 시계 방향으로 넘어갔음을 확인할 수 있습니다. 좌표계 및 포털 좌우 정의가 바뀌면 비교 부호도 일관되게 바꿔야 합니다.

다음은 구현 흐름을 표현한 의사 코드입니다. 실제 Detour 소스를 그대로 옮긴 것이 아닙니다.

```text
apex = start
left = right = start
path = [start]

for each portal, including goal as a zero-width portal:
    compare new boundaries with current left/right
    if a boundary crosses the opposite boundary:
        append the opposite boundary to path
        apex = that boundary
        reset left/right to apex
        restart after the portal that supplied apex
    else:
        tighten each boundary where possible

append goal if not already present
```

경계를 갱신할 때는 그 경계를 공급한 포털 인덱스도 함께 저장해야 합니다. 새 꼭짓점을 확정한 뒤에는 이전 시작점 기준으로 좁혀진 범위를 그대로 재사용할 수 없기 때문입니다. 실제 구현에서는 같은 점, 일직선, 작은 부동소수점 오차, 포털의 좌우 순서와 종료 조건도 처리해야 합니다. 경계가 한 점으로 만나는 것은 허용 범위가 사라지는 것과 다릅니다.

## 엔진에서 탐색 결과와 후처리를 따로 확인해 보세요

Godot 4.5의 `NavigationPathQueryParameters3D`는 경로 후처리 모드를 선택할 수 있습니다. `PATH_POSTPROCESSING_CORRIDORFUNNEL`은 통로 안의 경로를 줄이고, `PATH_POSTPROCESSING_EDGECENTERED`는 포털 중점을 경유하게 만듭니다. `PATH_POSTPROCESSING_NONE`은 탐색의 원시 경로를 비교하는 데 유용합니다. 아래 코드는 실제 Godot 4.5 GDScript API를 이용한 비교용 함수입니다. Node3D에 붙이고 내비게이션 맵이 동기화된 뒤 동일한 출발점과 목표로 호출합니다. 캐릭터 이동 코드 자체는 아닙니다.

```gdscript
extends Node3D

var params := NavigationPathQueryParameters3D.new()
var result := NavigationPathQueryResult3D.new()

func compare_paths(start: Vector3, goal: Vector3) -> void:
    var map := get_world_3d().get_navigation_map()
    if NavigationServer3D.map_get_iteration_id(map) == 0:
        return
    params.map = map
    params.start_position = start
    params.target_position = goal
    params.path_postprocessing = NavigationPathQueryParameters3D.PATH_POSTPROCESSING_EDGECENTERED
    NavigationServer3D.query_path(params, result)
    print("Edge centered: ", result.get_path())
    params.path_postprocessing = NavigationPathQueryParameters3D.PATH_POSTPROCESSING_CORRIDORFUNNEL
    NavigationServer3D.query_path(params, result)
    print("Funnel: ", result.get_path())
```

공식 4.5 문서가 제시하는 쿼리 객체 재사용 방식에 맞췄습니다. [쿼리 객체 사용법](https://docs.godotengine.org/en/4.5/tutorials/navigation/navigation_using_navigationpathqueryobjects.html) · [파라미터 API](https://docs.godotengine.org/en/4.5/classes/class_navigationpathqueryparameters3d.html). 해당 클래스는 4.5 문서에서 실험적 API로 표기되므로 다른 버전에서는 계약을 확인해야 합니다.

깔때기가 바꿀 수 있는 것은 이미 선택된 통로 안의 경로입니다. 탐색이 우회하는 통로를 골랐다면 다른 다각형을 새로 탐색하지 않습니다. 이동 비용이 구역별로 다를 때 거리 최소화가 총비용 최소화와 같지도 않습니다. 실제 캐릭터의 반지름은 NavMesh 생성 시 고려하고, 이동 중 다른 캐릭터와의 회피나 가속도 제한은 별도의 이동 제어에서 다뤄야 합니다. 격자 중심만 이동할 수 있는 게임에서는 오히려 중점 경로가 설계에 맞을 수 있습니다.

## 오늘 얻어갈 것

탐색에 성공한 캐릭터가 지그재그로 걷는 이유는 다각형을 선택하는 문제와 그 통로를 따라가는 좌표를 만드는 문제가 다르기 때문일 수 있습니다. 이번 예제에서는 동일한 통로에서 포털 중점을 경유하는 10.13m 경로를 꼭 필요한 모서리 하나를 지나는 8.94m 경로로 바꿨습니다.

실제 게임에서는 먼저 NavMesh와 원시 경로를 디버그 표시하고, 같은 쿼리의 후처리 결과를 나란히 그려 보세요. 포털 수와 경로 좌표 수, 총 길이, 탐색 및 후처리의 CPU 시간, 실제 이동 중 벽과의 접촉을 따로 기록하면 탐색 문제인지 후처리 문제인지 이동 제어 문제인지 구분할 수 있습니다. 경로가 짧아졌다고 탐색 자체가 빨라졌다고 판단하지는 마세요.

## 출처

- [Recast Navigation — dtNavMeshQuery Class Reference](https://recastnav.com/classdtNavMeshQuery.html), 프로젝트 공식 API 문서, 2026-11-26 확인. 다각형 경로와 통로 내 직선 경로의 구분.
- [Godot 4.5 — Using NavigationPathQueryObjects](https://docs.godotengine.org/en/4.5/tutorials/navigation/navigation_using_navigationpathqueryobjects.html), 공식 문서, 2026-11-26 확인. 경로 후처리의 선택과 쿼리 객체 재사용.
- [Godot 4.5 — NavigationPathQueryParameters3D](https://docs.godotengine.org/en/4.5/classes/class_navigationpathqueryparameters3d.html), 공식 API, 2026-11-26 확인. 후처리 모드의 열거형과 제약.
