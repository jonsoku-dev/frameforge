# 보안

Frameforge는 사용자의 컴퓨터에서만 도는 개발 도구입니다. 스튜디오와 렌더 서버는 운영 서비스가 아니며 인터넷에 열어 두지 않습니다.

## 지원 버전

| 버전 | 보안 수정 |
| --- | --- |
| 0.1.x | 받음 |

## 설계상 보호 장치

- **로컬 전용 서버.** 스튜디오(`npm run dev`, 4317)와 렌더 서버(4318, `FRAMEFORGE_PORT`로 변경)는 `127.0.0.1`에만 바인딩합니다(`vite.config.ts`, `src/studio/server/jobs.ts`). 렌더러는 loopback이 아닌 `serveUrl`을 거부합니다(`scripts/render.mjs`).
- **스튜디오 API 검사.** `/api` 요청은 세 가지를 모두 통과해야 합니다(`src/studio/server/paths.ts`, `studioApi.ts`). 접속 주소가 loopback(`127.0.0.1`, `::1`)일 것, `Host` 헤더가 loopback 이름일 것(DNS 리바인딩 방지), POST는 같은 출처의 `Origin`과 `application/json` 본문일 것. 하나라도 어기면 403입니다.
- **파일 경로 검사.** 스튜디오가 여는 파일은 프로젝트 루트 안의 상대 경로여야 합니다. 절대 경로, `..`, `node_modules`, `.git`, 점으로 시작하는 경로(`.scratch` 제외)를 거부하고, realpath로 심볼릭 링크를 풀어 다시 확인합니다. 확장자와 크기도 제한합니다.
- **원격 미디어는 https만.** `<Video>`, `<AnimatedImage>`, `getVideoMetadata`의 원격 주소는 `https://`만 받고, 리다이렉트가 https를 벗어나면 다운로드를 멈춥니다(`scripts/video-frames.mjs`). 내려받은 파일은 `.cache/remote/<sha256>`에 둡니다.
- **SVG 정리.** `art.py`는 받거나 생성한 SVG에서 스크립트, `foreignObject`, 외부 네임스페이스, 이벤트 속성, 외부 참조를 지우고 3 MB를 넘는 파일을 거부합니다.
- **비밀값 가리기.** `art.py`는 이미지 명령을 기록할 때 이름에 `KEY`, `TOKEN`, `SECRET`, `PASSWORD`가 들어간 환경 변수 값을 `<redacted>`로 바꿉니다.

## 사용자가 알아야 할 위험

- `FRAMEFORGE_IMAGE_COMMAND`는 셸로 실행됩니다. 믿을 수 있는 명령만 넣습니다. 프롬프트 문자열에서는 셸 메타 문자를 지우지만, 템플릿 자체는 그대로 실행합니다.
- `art.py`는 vtracer가 없으면 `pip install --user vtracer==0.6.15`를 실행합니다. 이 동작을 원하지 않으면 미리 설치하거나 `FRAMEFORGE_IMAGE_COMMAND`를 쓰지 않습니다.
- 작품 코드(`Spot.tsx`)는 Chrome 안에서 실행되는 일반 JavaScript입니다. 남이 준 작품은 코드를 읽은 뒤 렌더합니다.
- `npm run dev -- --host 0.0.0.0`처럼 바인딩을 바꾸면 스튜디오 화면과 Vite 개발 서버가 네트워크에 노출됩니다. 스튜디오 API는 loopback 검사로 계속 막히지만 Vite 개발 서버 자체는 운영용이 아닙니다.
- 이미지 명령에 쓰는 토큰 같은 비밀 값은 환경 변수로만 넘깁니다. 저장소 파일, `audio.json`, `assets.json`에 쓰지 않습니다.

## 취약점 신고

공개 이슈에 취약점 세부를 올리지 않습니다. GitHub 저장소 https://github.com/jonsoku-dev/frameforge 의 **Security** 탭에서 "Report a vulnerability"(비공개 보안 권고)로 신고합니다. 이 기능이 꺼져 있으면 세부 없이 "보안 신고 연락처 요청"이라는 제목으로 이슈를 열어 주세요. 관리자가 비공개 연락 방법을 알려 드립니다.

신고에 넣어 주세요.

- 영향받는 버전이나 파일
- 재현 단계와 기대한 동작, 실제 동작
- 가능하면 영향 범위(예: 로컬 파일 읽기, 원격 요청 위조)

관리자는 확인되는 대로 답하고, 고친 버전과 함께 공개합니다. 응답 기한은 약속하지 않습니다. 개인이 관리하는 프로젝트입니다.
