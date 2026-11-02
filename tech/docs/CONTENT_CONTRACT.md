# 매일 원고를 반영하는 계약

기준: 2026-11-03, Asia/Seoul. 저장소 `Team-HJD-21/team-hjd-site`, 소스 루트 `tech/`.

## 한 호의 파일

1. `content/issues/<id>.md`: UTF-8 전체 원고.
2. `assets/issues/<id>/`: 이 호의 이미지. 이미지가 없고 coverImage도 없다면 실제 폴더는 생략할 수 있다.
3. `content/issues.json`: 아래 메타데이터 한 항목을 기존 배열에 추가한다.
4. 새 태그가 필요한 경우에만 `content/tags.json`에 태그를 추가한다.

```json
{
  "id": "note-2026-11-04-example-topic",
  "slug": "example-topic",
  "title": "이번 글의 제목",
  "description": "목록과 검색 결과에서 읽을 소개",
  "question": "이번 글이 답할 구체적인 질문은 무엇인가?",
  "summary": "질문에 대한 핵심 답변과 구현에서 확인할 내용.",
  "date": "2026-11-04",
  "status": "draft",
  "source": "content/issues/note-2026-11-04-example-topic.md",
  "assetDirectory": "assets/issues/note-2026-11-04-example-topic",
  "coverImage": "overview.webp",
  "format": "기술 해설",
  "tags": ["rendering"]
}
```

예제는 발행 자료가 아니다. 태그는 실제 사전에 있는 ID를 골라야 한다. `coverImage`는 선택이며 있으면 해당 폴더에 실제 파일이 있어야 한다. `format`은 선택이며 기본값은 `기술 해설`이다.

ID와 slug는 소문자 영문·숫자·단어 사이 하이픈을 사용한다. ID는 80자 이하. 초안을 포함해 ID와 slug가 각각 고유해야 한다. source와 assetDirectory는 위 규칙에서 벗어날 수 없다. 올바른 실제 달력 날짜를 사용하며 `published`는 한국 날짜 기준 미래 날짜가 될 수 없다.

상태는 `draft`, `sample`, `published` 중 하나다. draft는 검증하지만 웹·다운로드·공개 자산에 포함하지 않는다. sample은 샘플 표시와 함께 웹에만 공개하며 RSS·발행 매니페스트에서 제외한다. published만 실제 발행 기록에 들어간다. 공개 Git의 draft는 비공개 저장이 아니다. 민감한 초안은 이 저장소에 넣지 않는다.

## Markdown

```markdown
# 이번 글의 제목

겜붕이의 노트 · by TeamHJD

<!-- article -->

## 문제에서 시작하기

도입 질문, 배경과 원리, 실제 구현 및 선택의 손익을 연결한다.

![기술 내용을 설명하는 대체 텍스트](assets/overview.webp)

*직접 만든 개념도. 무엇을 보여주는지 설명한다. 근거: [공식 자료](https://example.com/).*

## 오늘 얻어갈 것

도입 질문에 답하고, 코드·엔진·프로파일러에서 확인할 지점을 정리한다.

## 출처

- [정확한 공식 문서 제목](https://example.com/)
```

`<!-- article -->` 다음이 웹 본문이다. 그 앞의 제목·표지 정보는 다운로드에만 남는다. 본문 절은 `##`로 작성하고 순서와 수를 주제에 맞춰 바꾼다. 기존 샘플의 `## 01.` 방식은 호환된다. 마지막 실질적 본문 절은 정확히 `오늘 얻어갈 것`; 뒤에는 출처·참고자료를 둘 수 있다. 코드 펜스 안의 `##`는 본문 절로 세지 않는다.

본문의 주요 사실마다 직접 뒷받침하는 1차 자료를 연결한다. API와 의사 코드를 구분한다. 첫 핵심 용어는 한국어(English)로 설명한다. 읽기 시간과 가짜 발행 글을 넣지 않는다. 편집 내용과 기술 정확성은 작성자가 검증한다. 자동 검사는 사실성·출처의 품질이나 저작권을 보증하지 않는다.

## 이미지·영상·수식

- 로컬 이미지 경로는 `assets/파일명.확장자`. 평평한 폴더 구조를 사용한다. PNG, SVG, JPG/JPEG, WebP, GIF, AVIF를 지원한다.
- 파일명은 영문·숫자로 시작하고 영문·숫자·점·밑줄·하이픈을 사용한다. 이미지 폴더에는 지원하는 이미지 파일만 넣는다.
- 이미지 다음 문단에 `*캡션과 출처.*`를 붙인다. 실제 원문 이미지와 직접 만든 도식을 구분한다.
- 참조한 파일 누락, 표지 누락, 경로 이탈, 활성 SVG는 빌드 실패다. 기술 도식은 코드·벡터로 수치를 검증한다.
- 공식 영상은 일반 Markdown 링크로 넣고 제목·제작자·발표 시점·설명과의 관계를 적는다. 확인하지 않은 장면·타임스탬프를 만들지 않는다. iframe과 임의 HTML을 넣지 않는다. 영상 원본을 내려받아 ZIP에 넣지 않는다.
- TeX 수식은 `$...$`, `$$...$$`로 쓴다. KaTeX에서 실제 변환에 성공해야 한다.
- 허용된 HTML은 속성이 없는 `<details>`, `<summary>`뿐이다. 스크립트·iframe·이벤트 속성·실행 URL·ChatGPT 전용 인용은 금지한다.

웹의 다운로드 Markdown은 이미지 경로를 운영 도메인의 절대 URL로 바꾼다. ZIP은 원문과 `assets/`를 상대 경로 그대로 담아 오프라인에서도 그림을 연다. 둘 모두 일반 링크를 사용한다.

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

group은 `분야`, `기법·원리`, `엔진·언어`, `자료유형` 중 하나다. 실질적으로 다룬 태그만 연결한다. C++의 +, C#의 #은 보존한다. 태그 검색은 본문 전문 검색이 아니다. 연결된 실제 글이 없으면 0개가 맞다.

## 검사와 산출물

```sh
cd tech
npm run validate
npm run test:content
npm run build
```

Node.js 20 이상, Pandoc이 필요하다. 선택적으로 `PANDOC_PATH`에 pandoc 실행 파일의 절대 경로를 넣을 수 있다. npm 런타임 의존성은 없다.

산출물은 `dist/`뿐이다. `/publication.json`은 published 호만 담는 공개 JSON이고, `/feed.xml`은 published 호만 담는 RSS다. 메일 수신자나 발송 결과는 이 파일에 넣지 않는다. 검증 성공, 빌드 성공, CI 성공, 운영 URL 반영, 이메일 수신은 서로 다른 상태다.
