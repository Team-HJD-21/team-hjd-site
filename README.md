# TeamHJD public website

TeamHJD 대표 사이트. 정적 HTML과 CSS를 GitHub Pages로 배포합니다.

- 대표 사이트: https://teamhjd.com/
- 문서 사이트: https://docs.teamhjd.com/ (별도 저장소 Team-HJD-21/team-hjd-docs)
- 검증: `node scripts/check-site.mjs`
- 배포: main push 또는 Deploy TeamHJD website 워크플로 수동 실행

공개 사이트에는 팀 소개와 개발 중인 THE DEVELOPER의 짧은 소개 및 업무 연락처만 포함합니다. 게임 스크린샷처럼 보일 수 있는 실제 에셋 대신 타이틀 그래픽을 사용하며 게임 화면으로 설명하지 않습니다. 미확정 출시 일정이나 팀원 명단 및 기획은 공개하지 않습니다.

DNS는 @ A 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153과 www CNAME team-hjd-21.github.io를 유지합니다. docs CNAME team-hjd-21.github.io를 추가합니다. GitHub Pages 사용자 도메인은 이 저장소에서 teamhjd.com으로 등록합니다. Docs 저장소는 docs.teamhjd.com을 사용합니다.

메일용 MX와 TXT 및 도메인 검증 설정은 수정하지 않습니다. 인증서가 유효해진 뒤 HTTPS 강제를 활성화합니다.

이전 teamhjd.com/docs/... 북마크는 404 페이지에서 Docs의 동일 경로로 안내합니다. 호스팅 전환은 사이트 내용만 바꾸며 Workspace 사용자나 결제를 변경하지 않습니다.
