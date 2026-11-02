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
