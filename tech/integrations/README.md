# Cloudflare 이메일 알림 연결

Node 20.11 이상과 영구 디스크를 갖춘 Linux/macOS 런타임에서 실행하는 작은 운영용 CLI다. 정적 사이트와 분리되어 있으며, 현재 계정 연결·DNS 변경·메일 발송·스케줄 등록은 하지 않았다. 사이트의 등록 화면과 아래의 후속 API 계약도 아직 연결되지 않았다.

## 현재 제공하는 동작

`register → Cloudflare 확인 메일에서 인증 → activate → send` 순서다. Cloudflare 계정의 destination 주소가 검증되어 있고 **이 뉴스레터의 목록에서도 활성 상태인 주소**에만 한 명씩 보낸다. 계정의 전체 destination 목록은 발송 목록으로 사용하지 않는다. 등록만으로는 활성화되지 않는다.

`BOOTSTRAP_RECIPIENT`는 첫 수신자를 런타임에서 전달하는 비밀값이다. 실제 주소·토큰을 코드, 브라우저 번들, Git, 빌드 산출물에 넣지 않는다. `.env.example`은 빈 설정 목록이며 CLI는 `.env`를 자동으로 읽지 않는다.

| 런타임 변수 | 값 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | 대상 계정 ID |
| `CLOUDFLARE_API_TOKEN` | 해당 계정의 destination 주소 관리·조회와 이메일 발송 권한을 가진 API 토큰 |
| `BOOTSTRAP_RECIPIENT` | 최초 수신자의 실제 주소 |
| `NEWSLETTER_FROM` | Cloudflare에서 사용할 수 있게 설정한 발신 주소 |
| `NEWSLETTER_STATE_DIR` | **저장소 밖** 전용 영구 저장 디렉터리의 절대 경로 |

상태 디렉터리는 단일 운영 프로세스/러너들이 공유하는 지속성 있는 볼륨이어야 한다. 임시 CI 작업 공간으로 매번 초기화하면 수신자 목록과 중복 방지 기록을 잃는다. CLI는 프로젝트 내부 경로와 그쪽으로 향하는 심볼릭 링크를 거부하고, 새 디렉터리와 파일에 각각 `0700`/`0600` 권한을 사용한다. 다른 서비스의 디렉터리를 지정하지 않는다. 실제 설정은 비공개 런타임/시크릿 저장소에서 주입한다.

## 실행

프로젝트 루트에서 먼저 로컬 검사만 실행할 수 있다. 아래 두 명령은 실제 API를 호출하지 않는다.

```sh
node --test integrations/cloudflare-email.test.mjs
node integrations/cloudflare-email.mjs send --issue integrations/issue.example.json --dry-run
```

`issue.example.json`의 URL은 예시다. 실제 발행된 URL로 바꾼 별도의 호별 JSON을 준비한다. 형식은 `{ "id": "고유한-호-ID", "title": "제목", "url": "https://발행된-글-주소", "summary": "알림에 실을 짧은 소개" }`이며 ID는 영문 소문자·숫자·점·밑줄·하이픈을 사용한다. HTML은 CLI가 이스케이프하고 직접 생성한다.

다음은 계정 연결과 런타임 설정 이후 사용하는 **실제 운영 명령**이다. `register`는 필요할 때 Cloudflare에 주소를 등록하므로 확인 메일이 발생할 수 있고, `send`는 실제 메일을 발송한다.

```sh
node integrations/cloudflare-email.mjs register
node integrations/cloudflare-email.mjs check
# 수신자가 Cloudflare 확인 메일의 링크를 누른 뒤
node integrations/cloudflare-email.mjs activate
node integrations/cloudflare-email.mjs send --issue /private/published-issue.json
node integrations/cloudflare-email.mjs receipt --issue-id sample-001-network-prediction
```

추가 수신자는 별도 비공개 환경 변수에 주소를 넣고 `register`, `check`, `activate`에 `--email-env ADDITIONAL_RECIPIENT`를 전달한다. `send`는 선택 변수와 무관하게 뉴스레터 목록의 활성 수신자만 처리한다. 중단은 `deactivate` 명령이며, 공유 Cloudflare destination 자체를 삭제하지 않는다. 콘솔에는 주소 대신 수신자 해시를 표시한다. 이 CLI는 일반적인 대소문자 비구분 ASCII 메일 주소를 대상으로 한다.

## 발송 기록과 재실행

각 발송은 `(Cloudflare 계정, 고정된 호 ID, 수신자)` 조합으로 기록한다. 호별로 발송 내용과 발신 주소의 해시도 보관하므로 같은 ID의 내용을 바꿔 다시 보내려 하면 새로 추가된 수신자까지 포함해 차단한다. 다른 호와 다른 수신자는 별도 발송 기록이다. 발송 직전 Cloudflare destination을 다시 조회해 검증 상태와 주소 일치를 확인한다.

POST 전에 `pending` 기록을 저장하고, 결과에 따라 다음 상태로 갱신한다.

| 기록 | 의미 / 다음 실행 |
| --- | --- |
| `provider_delivered` | API의 `delivered` 그룹에 들어감. 재발송하지 않음 |
| `queued` | Cloudflare 대기열에 들어감. 재발송하지 않음 |
| `permanent_bounce` | API가 영구 반송으로 분류함. 재발송하지 않음 |
| `rejected` | API가 요청을 거부함. 원인을 확인할 때까지 재발송하지 않음 |
| `pending` / `uncertain` | 실행이 중단되었거나 API 응답이 불명확함. 재발송하지 않음 |

`apiAccepted: true`는 API 응답에 해당 수신자의 처리 결과가 있다는 뜻이다. `provider_delivered`도 수신자가 받은편지함에서 읽었다는 증명은 아니다. 이 구현은 도착/열람을 추적하지 않으므로 `inboxConfirmed`는 항상 `false`다. 이후 대기열 결과를 자동 조회하는 작업도 아직 없다.

성공 응답 누락에 대비해 Cloudflare가 이 엔드포인트에서 보장하지 않은 idempotency key를 가정하지 않는다. `newsletter.lock`으로 동시 실행을 막고 모든 기존 receipt를 재발송 차단에 사용한다. 중단된 작업의 잠금이나 거부/불명확한 receipt를 자동 삭제하는 기능은 없다. 운영자가 Cloudflare 로그와 실제 수신 여부를 확인하고 비공개 기록을 백업한 뒤 복구를 판단해야 한다. 잠금 파일을 없애더라도 receipt가 남아 있으면 재발송하지 않는다. **기록을 지우거나 호 ID를 바꿔 재시도를 강행하지 않는다.** API 실패 코드와 HTTP 상태는 receipt에서 확인한다. CLI는 미검증/거부/불명확한 결과에 종료 코드 `2`, 입력·설정 오류에 `1`을 반환한다.

## 실제 연결 때 필요한 작업

1. Cloudflare 계정에서 Email Service 사용 가능 여부와 발신 도메인 설정을 확인한다. REST API는 계정 미허용 시 `403 / 10105`를 반환할 수 있다. 성공을 흉내 내는 대체 경로는 없다.
2. 해당 계정으로 범위를 제한한 API 토큰을 만든다. destination 등록에는 `Email Routing Addresses Write`, 조회에는 Read 또는 Write, 발송에는 Email Sending 권한이 필요하다. 발송 전용 토큰을 따로 운영하려면 런타임에서 명령별 토큰을 바꿔 주입할 수 있다.
3. 발신 도메인을 설정하고 토큰·첫 주소·발신 주소·영구 상태 경로를 비공개 런타임에 연결한다. DNS 변경과 실제 발송은 이 소스 작성 단계에서 수행하지 않았다.
4. 첫 주소 등록·소유 확인·활성화 후 발행된 글 한 호로 실제 수신을 확인한다. 자동 발행 작업과의 연결은 그 다음 단계다.

## 작은 관리 화면용 후속 API 계약 — 아직 미구현

관리 화면과 API는 Cloudflare Access의 **지정 관리자 이메일 allowlist + OTP**로 보호한다. API 토큰은 서버에만 두고 Access JWT를 서버에서 검증한다. Access 로그인은 관리 권한 확인이고, 수신 주소의 소유 확인은 Email Routing destination의 `verified` 값으로 별도 처리한다. Turnstile은 봇 방지이며 이메일 소유 확인을 대신하지 않는다.

| 엔드포인트 | 계약 |
| --- | --- |
| `POST /api/admin/recipients` | `{ email }` 수신 → destination 조회/등록 → 뉴스레터 상태 `pending`; 실제 API 성공 후에만 등록 결과 반환 |
| `GET /api/admin/recipients/:id` | 관리 권한 확인 후 destination의 최신 `verified`와 뉴스레터 `active` 반환 |
| `PATCH /api/admin/recipients/:id` | `{ active: true }`는 최신 Cloudflare 검증 성공 시만 허용; `false`는 로컬 목록 비활성화 |

호 발송은 이 등록 API와 분리된 운영 작업이다. 브라우저가 임의의 본문·수신자로 메일을 보내는 엔드포인트는 만들지 않는다. 계정 연결이 없으면 `503 integration_not_configured`, 아직 검증되지 않은 활성화 요청은 `409 recipient_unverified`를 반환한다. 이 계약을 구현할 때 서버의 영구 저장소와 원자적 잠금/receipt도 함께 옮겨야 한다. 현재 파일 기반 CLI를 일회성 서버리스 파일 시스템 위에서 그대로 실행하면 안 된다.

## 확인한 공식 문서

2026-11-01 확인. 현재 REST 요청은 `POST /accounts/{account_id}/email/sending/send`의 `to`, `from`, `subject`, `html`, `text` 필드를 사용한다. 결과는 `delivered`, `queued`, `permanent_bounces` 배열이며 Workers API의 `messageId` 반환과 다르다.

- [Email Service REST 발송 API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/)
- [Destination 등록 API](https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/create/), [조회 API](https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/get/), [목록·페이지 매김 API](https://developers.cloudflare.com/api/resources/email_routing/subresources/addresses/methods/list/)
- [Destination 주소 확인 절차](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)
- [발신 도메인 설정](https://developers.cloudflare.com/email-service/get-started/send-emails/), [서비스 제한](https://developers.cloudflare.com/email-service/platform/limits/)
- [Access OTP](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/), [Access 정책](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/)
