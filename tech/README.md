# 겜붕이의 노트

게임 클라이언트 개발자를 위한 기술 뉴스레터. 원문, 태그 사전, 화면 템플릿을 Git으로 관리한다.

## 로컬 빌드

Node.js 20 이상과 Pandoc이 필요하다.

```sh
npm run build
```

결과물은 `dist/`에 생성한다. 정적 호스팅의 루트 디렉터리로 사용하며 기사·태그·다운로드의 URL은 도메인 루트를 기준으로 한다. 다른 사이트의 하위 경로에 그대로 올리지 않는다.

## 콘텐츠 편집

- `content/issues/`: Markdown 원문
- `content/issues.json`: 호별 제목·요약·태그·공개 경로
- `content/tags.json`: 한국어·영어 태그 및 검색 별칭
- `assets/issues/`: 출처와 설명을 갖춘 도식·이미지
- `src/`: 공통 템플릿, 스타일, 태그 검색과 그림 확대
- `integrations/`: Cloudflare 이메일 검증·발송용 별도 운영 도구

배경과 문제에서 출발해 작동 원리, 구현상의 판단, 적용할 점으로 이어지는 글을 작성한다. 마지막 학습 정리는 **오늘 얻어갈 것**으로 통일한다. 용어는 필요한 첫 등장에 한국어와 영어를 병기하고, 읽는 시간 표시는 사용하지 않는다. 공식 영상과 직접 설명에 필요한 이미지를 우선하며 출처와 캡션을 함께 둔다.

## 운영 경계

서비스 도메인 설정은 `https://tech.teamhjd.com`을 기준으로 한다. 실제 DNS 연결과 이메일 수신자 검증은 해당 서비스 계정에서 별도로 완료해야 한다. 화면에 연결되지 않은 구독 기능이나 발송 성공 메시지를 표시하지 않는다.

개인 이메일, Cloudflare API 토큰, 수신자 목록과 발송 기록은 소스나 정적 산출물에 넣지 않는다. 이메일 도구는 외부의 비공개 상태 디렉터리를 사용하며 **Cloudflare에서 검증된 주소이면서 이 뉴스레터에 활성 등록된 주소**만 발송 대상으로 삼는다. 자세한 설정과 검증은 `integrations/README.md`에 있다.

일일 목표 발행 시각은 한국 시간 정오다. ChatGPT 예약은 원고를 공급하고 CI가 검증·빌드·설정 후 배포한다. 실제 운영 연결과 메일 예약은 아직 완료되지 않았다. [ChatGPT 인계 문서](docs/CHATGPT_PUBLISHING_HANDOFF.md), [예약 프롬프트](docs/CHATGPT_DAILY_PROMPT.md), [원고 계약](docs/CONTENT_CONTRACT.md)을 따른다.

`npm run validate`는 원고·태그·자산을 검사하고 `npm run test:content`는 발행 계약 회귀 검사를 실행한다. 새 원고의 `<!-- article -->` 다음이 웹 본문이다. `draft` 자산은 배포에서 제외하고 `published`만 `/publication.json`과 `/feed.xml`에 포함한다.

## 배포

Cloudflare Pages로 직접 배포하는 GitHub Actions 설정과 초기 계정 연결 절차는 [배포 안내](deploy/DEPLOY.md)에 있다. 배포용 계정 ID와 API 토큰은 GitHub Secrets에 설정한다.

`dist/`만 호스팅한다. 사이트 템플릿이나 원문을 변경하면 빌드를 다시 실행한다. 이미지를 포함한 전체 원문 묶음과 Markdown 다운로드는 빌더가 함께 생성한다.

다른 회사 사이트와 같은 Git 저장소에 보관하더라도 이 디렉터리는 독립된 사이트 루트로 취급한다. 회사 홈페이지 빌드에 자동으로 추가되지 않는다.
