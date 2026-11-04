# 2026-11-05 운영 검수와 ChatGPT 연결 시험

기준 main은 21bd511394fd0d82e4a661a5cfee3cccd2514864입니다. 검수 패치의 최종 SHA·CI·Cloudflare·예약 실증 결과는 별도 최종 보고서에 기록합니다. 이 문서의 절차 자체가 실행 성공 증거는 아닙니다.

## 현재 확인된 범위

실제 ChatGPT 예약 UI에서 매일 11:00 원고 준비와 12:07 점검이 활성 상태임을 확인했습니다. 기존 예약·시각·편집 기준은 변경하지 않았습니다. 저장된 프롬프트에는 DAILY_RELIABILITY.md의 사전 기동이 이미 포함돼 있습니다. 11월 4일의 원고 실행은 기존 원고를 읽고 건너뛰었으므로 새 원고·그림 전달이나 사전 기동 성공의 증거가 아닙니다. 당시 점검은 새 workflow를 시작할 도구가 없어 복구하지 못했다고 보고했습니다. 최신 도구의 실제 쓰기·기동·결과 조회는 **ChatGPT 연결 검증 대기**입니다.

## 이번 최소 보완

- 공개 매니페스트의 contentVersion과 기사 HTML의 note-content-version을 검증합니다. 검증한 metadata·본문·이미지 SHA256으로 계산하며 status/publishedAt은 제외합니다. 같은 호 ID의 이미지 수정도 이전 배포와 구별합니다. 발송 직전 서버도 전달된 contentVersion을 재확인합니다. 기존 receipt와 호 ID를 바꾸지 않습니다.
- 이전 문서의 원고 준비 후 cron 대기 지침을 실제 저장된 사전 기동 지침과 맞췄습니다.
- 진단 workflow는 contents:read만 사용하고 OIDC·Resend 키가 없습니다. shared release gate는 write:false이며 네트워크는 운영 공개 GET만 허용합니다. 발행 workflow나 deliver entry point를 호출하지 않습니다. 이 별도 진단은 정오의 양수 대기·메일 경로 전체를 증명하지 않습니다.

## 연결 시험 입력 계약

Cloud ChatGPT의 실제 도구가 있어야 합니다. Codex의 gh나 로컬 Git 성공으로 대체하지 않습니다. 매일 콘텐츠는 CONTENT_CONTRACT.md의 원고·이미지·메타데이터·태그를 최신 main 기반으로 일관되게 커밋하고, 검사 후 release-request.json 하나만 별도 커밋으로 비강제 push합니다. 이 파일의 정확한 필드·만료·기존 ID·날짜 검증은 RECOVERY.md를 따릅니다. 보호·승인에 막히면 pending으로 보고하고 우회하지 않습니다.

무발송 연결 시험은 실제 호를 만들지 않습니다. 먼저 tech/assets/audit-probe-20261105/probe.svg에 외부 참조·스크립트 없는 다크 SVG와 '겜붕이' 글자를 쓰고, 이어 tech/operations/audit-canary.json만 커밋합니다. JSON은 아래와 같습니다.

```json
{"nonce":"audit-20261105-cloud-no-send","readOnly":true,"message":"겜붕이의 노트 UTF-8 연결 검수","source":"ChatGPT cloud scheduled diagnostic"}
```

이 경로는 audit-no-send.yml만 기동하며 production release-request.json은 건드리지 않습니다. 파일의 UTF-8 왕복, main SHA, 정확한 push run ID, readOnly=true/mailSent=false/postRequests=0, 이미지 hash, 공개 GET 검사 결과를 실제 예약 도구로 확인해야 합니다. 제공되는 도구의 실제 이름과 승인 대기 여부도 보고합니다. 기존 파일이 다르면 덮어쓰지 말고 멈춥니다. 두 정기 예약을 새로 복제하지 않습니다.

## 12:07 기존 예약에 유지할 최종 점검 지침

오늘의 정확한 호·날짜와 최신 main, 실제 운영 매니페스트와 기사를 읽습니다. actions/runs에서 정확한 workflow, 오늘의 event/created/head_sha와 페이지를 확인합니다. PR 전용 실행 조회를 전체 실행 조회로 오인하지 않습니다. 각 run의 최신 attempt와 Deliver 단계·집계·이전 API 수락을 읽습니다. remaining=0만으로 성공이라고 말하지 않습니다. 원고 준비/기동/웹 공개/API 수락/실제 수신을 나눠 보고하며 구독자·토큰·메일 원문은 조회하지 않습니다.

진행 중인 당일 실행이 있으면 중복 기동하지 않습니다. 유효한 당일 한 호·CI가 확인되고 미실행이면 RECOVERY.md의 allowLate=false 별도 요청 push가 허용됩니다. 최대 1시간, expiresAt<=당일12:30으로 제한합니다. 안전한 일시 장애의 실패-job 재실행은 한 번만 허용하되 이미 메일 처리 후 부가 검사만 실패했다면 발송은 재실행하지 않습니다. 12:30 이후 새 공개는 별도 사람 승인 없이는 하지 않습니다. receipt 삭제, ID 변경, 이전 호 대체, Resend 직접 호출, 승인·인증·브랜치 보호 우회는 금지합니다. 실행 도구가 없으면 ChatGPT 연결 검증 대기로 알리고 완료라고 하지 않습니다.

## 중복 방지와 남은 경계

원래 subscriber ID가 유지되는 동안 INSERT OR IGNORE 영구 receipt와 제공자 idempotency key로 동시·반복 발송을 막습니다. quota/rejected/uncertain/pending은 미해결로 남고 자동 재전송하지 않습니다. provider key의 24시간과 내부 receipt의 30일 보존은 다릅니다. 동일 호는 같은 한국 날짜만 발송하므로 오래된 호의 자동 재전송을 막습니다.

해지 시 주소를 삭제한 뒤 같은 주소로 재가입하면 새 random subscriber ID가 생성됩니다. 따라서 이 새 ID에 같은 날 같은 호를 다시 보낼 수 있는 경계가 mock에서 재현됐습니다. 이를 주소 기준 완전 중복 방지로 표현하지 않습니다. 개인정보 보존·해지 정책과 기존 기록 연결을 함께 검토해야 하며 이번 검수에서 기존 ID·receipt를 변경하거나 생산 DB를 수정하지 않았습니다. 반송·스팸의 자동 webhook 억제도 현재 범위에 없으며 운영자가 제공자 기록을 확인해야 합니다.

## 재현

Node22.16+와 Pandoc이 필요합니다. tech에서 npm run validate, npm run build:cloudflare를 실행합니다. 로컬 Windows의 구형 fsync/symlink CLI 검사는 Linux CI와 구분합니다. 실제 키 없는 mock 검사는 src/subscriptions.test.mjs와 scripts/*test.mjs에 있습니다. 공개 읽기 검사는 빌드 후 ISSUE_IDS를 실제 published ID로 지정해 node scripts/inspect-live.mjs를 사용합니다. 무발송 진단은 node tech/scripts/audit-no-send.mjs이며 OIDC·RESEND_API_KEY 환경은 거절합니다. 실메일 검증 대기 항목을 통과로 바꾸지 않습니다.
