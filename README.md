# TeamHJD public website

TeamHJD 대표 사이트. 정적 HTML과 CSS를 GitHub Pages로 배포합니다.

- 대표 사이트: https://teamhjd.com/
- 문서 사이트: https://docs.teamhjd.com/ (별도 저장소 Team-HJD-21/team-hjd-docs)
- 검증: `node scripts/check-site.mjs`
- 언어: 오른쪽 위 목록에서 한국어 / English / 简体中文 선택. 선택을 브라우저에 저장하며 `?lang=en` 및 `?lang=zh-CN` 링크로도 열 수 있습니다. Docs 사이트는 별도이며 이 언어 선택은 대표 홈페이지에만 적용됩니다.
- 언어 UI: 사이트 색상에 맞춘 드롭다운 목록. 현재 언어 강조와 키보드 접근 및 Escape 닫기 지원.
- 공개 문의 주소: support@teamhjd.com
- THE DEVELOPER Steam 스토어: https://store.steampowered.com/app/4336820/The_Developer/
- 배포: main push 또는 Deploy TeamHJD website 워크플로 수동 실행

대표 게임 THE DEVELOPER의 공식 Steam 아트를 첫 화면에 배치합니다. 메인 캡슐과 헤더 캡슐 및 우주 배경은 사용자가 제공한 공유 드라이브 원본에서 복사한 에셋입니다. 원본은 수정하지 않았으며 공식 아트를 실제 게임 플레이 화면으로 설명하지 않습니다.

이스터 에그: Treant는 접속하면 바로 등장하고 이후 30초 간격으로 화면 아래를 10초 동안 통과합니다. 화면의 일반 영역을 클릭하면 Slime Tentacle 또는 5% 확률로 Slime King이 무작위 방향으로 이동합니다. 슬라임은 최대 12마리이며 8초 후 사라집니다. CBC 원본은 수정하지 않고 이동 시트를 복사해 사용합니다. 링크와 버튼은 제외하며 장식은 클릭을 가로채지 않습니다. 동작 줄이기 설정과 숨겨진 탭에서는 애니메이션을 중지합니다.

공개 사이트에는 팀 소개와 사용자가 확인한 공동대표 및 프로젝트 참여자 명단과 개발 중인 THE DEVELOPER의 짧은 소개 및 업무 연락처를 포함합니다. 공동대표는 YANG HYUNSEOK과 HWANG JAEDONG입니다. THE DEVELOPER에는 두 공동대표와 KIM JINTAE 및 LEE YOUNGBIN과 JO SUNBIN이 참여합니다. 미확정 출시 일정이나 기획은 공개하지 않습니다.

DNS는 @ A 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153과 www CNAME team-hjd-21.github.io를 유지합니다. docs CNAME team-hjd-21.github.io를 추가합니다. GitHub Pages 사용자 도메인은 이 저장소에서 teamhjd.com으로 등록합니다. Docs 저장소는 docs.teamhjd.com을 사용합니다.

메일용 MX와 TXT 및 도메인 검증 설정은 수정하지 않습니다. 인증서가 유효해진 뒤 HTTPS 강제를 활성화합니다.

이전 teamhjd.com/docs/... 북마크는 404 페이지에서 Docs의 동일 경로로 안내합니다. 호스팅 전환은 사이트 내용만 바꾸며 Workspace 사용자나 결제를 변경하지 않습니다.
