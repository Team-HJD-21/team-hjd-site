# 매일 원고를 반영하는 계약

기준: 2026-11-03, Asia/Seoul. 저장소 `Team-HJD-21/team-hjd-site`, 소스 루트 `tech/`.

먼저 [EDITORIAL.md](EDITORIAL.md)를 읽어 주세요. 독자에게 친숙한 ‘~입니다’, ‘~까요?’ 말투를 사용합니다. 초기 원고의 난이도 10을 기준으로 약 8을 목표로 하며, 작은 예제와 필요한 순서의 용어 설명으로 핵심 원리를 전달합니다. 직접 제작하는 그림은 다크 모드가 기준입니다. 공개 원고는 모두 정식 글이며 sample 상태의 새 글은 만들지 않습니다. 아래 상태 목록의 sample은 이전 자료 호환 용도입니다.

## 한 호의 파일

1. `content/issues/<id>.md`: UTF-8 전체 원고.
2. `assets/issues/<id>/`: 이 호의 이미지. 이미지가 없고 coverImage도 없다면 실제 폴더는 생략할 수 있습니다.
3. `content/issues.json`: 아래 메타데이터 한 항목을 기존 배열에 추가합니다.
4. 새 태그가 필요한 경우에만 `content/tags.json`에 태그를 추가합니다.

```json
{
  "id": "note-2026-11-04-example-topic",
  "slug": "example-topic",
  "title": "이번 글의 제목",
  "description": "목록과 검색 결과에서 읽을 소개",
  "question": "이번 글에서 함께 알아볼 질문은 무엇일까요?",
  "summary": "질문의 답을 작은 예제와 실제 구현으로 알아봅니다.",
  "date": "2026-11-04",
  "status": "draft",
  "source": "content/issues/note-2026-11-04-example-topic.md",
  "assetDirectory": "assets/issues/note-2026-11-04-example-topic",
  "coverImage": "overview.webp",
  "format": "기술 해설",
  "tags": ["rendering"]
}
```

예제는 발행 자료가 아니다. 태그는 실제 사전에 있는 ID를 골라야 합니다. `coverImage`는 선택이며 있으면 해당 폴더에 실제 파일이 있어야 합니다. `format`은 선택이며 기본값은 `기술 해설`입니다.

ID와 slug는 소문자 영문·숫자·단어 사이 하이픈을 사용합니다. ID는 80자 이하. 초안을 포함해 ID와 slug가 각각 고유해야 합니다. source와 assetDirectory는 위 규칙에서 벗어날 수 없습니다. 올바른 실제 달력 날짜를 사용하며 `published`는 한국 날짜 기준 미래 날짜가 될 수 없습니다.

공개 글 주소는 `https://tech.teamhjd.com/YYYY-MM-DD/<slug>/`입니다. 날짜는 metadata.date를 사용합니다. 목록·검색·canonical·RSS·메일이 모두 같은 경로를 사용하며 이전 `/articles/<slug>/` 주소는 새 주소로 301 이동합니다. 기존 공개 호의 날짜와 slug를 임의로 바꾸지 않습니다.

상태는 `draft`, `scheduled`, `sample`, `published` 중 하나다. draft와 scheduled는 검증하지만 웹·다운로드·공개 자산에 포함하지 않습니다. sample은 샘플 표시와 함께 웹에만 공개하며 RSS·발행 매니페스트에서 제외합니다. published만 실제 발행 기록에 들어갑니다. 공개 Git의 draft/scheduled는 비공개 저장이 아니다. 민감한 초안은 이 저장소에 넣지 않습니다.

ChatGPT는 매일 11:00 Asia/Seoul에 원고를 준비하고, 일일 원고는 `status: "scheduled"`, `publishAt: "YYYY-MM-DDT11:57:00+09:00"`로 반영합니다. 날짜와 timestamp의 날짜가 일치해야 합니다. 원고·그림·태그 커밋과 CI 성공 후 DAILY_RELIABILITY.md 및 RECOVERY.md의 별도 release-request.json 승인 push로 worker를 사전 기동합니다. 이 운영 파일 하나만 콘텐츠 쓰기 범위에 추가되며, 요청과 원고를 한 커밋에 섞지 않습니다. 이미 scheduled인 호도 사전 기동 확인을 생략하지 않습니다. runner는 자체 시계로 11:57까지 기다립니다. 11:57·12:03·12:09·12:17·12:23 GitHub cron은 보조이며 12:07에는 기존 ChatGPT 점검 예약이 동작합니다. 한국 시간 11:57 이후의 GitHub Actions가 당일 한 호만 published로 바꾸고, Cloudflare Git 연결이 main의 변경을 빌드·배포합니다. 운영 publication.json에 해당 호가 나타난 뒤 실제 메일 발송을 요청합니다. 같은 날 이미 published가 있으면 재발행하지 않습니다. 12:03에는 같은 호의 미시도 대상을 재점검하며, 같은 호·구독자 조합에 receipt가 있으면 재발송하지 않습니다. 불명확한 기록도 지우거나 자동 재전송하지 않습니다. 새 공개의 마감은 12:30이며, 그때까지 준비되지 않거나 유효하지 않으면 지난 호를 대신 발행하지 않고 실패를 남깁니다. 목표는 정오까지 하루 한 호를 한 번 수신하는 것이며, GitHub·배포·메일 큐 지연으로 도착 시각을 절대 보장하지는 않습니다.

## Markdown

```markdown
# 이번 글의 제목

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 문제에서 시작하기

도입 질문, 배경과 원리, 실제 구현 및 선택의 손익을 연결합니다.

![기술 내용을 설명하는 대체 텍스트](assets/overview.webp)

*직접 만든 개념도. 무엇을 보여주는지 설명합니다. 근거: [공식 자료](https://example.com/).*

## 오늘 얻어갈 것

도입 질문에 답하고, 코드·엔진·프로파일러에서 확인할 지점을 정리합니다.

## 출처

- [정확한 공식 문서 제목](https://example.com/)
```

`<!-- article -->` 다음이 웹 본문입니다. 그 앞의 제목·표지 정보는 다운로드에만 남는다. 본문 절은 `##`로 작성하고 순서와 수를 주제에 맞춰 바꿉니다. 기존 샘플의 `## 01.` 방식은 호환됩니다. 마지막 실질적 본문 절은 정확히 `오늘 얻어갈 것`; 뒤에는 출처·참고자료를 둘 수 있습니다. 코드 펜스 안의 `##`는 본문 절로 세지 않습니다.

본문의 주요 사실마다 직접 뒷받침하는 1차 자료를 연결합니다. API와 의사 코드를 구분합니다. 첫 핵심 용어는 한국어(English)로 설명합니다. 읽기 시간과 가짜 발행 글을 넣지 않습니다. 편집 내용과 기술 정확성은 작성자가 검증합니다. 자동 검사는 사실성·출처의 품질이나 저작권을 보증하지 않습니다.

## 이미지·영상·수식

- 로컬 이미지 경로는 `assets/파일명.확장자`. 평평한 폴더 구조를 사용합니다. PNG, SVG, JPG/JPEG, WebP, GIF, AVIF를 지원합니다.
- 파일명은 영문·숫자로 시작하고 영문·숫자·점·밑줄·하이픈을 사용합니다. 이미지 폴더에는 지원하는 이미지 파일만 넣습니다.
- 이미지 다음 문단에 `*캡션과 출처.*`를 붙입니다. 실제 원문 이미지와 직접 만든 도식을 구분합니다.
- 참조한 파일 누락, 표지 누락, 경로 이탈, 활성 SVG는 빌드 실패다. 기술 도식은 코드·벡터로 수치를 검증합니다.
- 공식 영상은 일반 Markdown 링크로 넣고 제목·제작자·발표 시점·설명과의 관계를 적는다. 확인하지 않은 장면·타임스탬프를 만들지 않습니다. iframe과 임의 HTML을 넣지 않습니다. 영상 원본을 내려받아 ZIP에 넣지 않습니다.
- TeX 수식은 `$...$`, `$$...$$`로 씁니다. KaTeX에서 실제 변환에 성공해야 합니다.
- 허용된 HTML은 속성이 없는 `<details>`, `<summary>`뿐입니다. 스크립트·iframe·이벤트 속성·실행 URL·ChatGPT 전용 인용은 금지합니다.

웹의 다운로드 Markdown은 이미지 경로를 운영 도메인의 절대 URL로 바꿉니다. ZIP은 원문과 `assets/`를 상대 경로 그대로 담아 오프라인에서도 그림을 연다. 둘 모두 일반 링크를 사용합니다.

## 태그

```json
{
  "id": "example-technique",
  "group": "기법·원리",
  "ko": "예제 기법",
  "en": "Example Technique",
  "aliases": ["한국어 별칭", "English alias"]
}
```

group은 `분야`, `기법·원리`, `엔진·언어`, `자료유형` 중 하나다. 실질적으로 다룬 태그만 연결합니다. C++의 +, C#의 #은 보존합니다. 태그 검색은 본문 전문 검색이 아니다. 연결된 실제 글이 없으면 0개가 맞습니다.

## 검사와 산출물

```sh
cd tech
npm run validate
npm run test:content
npm run build
```

Node.js 22 이상, Pandoc이 필요합니다. 선택적으로 `PANDOC_PATH`에 pandoc 실행 파일의 절대 경로를 넣을 수 있습니다. npm 런타임 의존성은 없습니다. 구독 서버 검사에는 Node의 내장 SQLite를 사용하며 운영 서버는 Cloudflare D1을 사용합니다.

산출물은 `dist/`뿐입니다. `/publication.json`은 published 호만 담는 공개 JSON이고, `/feed.xml`은 published 호만 담는 RSS다. 메일 수신자나 발송 결과는 이 파일에 넣지 않습니다. 검증 성공, 빌드 성공, CI 성공, 운영 URL 반영, 이메일 수신은 서로 다른 상태다.
