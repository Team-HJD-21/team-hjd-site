# 일일 발행 사전 기동과 장애 복구

2026-11-04 운영 보완입니다. 기존 11시 원고 준비 후 cron만 기다리는 절차를 대체합니다. 편집 기준·원래 ID·하루 한 호·동의된 구독자·메일 중복 방지는 그대로입니다.

## 주 경로

1. 기존 11:00 Asia/Seoul 예약이 최신 main과 편집·원고 계약을 읽고 당일 호를 준비합니다. 이미 scheduled 호가 있으면 새 글은 만들지 않되 아래 사전 기동 단계는 생략하지 않습니다.
2. 원고·그림·태그와 Validate newsletter 성공을 확인합니다. scheduled와 publishAt=당일 11:57:00+09:00을 유지합니다.
3. 당일 발행 workflow가 이미 queued/in_progress 또는 발송 완료이면 중복 기동하지 않습니다.
4. 최신 main을 다시 읽고 **별도 커밋 하나**로 tech/operations/release-request.json만 추가·수정합니다. 원고 작업의 허용 범위에 이 운영 요청 파일 하나만 추가합니다. 코드·권한·DNS·Secrets·구독자·발송 기록은 일일 작업 범위가 아닙니다.
5. RECOVERY.md의 계약을 사용합니다. version=1, 고유 requestId, 실제 오늘 date·기존 issueId, 실제 requestedAt, 정확히 60분 뒤 expiresAt, allowLate=false, dryRun=false, confirm=publish-and-send-once, 직전 main SHA인 expectedBaseSha, 개인정보 없는 사유를 기록합니다. 11:00 이후 작성하며 expiresAt은 11:58보다 늦어야 합니다.
6. main push가 기존 publish-newsletter.yml을 기동합니다. 실제 run ID, push 이벤트와 사전 기동 단계를 확인해야 합니다. 커밋 성공만으로 실행을 추정하지 않습니다.
7. 이미 시작된 runner가 시계를 확인하며 11:57까지 대기합니다. 새 cron 이벤트를 기다리지 않습니다. 전체 제한은 90분입니다. 날짜·승인 만료·12:30 마감은 그대로입니다.
8. 이후 검사·정확한 호 선택·빌드·비강제 상태 커밋·Cloudflare 실제 매니페스트 확인·기존 메일 발송 API를 사용합니다. 배포 전에는 발송하지 않습니다.

## 보조 경로

11:57, 12:03, 12:09, 12:17, 12:23 cron은 보조입니다. 기존 concurrency와 영구 receipt를 유지합니다.

12:07 ChatGPT 점검은 성공해도 결과를 보고합니다. 유효한 당일 원고와 CI가 있고 실행 중 작업이 없다면 같은 allowLate=false 요청 push로 보조 기동할 수 있습니다. workflow_dispatch 도구가 없어도 이 경로가 있습니다. 실제 실행 결과를 조회하며 커밋만 성공했다고 복구 완료로 보고하지 않습니다. 12:30 이후 새 공개는 사람의 명시적 승인 없이 하지 않습니다. uncertain·pending·rejected·quota 기록을 지우거나 ID를 바꿔 재전송하지 않습니다.

cron 이벤트 생성 의존은 줄어들지만 ChatGPT 실행, GitHub Actions 전체, Cloudflare, 메일 제공자나 수신 서버의 장애가 없어지는 것은 아닙니다. 정확한 받은편지함 도착 시각을 절대 보장했다고 말하지 않습니다. 첫 무인 사전 기동·시각 대기·발행은 별도 실증 대상입니다.

## 실제 메일 없는 검사

dryRun=true 요청은 대기를 건너뛰고 공개 상태를 변경하지 않으며 Deliver 단계가 실행되지 않습니다. 모의 구독 검사는 실제 키를 사용하지 않습니다. published 글은 inspect-live.mjs로 매니페스트·기사·그림 바이트·Markdown·ZIP·RSS를 GET만 사용해 검사합니다. 이 모듈에는 인증 토큰이나 발송 호출이 없습니다. mailSent=false는 그 검사에서 발송하지 않았다는 뜻입니다.

10분 간격 임시 예약 진단 workflow는 제거했습니다. 과거 기록은 보존합니다. 수동 push 성공을 실제 cron 시험 성공으로 혼동하지 않습니다.

## 11월 4일 실제 복구 근거

실행 41832512543은 21:48:49 KST에 push로 시작했습니다. 원래 ID note-2026-11-04-reversed-z를 공개하고 운영 매니페스트를 확인한 뒤 21:50:23 KST에 queued=6, remaining=0, unresolved=0, quota=0, rejected=0, uncertain=0을 기록했습니다. 이것은 메일 제공자 수락이며 받은편지함 도착과는 다릅니다. 개인 주소·키는 기록하지 않습니다.
