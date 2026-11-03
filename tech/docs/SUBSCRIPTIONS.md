# 이메일 구독 운영

공개 구독 폼은 /subscribe/입니다. Pages Functions의 /api/subscribe → Resend 인증 메일 → /subscription/confirm/의 확인 버튼 → active 구독 흐름을 사용합니다. GET만으로는 인증·해지를 처리하지 않습니다. 개인정보 안내는 /subscription/privacy/입니다. 세 동의를 각각 받고 버전 2026-11-03과 시각을 저장합니다.

비공개 D1 DB gambungi-notes-subscribers를 DB로 바인딩합니다. DB ID는 5bd001df-07d9-4e3c-ae5b-ea2cfc384f89입니다. Pages 생산 환경에 RESEND_API_KEY와 TOKEN_SECRET을 Secret 형식으로 저장합니다. 발송 키는 news.teamhjd.com 한 도메인의 Sending access로 제한합니다. 키 값은 문서·Git·화면 캡처에 남기지 않습니다. TOKEN_SECRET을 교체하면 기존 해지 링크와 이메일 HMAC 연결이 달라지므로 별도 데이터 이전 없이 교체하지 않습니다.

발송 도메인은 Resend Tokyo입니다. Cloudflare DNS에 새 TXT resend._domainkey.news, DNS 전용 CNAME rsend.news → rsend-apne1.forge.rmta.net, send.news → send.forge.rmta.net만 추가했습니다. 기존 회사 루트 MX/SPF는 변경하지 않았습니다. 수신 기능과 추적용 도메인은 만들지 않습니다. TLS는 Enforced로 설정하며, TLS를 지원하지 않는 수신 서버에는 전달이 실패할 수 있습니다.

정오 워크플로의 deliver.mjs가 실제 공개 매니페스트를 기다린 뒤 GitHub Actions OIDC로 /api/internal/deliver에 요청합니다. 서버는 서명·발급자·대상·만료·저장소·main·정확한 워크플로를 확인합니다. 관리 API는 수신자와 메일 본문을 입력받지 않습니다. 확인된 당일 published 호의 안내만 active 구독자에게 보냅니다.

한 호출은 6명 이하, 한 실행은 16개 묶음 이하입니다. 앱의 전체 이메일 발송 시도는 인증·관리 메일 포함 UTC 하루 90건 이하입니다. 같은 Resend 계정의 다른 발송·월 한도까지 예약하는 값은 아니며, 제공자가 거절하면 실패로 남깁니다. 결제나 유료 전환은 하지 않습니다. 90명을 넘는 운영 규모에서는 무료 플랜 용량과 인증 메일 여유를 먼저 검토해야 합니다.

구독자 수·한도·일별 발송 내역은 [로컬 운영 관리](LOCAL_MONITOR.md)에서 확인합니다. 공개 관리자 목록은 제공하지 않습니다. 새 발송의 제목·본문 사본은 확인·해지 토큰을 제거한 뒤 30일간 보관합니다. 로컬 조회용 보고서는 서버에서 암호화해 전송하며 GitHub 임시 저장소에는 암호문만 1일간 남습니다.

인증 발송 후 입력을 잠그고 sessionStorage의 24시간 상태 토큰으로 /api/subscription-status를 조회합니다. 서버에는 해시만 저장하며 URL이나 조회 본문에 이메일을 넣지 않습니다. 완료 후 원래 탭을 자동 갱신하며 beforeunload 경고와 임시 저장을 해제합니다. 메일을 열기만 해서는 인증하지 않습니다. 대기 화면을 복원할 때도 서버 상태를 확인합니다.

/subscription/manage/의 이메일 폼은 /api/manage로 관리·해지 링크를 요청합니다. 인증·정기·관리 메일 모두 눈에 띄는 서명된 해지 링크를 제공합니다. 최종 해지 버튼을 누를 때 이메일을 삭제합니다. 관리 요청 자체로 해지하지 않습니다. 같은 10분 구간의 관리 메일은 중복 발송하지 않습니다.

중복 방지 기록은 D1 deliveries에 메일 목적·호·임의 구독 ID를 기준으로 보관하고, Resend Idempotency-Key를 함께 사용합니다. 응답 유실·오류·quota 상태는 GitHub Actions 실패로 알립니다. 제공자 기록을 확인하기 전에는 receipt 삭제·수신자 ID 교체·이전 호 복제로 재전송하지 않습니다. queued는 API 수락이며 실제 수신 증거가 아닙니다.

확인하지 않은 구독은 7일 후, 임의 식별자로 남긴 발송 기록은 30일 후, rate limit HMAC은 약 24시간 후 서비스 요청 시 정리합니다. 원본 IP를 DB에 저장하지 않습니다. 매일 정오 API가 호출되므로 정상 운영에서는 매일 정리됩니다. 해지 시 이메일이 담긴 subscribers 행은 즉시 삭제합니다. 제공자의 백업·로그는 해당 정책을 따릅니다. 반송·스팸 신고는 현재 Resend 운영 화면에서 확인해야 하며 자동 webhook 억제는 아직 구현하지 않았습니다. 서버의 suppress 대상이 누적되면 운영자가 해지·삭제 처리와 동의 기록을 확인해야 합니다.

검사는 npm run test:subscriptions입니다. 실제 메일을 보내지 않는 SQLite·Resend 모의 검사이며, 실메일 인증·해지는 배포 후 별도로 확인합니다. 로컬 정적 Python 서버에서는 /api가 실행되지 않습니다. /api/status는 연결 여부 boolean만 반환하며 구독자 목록·집계는 공개하지 않습니다.

근거: [Resend API](https://resend.com/docs/api-reference/emails/send-email), [Idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [무료 한도](https://resend.com/pricing), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
