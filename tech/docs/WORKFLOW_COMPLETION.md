# 작업별 실행과 실패 후 완료 처리

2026-11-05 보완입니다. 오늘 원고 추가·표기 수정·발행 요청 세 커밋이 각각 뉴스레터 검사와 회사 사이트 배포를 기동했습니다. 로컬 관리 화면은 보이는 동안 5분마다 별도 조회 workflow를 요청했습니다. 이것은 동일 메일 세 번 발송과 다릅니다.

## 시작 조건

- 회사 사이트는 tech/ 및 뉴스레터 전용 도구·workflow만 바뀐 push에서는 배포하지 않습니다. 회사 HTML·공통 CSS·자산·회사 workflow가 함께 바뀌면 기존 배포를 수행합니다.
- 원고 검사는 콘텐츠·코드 변경마다 유지합니다. tech/operations/만 바뀐 요청 커밋은 별도 전체 CI를 반복하지 않습니다. 실제 발행 workflow 자체의 계약·인증·빌드 검사는 유지합니다.
- 관리 화면은 처음 열 때 한 번 조회하고 이후 수동이 기본입니다. 사용자가 체크한 경우에만 보이는 창에서 5분 자동 조회를 합니다. 같은 날짜의 진행 중/대기 요청은 합치고 다른 날짜는 FIFO로 처리합니다. 앞선 조회가 실패해도 다음 요청은 실행하며 기존 보고서를 임의로 지우지 않습니다.

## 시작한 실행을 완료하는 원칙

cancel-in-progress=false와 queue=max로 같은 그룹의 실행·대기를 보호합니다. 단순 false만으로는 기존 pending이 새 요청에 대체될 수 있습니다. GitHub가 지원하는 대기 한도는100개이며, 플랫폼 장애·runner 강제 종료까지 무한 실행을 보장한다는 뜻은 아닙니다. [공식 큐 안내](https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/).

독립 검사는 !cancelled() 조건으로 이전 검사 실패 후에도 수행합니다. 검증에 의존하는 빌드·공개·발송은 선행 검사 성공 조건을 유지합니다. 실제 실패를 continue-on-error로 성공 처리하지 않습니다. 예외는 진짜 발송/배포가 없는 고장 주입 시험뿐이며 별도 verify job이 결과를 검증합니다.

각 실제 workflow는 실패 후에도 다음을 수행합니다.

1. 업무 단계의 outcome/conclusion을 개인정보 없이 .workflow-results/workflow-result.json에 저장합니다.
2. workflow-result-<종류>-<run>-<attempt> artifact를 업로드합니다.
3. 업로드 단계까지 포함한 최종 결과를 로그 JSON과 Job summary에 기록합니다. 실패는 failure, 필수 단계가 예기치 않게 생략되면 incomplete입니다.

artifact는 업로드 전 업무 단계의 스냅샷입니다. 최종 로그의 phase=final에는 업로드 결과도 포함됩니다. artifact 업로드가 실패해도 마지막 요약은 시도하며, checkout 실패에는 최소 setup_failed 기록을 남깁니다. 토큰·action outputs·원시 오류·개인 주소·모니터 통계는 직렬화하지 않습니다. 모니터의 실제 보고서는 기존처럼 암호문으로만 별도 보관합니다.

이 JSON의 success는 단계 결과이며 웹 공개·메일 API 수락·받은편지함 도착의 증거가 아닙니다. 실제 Deliver/검사 로그를 함께 확인합니다. 상태 API가 queued인데 완료 로그/산출물이 있다면 불일치로 기록하고 무조건 재실행하지 않습니다.

## 실패 경로 검사

Verify workflow failure completion은 workflow/진단 코드 변경에서만 실행합니다. success, check-failure, build-failure 세 격리 fixture가 실제 GitHub runner에서 실행됩니다. 의도한 실패 job도 독립 검사를 끝내고 진단 artifact를 남기며, 실패한 경로에서는 공개 허용 marker가 생성되지 않아야 합니다. verify가 세 artifact를 모두 검사합니다. 실제 콘텐츠·구독자·발송은 호출하지 않습니다.

C++ inline code의 <new>를 HTML로 오인하던 검사도 수정했습니다. 완전한 backtick span만 HTML 검사에서 제외하고, 이스케이프/미종결 span과 실제 HTML은 차단합니다. 실제 배포와 같은 Pandoc 모드의 escaping 회귀검사도 수행합니다.

## 적용 순서

11:02에 이미 기동된 실제 발행 worker가 있으므로 그 worker가 끝날 때까지 main 병합을 보류합니다. 대기 중 main을 바꾸면 원래 worker의 비강제 공개 push가 실패할 수 있습니다. PR 검증은 별도 브랜치에서 진행하며, 기존 호 ID·날짜·발송 원장을 변경하지 않습니다.

## 재현

tech에서 npm run test:ci와 npm run build:cloudflare를 사용합니다. 기본 Cloudflare 빌드는 모든 오프라인 검사를 한 번 실행하고 Pandoc renderer 검사 후 빌드합니다. CI의 --build-only는 앞선 독립 콘텐츠·회귀검사 성공 조건 안에서만 사용합니다. 구형 Windows CLI의 fsync/symlink 한계는 전체 Linux CI와 구분합니다.

공식 actionlint1.7.12는 아직 queue 키를 모릅니다. 해당 메시지만 별도로 구분한 정적 검사를 수행하고, 실제 GitHub PR workflow 등록·실행으로 새 문법을 검증합니다. 다른 구문/조건식 검사나 운영 검사·권한을 해제하는 처리가 아닙니다.
