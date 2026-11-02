# TeamHJD browser favicon family · v1.0.0

사용자 요청: 각 TeamHJD 서비스가 탭에서 같은 계열로 보이되 서비스 성격을 구분한다.

## 공통 기준

- 원본은 회사 사이트 `assets/favicon.png`. 원형 바탕과 손그림 로켓의 원본 픽셀을 변경하지 않는다. 새 로켓 생성·추적·재색칠을 하지 않는다.
- SVG viewBox는 `0 0 64 64`. 모든 서비스가 동일한 로켓 크기/각도/중심/원형 바탕을 공유한다. 원 밖은 투명하다.
- 서비스 구분은 좌상단의 동일한 배지 하나로 제한한다. 중심 `(14.5,14.5)`, 반경 `13`, 배경 `#d9eea6`, 테두리와 문양 `#080f17`. 서비스별 임의 색상·그라데이션·글자·다른 외곽 모양을 추가하지 않는다.
- 기본 회사 아이콘은 배지 없는 원본이다. 다른 사이트는 지정된 배지를 사용한다. 페이지 헤더의 원본 워드마크와 브라우저 탭용 파비콘은 용도가 다르다.
- 밝은 탭/어두운 탭에서 동일한 파일을 사용한다. 배경이 아이콘 내부에 있으므로 브라우저 테마에 따라 색을 반전하지 않는다.

| ID | 서비스 | 구분 문양 |
| --- | --- | --- |
| teamhjd | teamhjd.com | 배지 없는 원본 |
| docs | docs.teamhjd.com | 펼친 책 |
| launcher | testlauncher.teamhjd.com | 재생 삼각형 |
| notes | tech.teamhjd.com | 노트 |
| portfolio | hyunseok.teamhjd.com | 사람 |
| threadle | threadle.teamhjd.com | 스레드 분기 |
| pixelpin | pixelpin.teamhjd.com | 색상 스포이드 |

## 배포 파일과 적용

권위 있는 경로: `assets/favicons/v1/{ID}/`. SVG는 PNG 원본을 내장한 독립 파일이다. 버전 경로는 공개 후 동일 내용으로 유지하고 디자인 개정은 v2로 분리한다.

각 폴더에는 `favicon.svg`, `favicon.ico`(16/32/48 PNG 엔트리), `favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon-64.png`, `apple-touch-icon.png`(180), `favicon-192.png`, `favicon-512.png`가 있다.

서비스 담당자는 자기 ID의 폴더를 자신의 정적 자산 폴더로 바이트 변경 없이 복사한다. 아래 예시는 복사 경로를 `/assets/favicons/v1/notes/`로 선택한 경우다. 기존 프레임워크의 favicon/metadata/생성 스크립트 설정도 동일한 파일로 연결해야 한다.

```html
<link rel="icon" href="/assets/favicons/v1/notes/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicons/v1/notes/favicon-32.png">
<link rel="icon" type="image/svg+xml" sizes="any" href="/assets/favicons/v1/notes/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicons/v1/notes/apple-touch-icon.png">
```

- Docusaurus는 config의 `favicon`과 static 자산 경로를 함께 맞춘다. 파일 확장자와 실제 포맷을 일치시킨다.
- 빌드 때 favicon을 새로 생성하는 사이트는 그 생성기를 수정해 배포본을 복사하게 한다. 런타임 생성기가 구버전 favicon으로 덮어쓰지 않도록 한다.
- 기존과 다른 버전 URL을 사용해 브라우저의 favicon 캐시와 구분한다. 기존 아이콘 캐시를 강제로 삭제할 수 있다고 주장하지 않는다.
- SVG `image/svg+xml`, PNG `image/png`, ICO `image/x-icon` 또는 `image/vnd.microsoft.icon`으로 제공한다. 로컬 preview-site.mjs의 SVG/ICO MIME 누락을 이 작업에서 수정했다.
- `manifest.json`에 모든 파일의 SHA256/크기와 원본 SHA256이 있다. 담당자는 적용 후 파일 해시·head URL·실제 배포 응답을 확인한다.
- 배포 폴더의 `.gitattributes`도 복사한다. SVG/JSON/HTML은 LF, PNG/ICO는 binary로 고정해 Windows checkout에서도 manifest의 바이트 해시를 유지한다.
- 전체 비교 화면: `https://teamhjd.com/assets/favicons/v1/preview.html`. 각 서비스가 다른 저장소를 사용해도 동일한 v1 배포본을 사용할 수 있다.

## 재생성과 검증

이미지 생성 API를 사용하지 않는다. 기존 로고를 내장하는 SVG 코드를 만들고, 고정 버전의 SVG 렌더러로 PNG/ICO를 내보낸다. SVG/PNG/ICO의 최종 파일은 커밋하므로 사이트 배포 CI에 렌더러가 필요하지 않다.

```powershell
npm install --prefix .local/favicon-tools --no-save --no-package-lock --ignore-scripts @resvg/resvg-js@2.6.2
node scripts/build-favicons.mjs
node scripts/check-favicons.mjs
node scripts/render-team.mjs
node scripts/test-team.mjs
node scripts/check-site.mjs
node scripts/build-site.mjs ../새로운-빈-출력폴더
```

`check-favicons.mjs`는 원본 보존, 내장 이미지의 동일성, 외부 의존 없음, 파일 해시, PNG 실제 치수, ICO 엔트리와 PNG의 일치를 검사한다. 16/32px의 실제 가독성은 preview.html을 밝은 탭·어두운 탭 모양으로 시각 검수한다. 이는 실물 Safari/iPhone의 캐시 검증을 대신하지 않는다.
