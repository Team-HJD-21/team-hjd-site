# 겜붕이의 노트

매일 하나씩 알아가는 호기심 가득한 게임 개발. TeamHJD의 정식 기술 뉴스레터입니다.

운영 주소는 https://tech.teamhjd.com/ 입니다. 글 목록 /, 태그 검색 /tags/, 구독 /subscribe/를 제공합니다. 글 주소는 /YYYY-MM-DD/제목-slug/이며 이전 /articles/제목-slug/은 301 이동합니다.

## 작성과 빌드

Node.js 22.16 이상과 Pandoc을 사용합니다. npm run validate, npm run test:content, npm run test:subscriptions, npm run build로 검사·빌드합니다. Cloudflare의 npm run build:cloudflare는 공식 Pandoc 3.13을 고정 해시로 검증해 임시 사용하며 전체 검사를 실행합니다. 산출물은 dist/입니다. Pages Functions는 functions/에서 별도 번들됩니다.

본문·태그·그림은 content/와 assets/issues/에서 관리합니다. 친숙한 존댓말, 초기 원고 대비 난이도 약 8/10, 다크 모드 그림, 정식 글 원칙은 [EDITORIAL.md](docs/EDITORIAL.md)를 따릅니다. 파일 형식은 [원고 계약](docs/CONTENT_CONTRACT.md)을 읽어 주세요. 직접 만드는 그림·수치 예시는 근거와 캡션을 함께 둡니다.

## 발행과 구독

ChatGPT의 기존 클라우드 예약은 매일 11:00 Asia/Seoul에 scheduled 원고를 준비합니다. 승인된 발행 요청으로 미리 기동한 GitHub Actions worker가 11:57에 당일 한 호만 published로 전환하고 Cloudflare Git integration이 검사·배포합니다. 정오 발송을 목표로 하며 cron 예비 점검도 유지합니다. 운영 매니페스트 반영을 확인한 뒤 동의·이메일 확인을 완료한 구독자에게 Resend로 안내 메일을 보냅니다. 중복 방지 기록은 비공개 D1에 저장합니다. API 수락과 실제 이메일 수신은 구분합니다.

구독은 개인정보 수집·이용, 이메일 수신, 국외 이전 동의를 각각 받습니다. 인증 링크는 24시간 유효하고, 해지 시 이메일 주소를 삭제합니다. 키·개인 주소·수신자 목록·발송 기록을 공개 Git이나 정적 산출물에 넣지 않습니다. 자세한 설정은 [구독 운영](docs/SUBSCRIPTIONS.md), [배포 안내](deploy/DEPLOY.md)를 확인해 주세요. integrations/는 이전 영구 디스크용 도구이며 현재 공개 구독 서버의 경로가 아닙니다.

[GPT 인계](docs/CHATGPT_PUBLISHING_HANDOFF.md)와 [예약 프롬프트](docs/CHATGPT_DAILY_PROMPT.md)를 함께 전달해 주세요. 기존 ChatGPT 예약의 실제 수정·첫 실행은 GPT가 연결 도구를 확인한 뒤 수행해야 합니다. 예약·빌드 큐 지연 때문에 정확한 12:00 반영을 보장하지 않습니다.

반복 실행의 구분과 실패 후 최종 보고 원칙은 [작업별 실행·완료 처리](docs/WORKFLOW_COMPLETION.md)를 확인해 주세요. 실행 중인 발행 worker를 취소하거나 같은 요청을 다시 만들지 않습니다. 관리 화면은 최초 1회 조회 후 수동이 기본이며, 자동 조회를 켠 경우에만 5분마다 조회 workflow가 실행됩니다.

회사 사이트와의 색상·폰트·푸터 연결은 [공통 디자인](docs/SHARED_BRAND.md), 원본 로켓·워드마크·탭 아이콘은 [브랜드 출처](docs/BRAND_SOURCES.md)를 따릅니다.
