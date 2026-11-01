# 겜붕이의 노트: GitHub → Cloudflare Pages 배포

소스 저장소는 `Team-HJD-21/team-hjd-site`, 사이트 소스는 `tech/`, 운영 브랜치는 `main`, Pages 프로젝트는 `gambungi-notes`로 고정한다. GitHub Actions가 Node.js 22와 Pandoc으로 빌드하고 **`tech/dist/`만** 업로드한다. 기존 회사 사이트와 메일 DNS를 변경하는 작업은 없다.

## 1. 파일 반영

| 준비된 파일 | 저장소 위치 |
| --- | --- |
| `.github/workflows/deploy-newsletter.yml` | 저장소 루트에 설치된 실제 워크플로 |
| `tech/deploy/ensure-pages-project.mjs` | 그대로 유지 |
| `tech/deploy/ensure-pages-project.test.mjs` | 그대로 유지 |

배포 워크플로와 아래 안내는 기존 PR에 함께 포함되어 있다. PR을 확인하고 `main`에 병합한다. 기본 상태에서는 빌드와 다운로드용 `gambungi-notes-site` 아티팩트 생성만 실행한다. 배포 버튼을 체크하지 않은 수동 실행도 동일하다. 이 단계에는 Cloudflare 자격 증명이 필요 없다.

## 2. 최초 1회: 비밀값 두 개 등록

Cloudflare의 **My Profile → API Tokens → Create Token → Create Custom Token**에서 권한을 **Account → Cloudflare Pages → Edit**, 계정 범위를 사용할 계정 하나로 제한한다. 해당 계정의 Account ID도 확인한다.

GitHub 저장소의 **Settings → Secrets and variables → Actions → New repository secret**에서 아래 두 값을 등록한다. 토큰은 채팅이나 코드에 붙이지 않는다.

| Secret 이름 | 값 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | 사용할 Cloudflare 계정의 Account ID |
| `CLOUDFLARE_API_TOKEN` | 위에서 생성한 토큰 |

## 3. 첫 공개 발행

**Cloudflare Pages는 기본적으로 공개 웹사이트다.** 아래 체크박스는 사이트를 공개 발행한다는 선택이다. 이메일 수신자를 한 명으로 제한하는 것과 사이트 열람을 한 명으로 제한하는 것은 별개다. 비공개 열람이 필요하면 이 단계에서 멈추고, 해당 사이트의 운영 주소와 `pages.dev` 접근 경로까지 보호하는 Cloudflare Access 구성을 먼저 완료해야 한다. 이 워크플로는 Access 설정을 생성하지 않는다.

GitHub **Actions → Build and deploy newsletter → Run workflow**에서 브랜치 `main`을 선택하고 **Publish the website publicly to Cloudflare Pages**를 체크한 뒤 실행한다.

워크플로는 지정 계정의 `gambungi-notes`를 조회한다. 404일 때만 Direct Upload 프로젝트를 새로 만들며, 다른 오류는 즉시 중단한다. 같은 이름의 기존 프로젝트가 있으면 이 뉴스레터 전용 프로젝트인지 먼저 확인한다. Git 연동 프로젝트이거나 운영 브랜치가 `main`이 아니면 변경하지 않고 중단한다. ZIP 업로드나 최초 프로젝트 수동 생성은 필요 없다.

배포 결과에 표시되는 실제 `*.pages.dev` 주소에서 PC·모바일을 확인한다. 이미 확인한 로컬 화면과 별개로 실제 운영 주소의 이미지·영상·검색·태그·Markdown 다운로드를 확인한다.

## 4. 도메인 연결

Cloudflare **Workers & Pages → gambungi-notes → Custom domains → Set up a domain**에서 `tech.teamhjd.com`을 추가한다.

- `teamhjd.com` DNS를 같은 Cloudflare 계정에서 관리하면 안내에 따라 해당 서브도메인의 CNAME 생성을 확인한다.
- 외부 DNS에서 관리하면 Pages에서 도메인을 먼저 연결한 뒤, `tech`의 CNAME을 배포 결과에 나온 실제 Pages 호스트명으로 설정한다.
- 회사 홈페이지의 루트 레코드, MX, 메일 인증용 TXT는 수정하지 않는다. 기존 `tech` 레코드가 다른 서비스를 가리키면 소유 용도를 확인한 뒤 변경한다.

DNS에 CNAME만 먼저 추가하면 Pages 프로젝트와 연결되지 않아 522 오류가 날 수 있다. HTTPS와 도메인이 활성화된 뒤 `https://tech.teamhjd.com`에서 다시 확인한다.

## 5. 이후 자동 배포

첫 발행을 확인한 뒤 GitHub **Settings → Secrets and variables → Actions → Variables → New repository variable**에 `NEWSLETTER_AUTO_DEPLOY` = `true`를 등록한다. 이후 `main`의 `tech/**` 또는 배포 워크플로 변경을 빌드·배포한다. 변수 등록 자체는 배포를 실행하지 않는다. 변수를 지우거나 `false`로 바꾸면 자동 배포가 중지된다. 수동 발행은 계속 가능하다.

이 구성은 **사이트 배포**를 완성한다. 정오 기사 생성, 승인된 이메일 구독자 등록, 발행 알림 전송은 별도 자동화이며 이 워크플로에서 동작하지 않는다. Direct Upload 프로젝트는 나중에 Cloudflare 기본 Git 연동 모드로 전환할 수 없지만 GitHub Actions를 통한 자동 배포는 계속 사용할 수 있다.

## 검증과 공식 문서

`node --test tech/deploy/ensure-pages-project.test.mjs`는 모의 응답만 사용하며 실제 Cloudflare에 접속하지 않는다. GitHub Actions의 액션은 공식 저장소의 확인된 v6/v4 태그 커밋으로 고정했다.

- [Cloudflare: CI로 Direct Upload 배포, API 토큰과 GitHub Secrets](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Cloudflare: Direct Upload와 모드 제한](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare: Pages 프로젝트 생성 API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/create/)
- [Cloudflare: Pages 프로젝트 조회 API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/get/)
- [Cloudflare: 사용자 도메인 연결과 CNAME](https://developers.cloudflare.com/pages/configuration/custom-domains/)
