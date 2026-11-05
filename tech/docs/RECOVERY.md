# 발행 장애와 안전한 수동 복구

기준: 2026-11-04, Asia/Seoul. 기존 정오 발행과 D1/Resend 발송 경로를 그대로 사용합니다.

## 무엇을 보완했나요?

예약 작업은 여전히 11:57, 12:03, 12:09, 12:17, 12:23에 시도합니다. 12:30 이후 **새 자동 공개**를 막는 규칙은 실수로 늦은 글이나 지난 글을 보내지 않기 위한 것이며, 정시 도착을 보장하는 장치는 아닙니다. 이제 당일의 정확한 글을 명시한 수동 복구만 마감 후 허용합니다. 스케줄러 지연 자체를 고친 것으로 해석하지 않습니다.

GitHub Actions 실행 생성, runner 시작, 원고 검사, 상태 커밋, Cloudflare 배포, Resend 수락, 받은편지함 도착은 서로 다른 단계입니다. `Record trigger diagnostics`에서 이벤트 종류와 실제 cron 문자열·UTC 시각·run ID·attempt를 기록합니다. `workflow_dispatch` 또는 승인 파일 `push` 성공을 실제 `schedule` 성공으로 보고하지 않습니다.

## 먼저 확인할 사항

오늘의 `issues.json`, 발행 workflow의 최신 attempt, 운영 `/publication.json`과 발송 집계를 함께 확인합니다. 진행 중인 발행 작업이 있으면 새 요청을 쌓지 않습니다. 이미 정상 처리됐다면 재발행하지 않습니다. `queued`, `remaining`, `unresolved`를 구분합니다. `remaining=0`만으로 발송 성공이라고 판정하지 않습니다.

`uncertain`, `pending`, `rejected`, `quota` 기록이 있으면 기존 receipt를 지우거나 새로운 호 ID로 다시 보내지 않습니다. Resend 기록과 오류를 운영자가 확인할 때까지 자동 반복을 중지합니다. 현재 복구는 **아직 시도하지 않은 수신자만** 처리하며, 기록이 남은 실패 건을 강제 재전송하지 않습니다.

## 방법 A: GitHub Run workflow

Actions → **Publish newsletter at noon KST** → Run workflow → `main`에서 다음을 지정합니다.

- `dry_run=true`: 검사만 수행합니다. 웹 상태와 메일을 변경하지 않습니다.
- `allow_late=true`: 12:30 이후 오늘의 글을 복구할 때만 선택합니다.
- `confirm_recovery=true`: 지정한 당일 호의 수동 복구를 명시적으로 확인합니다. 기본값은 false입니다. 검사 실행에도 대상 복구 확인을 입력합니다.
- `recovery_issue_id`: 실제 존재하는 오늘 호의 원래 ID.
- `recovery_date`: 오늘의 한국 날짜 `YYYY-MM-DD`.
- `recovery_reason`: 운영자가 승인한 이유, 10~300자의 한 줄. 개인정보·키를 넣지 않습니다.

검사 결과를 확인한 뒤 같은 대상으로 `dry_run=false`를 실행합니다. 대상이 어제·내일, draft·sample이거나 오늘 이미 다른 글이 공개됐다면 거절합니다. 자정이 지난 뒤 전날 글을 자동 복구하지 않습니다.

## 방법 B: 연결 도구에 workflow_dispatch가 없을 때

저장소에 쓰기 권한을 가진 운영자는 **별도 커밋 하나**로 `tech/operations/release-request.json`만 추가·수정할 수 있습니다. 이 파일의 main push가 같은 발행 workflow를 시작합니다. 코드를 변경하는 커밋이나 PR 브랜치 push는 발송 승인이 아닙니다. 브랜치 보호를 해제하거나 force push하지 않습니다. 보호 규칙에 막히면 pending으로 보고하고 운영자가 절차에 따라 처리합니다.

```json
{
  "version": 1,
  "requestId": "recovery-YYYYMMDD-unique-id",
  "date": "YYYY-MM-DD",
  "issueId": "EXISTING-ISSUE-ID",
  "reason": "운영자가 승인한 당일 누락 발행 복구 사유입니다.",
  "requestedAt": "YYYY-MM-DDTHH:mm:ss+09:00",
  "expiresAt": "YYYY-MM-DDTHH:mm:ss+09:00",
  "allowLate": true,
  "dryRun": true,
  "confirm": "publish-and-send-once",
  "expectedBaseSha": "요청 커밋 바로 전 main의 40자리 SHA"
}
```

이 예시는 실행 가능한 실제 요청이 아닙니다. 타임스탬프를 실제 시각으로 바꾸고 만료는 작성 시각부터 **최대 1시간**으로 제한합니다. 요청 실행 시점도 같은 한국 날짜여야 합니다. 처음에는 `dryRun=true`로 검사하고, 결과가 정상일 때 새 requestId·시각·최신 expectedBaseSha를 가진 **새 별도 커밋**에 `dryRun=false`를 넣습니다.

서버가 아니라 GitHub workflow가 다음을 검사합니다: 정확한 저장소·main·push, 강제 push 아님, 승인 base와 event.before 일치, 이벤트 SHA와 checkout HEAD 일치, 해당 요청 파일만 변경됨, 유효기간과 정확한 글 ID·날짜. main이 먼저 바뀌면 오래된 승인은 실패하며 다시 최신 HEAD로 승인해야 합니다. 요청 파일은 정적 빌드 공개 산출물에 포함하지 않습니다. 다만 Git은 공개이므로 주소·키·수신자 목록은 절대 넣지 않습니다.

cron 실행은 이 요청 파일을 **읽지도 않습니다.** 남아 있는 오래된 요청으로 다음 날 메일이 다시 나가지 않습니다. 새 요청·다른 run ID라도 메일 중복 방지 키는 계속 **원래 호 ID + 구독자 ID**입니다.

## 처리 순서와 경계

1. 원고·메타데이터와 복구 조건을 검사합니다.
2. 기존 Actions OIDC로 운영 구독 서비스의 인증·DB·메일 연결을 먼저 확인합니다. 새 키나 넓은 권한을 요구하지 않습니다.
3. 새 공개라면 원고를 빌드한 후 기존 ID·date·slug를 보존해 `published`와 실제 `publishedAt`만 기록합니다. 다른 main 변경이 생기면 비강제 push가 실패하고 메일 단계로 진행하지 않습니다.
4. Cloudflare 운영 `/publication.json`의 원래 ID·날짜·제목·기사 URL이 검증한 원고와 같고 실제 기사도 HTTP 200 HTML인지 확인한 뒤 기존 발송 API를 호출합니다. 공개 GET만 최대 6분·합계 60회 이내로 재시도합니다. 네트워크 오류·JSON 오류·배포 지연이 이 한도 안에서 회복되지 않으면 메일을 보내지 않습니다.
5. 활성·인증·동의 완료 대상 중 **발송 기록 없는 대상만** 처리합니다. 기록을 삭제하거나 덮어쓰지 않습니다.
6. `remaining`·`unresolved`와 각 실패 집계를 확인하고 허용된 집계 필드만 로그에 남깁니다. 발송 POST 응답이 유실되면 이 실행에서 POST를 자동 재시도하지 않습니다. 웹 공개, API 수락과 실제 수신을 따로 보고합니다. 정상처럼 보여도 받은편지함 도착을 추정하지 않습니다.

이 경로는 임의 주소 테스트 메일 API가 아닙니다. 운영 호의 정상 수신 대상만 처리합니다. 개인 단독 진단 기능이 생겼다고 보고하지 않습니다. 반복 실행은 동일 수신자에게 같은 호를 추가 발송하기 위한 용도가 아닙니다.

## 12:07 ChatGPT 점검의 보조 실행

유효한 당일 원고와 CI 성공이 확인됐고 정기 실행이 누락됐으며 진행 중 실행이 없다면, 점검 작업은 기존 실행 재시도 또는 방법 B를 사용할 수 있습니다. 이 자동 점검에서는 `allowLate=false`만 허용합니다. 12:30 이후의 새 공개는 사람의 명시적인 당일 복구 승인 없이 하지 않습니다. 승인·쓰기·브랜치 보호로 막히면 사용자에게 실제 상태를 알립니다.

예약 조회가 정상이라는 것과 이 보조 경로가 무인으로 성공했다는 것은 다릅니다. 실제 예약 실행에서 쓰기 승인이 필요한지도 별도로 검증해야 합니다. 이 보조 경로는 GitHub cron과 다른 push 이벤트를 사용하지만 GitHub Actions 전체 장애나 Cloudflare·메일 제공자 장애까지 독립적으로 해결하지는 못합니다.

## 검증 명령

```sh
node --test tech/scripts/release.test.mjs
cd tech
npm run validate
npm run test:content
npm run test:subscriptions
npm run build:cloudflare
```

회귀검사는 정상 시간창, 승인된 야간 복구, 승인 만료, 날짜 변경, 다른 글·여러 후보·draft·sample 거부, cron의 승인 무시, 잘못된 브랜치·변경 파일·stale HEAD 거부와 dry-run 기본값을 포함합니다. 기존 구독 검사에서 발송 중복 방지를 확인합니다.

## 공식 근거

- [GitHub 예약 이벤트의 지연·누락 조건](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GitHub 수동 workflow 실행](https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow)
- [GitHub branch/path 필터](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Resend 중복 방지 키](https://resend.com/docs/dashboard/emails/idempotency-keys)

## 실행 완료와 진단 기록

WORKFLOW_COMPLETION.md를 함께 확인합니다. 원고 검사·회사 배포·발행·모니터는 역할에 맞게 기동하고, 실패 후에도 독립 검사와 최종 진단 저장을 수행합니다. workflow-result artifact는 업무 단계 스냅샷이며 마지막 phase=final 로그/summary에 업로드 결과까지 기록합니다. 이 단계 결과만으로 공개·메일 성공이라 판단하지 않습니다.
