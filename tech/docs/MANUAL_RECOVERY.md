# 당일 수동 복구 패치 적용 안내

2026년 11월 4일 전달받은 수동 복구 ZIP의 개선을 최신 main에 병합했습니다. 원본 패치 기준은 97af3f2이며, 기존 main의 승인 파일 push·11:57 사전 기동·읽기 전용 운영 점검은 보존합니다. 운영 절차의 정본은 [RECOVERY.md](RECOVERY.md)입니다.

## 반영한 동작

- 수동 복구는 정확한 당일 호 ID·한국 날짜·한 줄 사유와 `confirm_recovery=true`가 필요합니다. `dry_run` 기본값은 true입니다. 기존 사유 길이 10~300자·최대 1시간의 승인 유효기간을 유지합니다.
- 일반 시간창은 11:57~12:30이며, 명시적으로 승인한 당일 복구에서만 `allow_late=true`로 마감 이후 처리합니다. 초안·샘플·다른 날짜·모호한 복수 후보·이미 다른 호가 공개된 경우는 거절합니다.
- 원래 ID·날짜·slug를 유지하고, 이미 published인 호의 공개 시각을 다시 쓰지 않습니다. 새 상태 파일은 같은 디렉터리의 임시 파일에 쓴 뒤 교체합니다.
- 검증된 원고와 운영 매니페스트의 ID·날짜·제목·원래 URL, 실제 기사의 HTTP 200 HTML을 확인합니다. 재시도는 공개 GET만 최대 6분·합계 60회입니다.
- 기존 Actions OIDC와 D1 receipt를 사용합니다. 발송 응답이 유실되면 POST를 자동 재시도하지 않으며, `remaining`·`unresolved`·실패 집계를 검증해 허용된 집계만 기록합니다. 주소·본문·키·토큰을 발송 로그에 추가하지 않습니다.

## 검사 후 실제 복구

다음은 **2026년 11월 4일에만 유효한 예시**입니다. 자정이 지난 뒤 날짜나 ID를 바꿔 재사용하지 않습니다.

```sh
gh workflow run publish-newsletter.yml --repo Team-HJD-21/team-hjd-site --ref main \
  -f dry_run=true -f allow_late=true -f confirm_recovery=true \
  -f recovery_issue_id=note-2026-11-04-reversed-z -f recovery_date=2026-11-04 \
  -f recovery_reason='Owner approved same-day recovery with existing IDs and delivery receipts preserved.'
```

전체 CI와 운영 배포, 위 dry run의 원고·공개 파일·인증 연결 점검이 성공한 뒤, 같은 사용자 승인 대상에 한해 `dry_run=false`로 한 번 실행합니다. dry run은 상태를 커밋하거나 정기 메일 발송 API를 호출하지 않습니다. 이미 성공한 대상은 같은 호·구독자 receipt로 건너뜁니다. 승인 파일 push 경로는 별도 커밋과 기존 승인 확인 문자열·만료 시각을 계속 사용하며, workflow 입력 확인과 혼용하지 않습니다.

## 완료와 한계

웹 공개, API 수락, 받은편지함 도착은 서로 다른 결과입니다. `queued=0,remaining=0,unresolved=0`이면 이번 실행에서 새 발송이 필요하지 않았다는 뜻일 수 있습니다. 이전 실행의 발송 기록을 함께 확인합니다. receipt 삭제·새 호 ID·임의 수신자 지정으로 강제 재전송하지 않습니다. 스케줄러 지연 자체를 없애거나 다음 날 정시 수신을 보장하는 패치는 아닙니다.

검사는 `npm run build:cloudflare`에 포함된 기존 콘텐츠·발행·사전 기동·구독·관리·구형 CLI 검사와 새 `delivery-client.test.mjs`를 함께 수행합니다. ZIP의 회귀검사 중 변경 없는 기존 검사는 그대로 보존하며, 이전 이벤트 API용 테스트는 현재 승인 입력에 맞춰 통합했습니다. PR CI 이후 main 배포를 별도로 확인합니다.
