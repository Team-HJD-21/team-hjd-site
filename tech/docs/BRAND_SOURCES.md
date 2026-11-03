# 로고 원본과 표시 크기

원본은 기존 회사 홈페이지의 `assets/teamhjd-logo.png`다. 이를 `tech/assets/brand/teamhjd-original.png`로 바이트 변경 없이 복사했다. SHA256: `5232af9a005837245383e6fc4d3e634a7828d1c16c966a3dc0b1200796f4627a`.

원본 로켓을 새로 생성하거나 매끈한 벡터로 다시 그리지 않는다. `scripts/brand.mjs`는 원본 PNG의 로켓 영역을 SVG viewport로 보여주고, 별도의 한글 lettering 소스를 옆에 조합한다. 원본 PNG 자체는 수정하지 않는다. 브라우저 탭 아이콘 역시 같은 로켓을 사용한다.

한글 글자만 내장 imagegen 도구로 생성했다. 투명 PNG인 `assets/brand/notes-lettering.png`에 원본의 연필 해칭과 손으로 그린 테두리를 맞췄고, 작은 `by TeamHJD` 서명이 포함된다. 생성 후 프로젝트 안에 복사했다. 채택하지 않은 앞선 이미지들은 제품 자산에 포함하지 않는다.

페이지 상단 표시 폭: 데스크톱 210px, 모바일 175px, 380px 이하 162px. 원본 TeamHJD 홈페이지의 작고 가로로 긴 로고처럼 사용하며, 별도의 큰 로고 삽화를 본문 위에 넣지 않는다. 밝은 테마에서는 CSS 필터로 대비를 확보한다.

빌드 결과: `dist/assets/brand/gambungi-wordmark.svg`, `dist/assets/brand/favicon.svg`, `dist/favicon.svg`. SVG는 원본 이미지를 내장하므로 개별 파일로 옮겨도 그림이 유지된다.

최종 글자 소스 생성 프롬프트:

```text
Use case: text-localization. Asset type: transparent text-only lettering source for a logo composition. Reference image is the actual original TeamHJD hand-drawn logo. Reproduce ONLY the original "Team HJD" lettering's graphite pencil/chalk hand-shaded style, replacing the letters with exact Korean "겜붕이의 노트" on one horizontal line. It must look physically hand DRAWN with pencil outlines, ivory-gray layered pencil hatching inside bold friendly letterforms, imperfect subtle sketch edges and visible graphite strokes just like original Team HJD letters. Do not use smooth solid sans-serif vector letters. Below at far right add exact small handwritten byline "by TeamHJD" in the original handwritten tagline's pencil-script style, about one quarter of headline height. Transparent background, tightly framed around lettering with small padding. No rocket, no notebook, no icon, no stars, no illustration, NO redesign. We are directly reusing the original rocket image separately with its exact original pixels. Return only the text lettering to place next to that existing rocket. Korean must be exactly "겜붕이의 노트". Ivory and gray pencil, tiny hand-sketched graphite texture, crisp legible at small website header size. Wide horizontal composition.
```
# 공통 탭 아이콘 v1 적용

2026년 11월 3일 회사 사이트의 공통 favicon family를 적용했습니다. `assets/favicons/v1/notes/`는 회사 저장소의 같은 경로에서 바이트 변경 없이 복사한 배포본입니다. 원본 손그림 로켓·원형 바탕은 유지하고 좌상단 노트 배지로 구분합니다. SVG·PNG·ICO·Apple 아이콘의 공개 URL은 버전 경로를 사용합니다. `scripts/brand.mjs`도 기존 아이콘을 다시 그리지 않고 이 파일을 복사합니다. 헤더 워드마크의 크기와 원본 로켓은 유지합니다. 기준은 회사 `scripts/favicon-brand.md`, 해시는 회사 `assets/favicons/v1/manifest.json`입니다.

# 링크 공유 미리보기

카카오톡 등 링크 공유에는 `assets/brand/gambungi-share-v1.png`를 공통으로 사용합니다. 1200×630 PNG에 원본 손그림 로켓을 포함한 겜붕이의 노트 워드마크와 작은 by TeamHJD, ‘매일 12시에 읽는 노트들’을 넣었습니다. 회사 다크 팔레트를 사용하며 원본 로켓을 다시 그리지 않습니다. 기사 제목·설명은 각 글의 metadata를 사용하고, 공유 이미지는 같은 브랜드 이미지입니다.

생성 원본 SVG는 글자를 경로로 변환해 글꼴 없이도 동일하게 보이며 PNG와 함께 보존합니다. 선택적 작성 도구 `scripts/create-share-image.mjs`는 기존 resvg-js 모듈 경로와 한국어 글꼴 경로를 인자로 받습니다. 배포에서는 렌더러·글꼴 설치 없이 커밋된 PNG를 사용합니다. Open Graph와 Twitter Card에 이미지 주소·설명을 지정하며 OG에는 크기·형식도 명시합니다. 이미지 디자인 개정 시 v2처럼 새 파일명으로 구분합니다.
