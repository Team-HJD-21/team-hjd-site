# 겜붕이의 노트 운영 배포

기준: 2026-11-03, Asia/Seoul. 기존 PR #1은 main에 병합했고 Cloudflare Pages에 실제 배포했다.

- 운영 도메인: https://tech.teamhjd.com/ (연결 등록 후 DNS/HTTPS 활성 상태는 실제 화면에서 확인)
- 기본 도메인: https://gambungi-notes.pages.dev/
- 저장소: Team-HJD-21/team-hjd-site, 운영 브랜치 main
- Pages 프로젝트: gambungi-notes, 회사 도메인과 같은 Cloudflare 계정
- 방식: 기존 Cloudflare Workers and Pages GitHub 앱의 Git integration
- 소스 루트: tech
- 프레임워크: None
- 빌드 명령: npm run build:cloudflare
- 출력 폴더: dist

## 자동 배포

main 변경을 Cloudflare가 받아 독립적으로 검사·빌드·배포합니다. 별도의 Cloudflare API 토큰이나 GitHub의 CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN Secret, NEWSLETTER_AUTO_DEPLOY 변수는 필요하지 않다. 이 프로젝트는 Git integration으로 생성했으므로 이전 Direct Upload용 provisioning 코드를 실행하지 않습니다.

scripts/cloudflare-build.mjs는 Pandoc이 없으면 공식 Pandoc 3.13 Linux 배포 파일을 다운로드해 고정 SHA256으로 확인하고 임시 폴더에서만 사용합니다. 콘텐츠·메일·Pages·정오 발행 검사를 실행한 뒤 빌드합니다. 실패하면 배포가 중단됩니다. GitHub Actions의 Validate newsletter도 같은 진입점을 검사합니다.

회사 홈페이지의 기존 GitHub Pages 배포와 뉴스레터 Pages는 별도 산출물을 사용합니다. 뉴스레터에는 tech/dist만 배포합니다. 단, 디자인을 맞추기 위해 회사 루트 styles.css·index.html의 푸터·로고를 빌드 입력으로 사용합니다.

## 도메인

Pages Custom domains에 tech.teamhjd.com을 먼저 등록하고, 안내한 CNAME tech → gambungi-notes.pages.dev만 추가했다. 기존 tech 레코드는 없었다. 회사 루트 DNS·MX·메일 인증 TXT는 변경하지 않았다. DNS 캐시와 인증서 발급이 완료되어 기본 TLS 검증의 HTTPS 200을 확인한 경우에만 운영 도메인 완료라고 보고합니다.

## 매일 정오 공개

ChatGPT는 매일 10:30 Asia/Seoul에 원고를 준비하는 구성을 권장합니다. 원고는 scheduled 상태와 publishAt=YYYY-MM-DDT12:00:00+09:00으로 main에 반영합니다. 그 상태에서는 사이트에 공개하지 않습니다.

.github/workflows/publish-newsletter.yml의 Publish newsletter at noon KST가 매일 정오와 10·20·30분 후에 상태를 확인합니다. 당일의 준비된 한 호만 published로 바꾸고, 검사·빌드 후 그 상태 변경을 main에 커밋합니다. Cloudflare가 이를 배포합니다. 이미 당일 발행 호가 있으면 다시 공개하지 않습니다. 원고 미준비·검사 실패·복수 후보·공개 시간창 초과는 지난 호로 대체하지 않습니다.

GitHub Actions의 시간 예약과 Cloudflare 빌드 큐는 지연될 수 있습니다. 목표는 정오 공개이며 초 단위·정확한 12:00 반영을 보장하지 않습니다. 12:30 이후에는 자동 지연 공개를 멈춘다. GitHub 공개 저장소의 예약 workflow는 장기간 활동이 없으면 비활성화될 수 있으므로 운영자가 상태를 확인합니다.

## 수동 점검

Actions → Publish newsletter at noon KST → Run workflow → dry_run=true는 상태를 쓰지 않는 점검입니다. 정오 전에는 before_noon, 당일 이미 발행되었으면 already_published가 정상입니다. 실제 공개는 dry_run=false도 시간 제한과 콘텐츠 검증을 지킨다.

게시 후 /publication.json의 호 ID·날짜/제목 주소의 기사·그림·Markdown·ZIP을 확인합니다. CI 성공과 사이트 반영, 이메일 API 수락과 받은편지함 도착은 서로 다른 상태입니다. 현재는 Pages Functions·D1·Resend를 사용하는 실제 구독과 정오 메일 발송 경로도 구현했습니다. 연결·권한·비밀값·한도·중복 방지에 관한 운영 지침은 ../docs/SUBSCRIPTIONS.md를 읽어 주세요. /api/status의 configured=true만으로 실제 메일 수신이 검증됐다고 판단하지 않습니다.

공식 근거: [Cloudflare Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [GitHub schedule의 지연·비활성화 조건](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
