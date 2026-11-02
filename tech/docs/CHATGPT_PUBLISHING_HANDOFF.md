# ChatGPT 인계 — 겜붕이의 노트

작성: 2026-11-03, Asia/Seoul. 이 문서는 개인 수신 주소·인증값을 포함하지 않아 공개 소스와 함께 보관할 수 있다. 최초 인계 문서 전체를 공개 저장소에 복사하지 않는다.

## 무엇을 이어받는가

한국어 게임 클라이언트 기술 뉴스레터다. 표시 이름은 **겜붕이의 노트**, 작은 서명은 **by TeamHJD**, 목표 도메인은 `https://tech.teamhjd.com`이다. ChatGPT는 매일 조사·원고·자료·GitHub 반영을 맡고, GitHub Actions는 검사·정적 빌드·설정 후 배포를 맡는다. 사용자 요청은 ChatGPT 예약을 통한 매일 퍼블리싱이며 별도 AI API 서버는 사용하지 않는다.

정본 저장소: https://github.com/Team-HJD-21/team-hjd-site

기존 PR: https://github.com/Team-HJD-21/team-hjd-site/pull/1

웹 소스는 `tech/`, 실제 운영 브랜치는 `main`이다. 기존 PR을 main에 반영해야 그 구현을 운영에서 쓸 수 있다. 아래 예약 프롬프트 역시 main에 문서와 코드가 들어간 뒤 사용한다.

## 이번 구현

- TeamHJD의 `#10191b` 배경, `#d9eea6` 강조색과 본문 스타일을 적용했다. 밝은 화면 전환도 유지한다.
- 페이지 상단은 작은 가로형 로고다. **원본 TeamHJD PNG의 로켓을 그대로 재사용**하고 새 한글 글자에 연필 질감을 맞췄다. by TeamHJD는 작은 서명이다. 탭 아이콘도 원본 로켓을 재사용한다. 커다란 삽화는 페이지에 넣지 않는다.
- 원본 PNG와 한글 lettering 소스는 `assets/brand/`, 실제 SVG 조합 코드는 `scripts/brand.mjs`다. 원본 그림을 다시 생성하지 않는다.
- 목록·기사·목차·세부 태그 검색·그림 확대·코드·표·수식·Markdown·ZIP 다운로드를 유지한다. 기존 샘플 URL `/articles/client-side-prediction/`도 유지한다.
- `<!-- article -->`로 유동적인 절 구성을 지원하고 호별 coverImage·format을 지원한다. JPG/WebP 등의 다운로드도 포함한다.
- 메타데이터·날짜·중복 ID/slug·태그·경로·자산·마지막 학습 절·일부 위험한 마크업을 검증한다. draft의 파일은 배포 산출물에 복사하지 않는다. 공개 저장소 자체는 비공개 초안 보관소가 아니다.
- `/publication.json`과 `/feed.xml`은 실제 published 호만 담는다. 샘플을 실제 발행으로 취급하지 않는다.

정확한 원고 계약은 [CONTENT_CONTRACT.md](CONTENT_CONTRACT.md), 예약에 붙일 프롬프트는 [CHATGPT_DAILY_PROMPT.md](CHATGPT_DAILY_PROMPT.md)다. 기술 정확성·링크의 사실성·영상 장면·이미지 이용권은 원고 작성자가 확인한다. 자동 검사만으로 편집 검증을 대체할 수 없다.

## 실제 운영 상태

2026-11-03 조회 시 기존 PR #1은 draft/open이고 Cloudflare 배포용 GitHub repository Secret·Variable 목록은 비어 있었다. 이 문서의 예시 URL은 배포 성공 증거가 아니다. 로컬 구현·검사 결과는 `tech/qa/README.md`의 이번 검증 항목을 확인한다. 계정 상태가 달라졌으면 최신 상태를 다시 조회한다.

현재 글은 `frame-2026-11-02` 샘플 한 편이다. 새 날짜로 복사해 정기 발행분처럼 표시하지 않는다.

메일은 기존 `integrations/cloudflare-email.mjs` 파일 기반 Node CLI만 있다. **상시 구독 서버·관리 UI·D1·정오 발송 스케줄러는 구현돼 있지 않다.** 이번 디자인 및 웹 원고 발행 계약 작업이 이 기능의 운영 완료를 뜻하지 않는다. 메일 CLI는 영구 디스크가 있는 Linux/macOS 대상으로 작성됐으며 Windows에서 디렉터리 fsync가 EPERM으로 실패했다. Windows에서 기록 보장을 제거해 억지로 운영하지 않는다. 실제 메일 등록·인증·발송·받은편지함 도착은 확인하지 않았다.

예약은 원래 인계 문서 기준 `겜붕이의 노트`(`6ae774bba4148191961bb42f0e193d6b`), 일시 중지, 매일 12:00 Asia/Seoul이다. 이 턴에서는 ChatGPT 예약의 실시간 상태를 조회·수정하지 않았다. 이전 예약(`6ae770fa2b148191b9db1650b0dc6a08`)과 새 예약을 동시에 켜지 않는다.

## 운영 연결을 완료하는 순서

1. 기존 PR의 CI와 diff를 검토하고 main에 병합한다. 회사 홈페이지 변경과 섞지 않는다.
2. Cloudflare에서 해당 계정에만 Pages Edit 권한을 가진 토큰을 생성하고 GitHub Actions Secrets에 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`을 등록한다. 비밀값을 ChatGPT에 붙이지 않는다.
3. 사이트 열람 범위를 결정한다. 기존 workflow의 `deploy` 체크는 공개 Pages 발행이다. 비공개를 원하면 운영 도메인과 `pages.dev`를 함께 보호한 다음 배포한다.
4. main의 **Build and deploy newsletter**를 수동 실행하고 공개 발행을 선택했다면 `deploy=true`를 지정한다. 실제 배포 단계가 skipped가 아닌 success인지 확인한다.
5. Cloudflare의 `gambungi-notes` 프로젝트에서 Custom domain으로 `tech.teamhjd.com`을 먼저 연결한 뒤 안내된 DNS만 적용한다. 기존 루트 홈페이지·MX·메일 인증 TXT를 바꾸지 않는다.
6. 실제 도메인의 로고·파비콘·기사·태그·이미지·Markdown·ZIP을 확인한다. GitHub Variable `NEWSLETTER_AUTO_DEPLOY=true`를 등록하면 이후 main의 tech 변경을 자동 배포한다.
7. 일반 ChatGPT 웹 채팅에서 예약 프롬프트로 새 한 호를 조사·작성하고 GitHub 반영부터 운영 URL 확인까지 한 번 수행한다. 연결된 GitHub 도구에 읽기만 있고 쓰기가 없다면 예약만으로 해결되지 않는다. 승인·브랜치 보호가 막으면 pending으로 기록한다.
8. 수동 시험이 성공한 뒤 기존 예약의 프롬프트를 갱신하고 활성화한다. 실제 예약 첫 실행에서도 같은 클라우드 도구·권한을 쓰는지 확인한다. 로컬 폴더 유지에 의존하지 않는다.

메일까지 운영하려면 별도로 구독의 영구 저장소·관리 인증·발송 선점·중복 방지·로그를 구현·배포하고, Cloudflare destination 소유 확인과 실제 수신 시험을 마친 뒤 정오 발송 스케줄을 연결해야 한다. 기존 CLI의 영구 상태를 임시 GitHub runner 파일로 대체하지 않는다. 자세한 경계는 [integrations/README.md](../integrations/README.md)를 따른다.

## 시간과 성공 판정

12시 예약은 **작성을 시작하는 시간**이다. 목표가 정오에 웹 게시·메일 발송 준비 완료라면 ChatGPT 준비 작업을 예를 들어 10:30 Asia/Seoul로 앞당기고 정오 발송을 분리한다. 이 시간은 운영 제안이며 예약을 변경했다는 뜻이 아니다. 초 단위 게시·받은편지함 도착을 보장하지 않는다.

각 실행은 원고 작성 → GitHub 반영 → CI 검사 → 실제 배포 → 운영 기사 확인 → (별도 연결 후) 메일 API 처리 → 실제 받은편지함 확인을 구분해 보고한다. 어느 단계든 실패하면 지난 호를 오늘 글처럼 게시하거나 중복 발송하지 않는다. 0개의 published 항목은 현재 샘플만 있는 상태에서 정상이다.

## 공식 근거

ChatGPT 웹 예약은 연결된 도구와 업로드 문맥을 사용할 수 있지만 로컬 폴더를 계속 보존하지 않는다. 예약 전에 일반 웹 채팅에서 프롬프트를 시험하고 실제 초기 실행을 확인한다. 계정별 권한과 제공 여부는 별도다. [OpenAI Scheduled tasks](https://learn.chatgpt.com/docs/automations), [예약 작업 설정](https://developers.openai.com/training/walkthroughs/scheduled-tasks).

배포의 계정·도메인 연결은 [Cloudflare CI Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)와 [DEPLOY.md](../deploy/DEPLOY.md)를 확인한다.
