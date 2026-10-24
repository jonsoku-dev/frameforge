# Frameforge

> **English summary.** Frameforge is an independent, MIT-licensed React video engine. You write each film as a pure function of the frame number, preview it in a local studio, and render it to MP4 with headless Chrome and FFmpeg. Music and sound effects are generated per film from a JSON spec, and a drawn asset kit covers icons and heroes. It also ships as a skill plugin for Claude Code, Codex, Cursor and Grok Build. It is not affiliated with Remotion. Start with `npm ci && npm run dev`, then read [docs/install.md](docs/install.md). The rest of the documentation is in Korean.

**설치 방법 고르기.** 에이전트에게 맡기려면 [AGENTS.md](AGENTS.md)와 [docs/agent-install.md](docs/agent-install.md)의 복사용 프롬프트를, 직접 하려면 [docs/manual.md](docs/manual.md)를, 경로별 세부는 [docs/install.md](docs/install.md)를 봅니다.

Frameforge는 React로 영상을 만드는 독립 구현 엔진입니다. MIT 라이선스로 배포합니다.

**Remotion과 제휴하지 않은 독립 구현입니다.** API 이름과 형태 일부를 맞췄지만 Remotion의 코드를 복사하거나 의존성으로 쓰지 않습니다. 참조 범위와 라이선스 검토는 [docs/legal/](docs/legal/)에 있습니다.

영상 하나는 프레임 번호를 받아 화면을 돌려주는 React 컴포넌트입니다. 스튜디오에서 미리 보고, 헤드리스 Chrome과 FFmpeg로 MP4를 만듭니다. 음악과 효과음은 작품마다 JSON 명세에서 생성하고, 아이콘과 주인공 그림은 직접 그린 모티프 키트로 채웁니다.

지금은 **부분 호환 프로토타입**입니다. 기존 Remotion 프로젝트가 수정 없이 돌아간다거나 출력이 픽셀 단위로 같다는 검증은 하지 않았습니다. 무엇을 어떻게 검증했는지는 [docs/reference/verification.md](docs/reference/verification.md)에 있습니다.

## 30초 시작

```sh
git clone https://github.com/jonsoku-dev/frameforge.git
cd frameforge
npm ci
npm run dev
```

브라우저에서 http://127.0.0.1:4317 을 엽니다. 기본 진입점 `examples/samples/index.tsx`가 샘플 작품 전체를 등록합니다.

MP4 하나를 만들어 봅니다. 아래 명령은 샘플 `cafe-morning`의 처음 90프레임(3초)을 렌더합니다. 음악과 효과음은 렌더 직전에 자동으로 생성됩니다.

```sh
npm run render -- examples/samples/cafe-morning/entry.tsx CafeMorning renders/cafe-morning.mp4 --frame-range 0-89
```

2026-10-20에 Apple Silicon Mac에서 이 명령은 약 11초 걸렸습니다. 같은 출력 파일이 이미 있으면 렌더러는 덮어쓰지 않고 멈춥니다.

## 요구 사항

| 항목 | 필요한 경우 | 내용 |
| --- | --- | --- |
| Node.js | 항상 | 24 이상. 렌더러가 Node 내장 `WebSocket`으로 Chrome에 붙습니다. `package.json`에 `engines` 필드는 없습니다. Node 24.20.0, npm 11.19.0에서 확인했습니다. |
| Chrome 또는 Chromium | 렌더 | 이 경로를 차례로 찾습니다. `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `/Applications/Chromium.app/Contents/MacOS/Chromium`, `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`. 다른 곳에 있으면 `CHROME_PATH`를 지정합니다. Chrome 155에서 확인했습니다. |
| FFmpeg, ffprobe | 렌더, 검사, `<Video>` | `PATH`에 있거나 `FFMPEG_PATH`, `FFPROBE_PATH`로 지정합니다. FFmpeg 7.1.1에서 확인했습니다. |
| Python 3, numpy | 소리가 있는 작품, 에셋 해결 | `scripts/assets/score.py`가 numpy로 음악과 효과음을 합성합니다. Python 3.14.4, numpy 2.4.4에서 확인했습니다. |
| vtracer | 선택 | `FRAMEFORGE_IMAGE_COMMAND`로 만든 PNG를 SVG로 바꿀 때만 씁니다. 없으면 `art.py`가 `pip install --user vtracer==0.6.15`를 한 번 시도하고, 실패하면 PNG를 그대로 씁니다. |
| API 키 | 선택 | `ELEVENLABS_API_KEY`는 효과음 생성, `RECRAFT_API_KEY`는 벡터 그림 생성에 씁니다. 키가 없으면 Openverse CC0 자료나 내장 합성, 모티프 키트로 대체합니다. |
| 네트워크 | 선택 | `googleFont()`는 Google Fonts에서 글꼴을 받습니다. Openverse 검색과 https 미디어 다운로드도 네트워크를 씁니다. |

환경 변수 전체 목록과 기본값은 [docs/install.md](docs/install.md#환경-변수)에 있습니다.

## 쓰는 방법 세 가지

### 1. 이 저장소 안에서

작품은 `examples/samples/<slug>/`에 둡니다. 새 작품은 `examples/samples/_template/`을 복사해서 시작합니다. 규칙은 [docs/samples/rules.md](docs/samples/rules.md)에 있습니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 스튜디오를 엽니다(127.0.0.1:4317). `VIDEO_ENTRY`로 진입 파일을 바꿉니다. |
| `npm run render -- <entry.tsx> <Id> <out.mp4>` | MP4를 만듭니다. `--frames 30,120`을 붙이면 PNG 컨택트 시트를 만듭니다. |
| `npm run score -- <audio.json>` | 음악과 효과음을 생성합니다. |
| `npm run art -- <assets.json>` | 그림 에셋을 해결합니다. |
| `npm run lint:video -- <entry.tsx>` | 결정성 린트(`Math.random`, `Date.now`, CSS 애니메이션 등)를 돌립니다. |
| `npm run frame-check -- <video.mp4>` | 빈 화면, 정지, 작은 요소를 잽니다. |
| `npm test` | 테스트를 돌립니다. |

### 2. 저장소 밖 프로젝트에서 (CLI)

엔진 저장소에서 `npm link`를 한 번 하면 `frameforge` 명령이 생깁니다. 링크하지 않으려면 `node <엔진 경로>/bin/frameforge.mjs`로 부릅니다.

```sh
npm link                          # 엔진 저장소에서 한 번
frameforge init ~/my-films
cd ~/my-films
frameforge new demo-spot          # films/demo-spot, 컴포지션 id DemoSpot
frameforge score demo-spot        # 음악과 효과음
frameforge studio                 # 스튜디오
frameforge render demo-spot DemoSpot out.mp4 --frame-range 0-59
frameforge check out.mp4          # frame-check와 flash-check
```

생성된 음악, 에셋, 캐시는 프로젝트가 아니라 엔진 저장소의 `public/audio/generated/<slug>`, `public/assets/generated/<slug>`, `.cache`에 쌓입니다. 그래서 slug는 엔진 예제와 다른 프로젝트 사이에서도 겹치지 않게 짓습니다. 자세한 동작은 [docs/reference/cli.md](docs/reference/cli.md)에 있습니다.

### 3. 에이전트 플러그인으로

저장소 자체가 Claude Code, Codex, Cursor, Grok Build용 플러그인입니다. 스킬 11개(`frameforge-best-practices`, `-create`, `-assets`, `-audio`, `-render`, `-studio`, `-check`, `-blocks`, `-voice`, `-3d`, `-generative`)가 들어 있고 MCP 서버는 없습니다.

```sh
# Claude Code
claude plugin marketplace add jonsoku-dev/frameforge
claude plugin install frameforge@frameforge

# Codex
codex plugin marketplace add jonsoku-dev/frameforge
codex plugin add frameforge@frameforge

# 스킬 폴더만 읽는 호스트(Grok Build 등)
npm run skill:install
```

설치 후 새 세션에서 `/frameforge:frameforge-create 20초 제품 소개 모션그래픽`(Claude Code)이나 `$frameforge-create ...`(Codex)로 시작합니다. Cursor 설치와 각 단계의 확인 방법은 [docs/install.md](docs/install.md), 플러그인 구조는 [docs/plugin.md](docs/plugin.md)에 있습니다.

## 무엇이 들어 있나

- 코어 API. `Composition`, `Sequence`, `Series`, `interpolate`, `spring`, `Audio`, `Video` 등. 수학 함수는 기준 패키지를 실행해 기록한 값과 `1e-6` 안에서 맞춥니다.
- 패키지. 전환(`TransitionSeries`), 플레이어, 경로, 도형, 노이즈, 모션 블러, 자막, 레이아웃, 미디어 유틸, Lottie, 3D.
- 블록 카탈로그(`@/blocks`). 글자 6, 로어서드 6변형, 카드 6, 차트 6, 코드 4모드, 다이어그램 4. 모두 프레임 함수이고 같은 prop 계약을 씁니다.
- 이음새. 장면 사이의 컷을 한 동작으로 잇는 곡선(`cutTheCurve`, `zoomThrough`, `<Seam>`)과 렌더가 남긴 움직임 기록으로 방향·속도 불일치를 잡는 `seam-check`.
- 나레이션. `narration.json`에서 `voice.py`(ElevenLabs, kokoro, macOS say, 추정 무음 순)가 음성을 만들고, 측정된 시간으로 장면을 짜는 `useNarration`, 오버레이 자막 `<Subtitles>`, KaTeX 수식 `<Formula>`, `narration-check`. 렌더러는 음성 아래로 음악을 낮춥니다.
- 3D. `3d.json`을 헤드리스 Blender가 결정적으로 렌더한 PNG 시퀀스를 `<ImageSequence>`로 재생, Poly Haven CC0 모델·HDRI 내려받기, `<ThreeCanvas>` 안의 `<Model>`·`<Turntable>`.
- 생성 배경과 효과. 시드와 프레임의 순수 함수인 배경 시스템 9종(`<Generative>`), 색 보정·LUT·라이트 리크·비네트·그레인 효과, 손그림 글자 주석 6종.
- 스튜디오. 기획, 과정 기록, 변수 조정, 렌더 큐를 한 화면에서 봅니다.
- 렌더러. Chrome DevTools Protocol로 프레임을 찍고 FFmpeg로 MP4(H.264), WebM(VP9, 알파), MOV(ProRes 4444, 알파), GIF, PNG 시퀀스를 만듭니다. 구간 렌더, 병렬 청크, 파이프 인코딩, 멱등성 검사, 투명 배경, 배율을 지원합니다.
- 소리. 작품별 `audio.json`에서 음악을 합성하고, 움직임에서 효과음 시점을 뽑고, 음악을 효과음 아래로 낮춥니다.
- 에셋. 44종 모티프 키트와 `assets.json` 해결기(호스트 파일, 이미지 명령, Recraft, Openverse CC0, 키트).
- 검사. 글자 잘림 가드, 결정성 린트, 세이프 영역·겹침·대비·크기 감사, frame-check, flash-check, seam-check, narration-check, 음량 보고. `frameforge check`가 한 표로 묶습니다.

API 전체는 [docs/reference/api.md](docs/reference/api.md)에 있습니다.

## 생성물과 라이선스

이 저장소의 코드는 [MIT License](LICENSE)입니다. 제3자 코드, 글꼴, 의존성은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 정리했습니다.

음악, 효과음, 그림은 실행할 때 생성하거나 내려받습니다. 저장소에 커밋하지 않습니다(`public/audio/generated/`, `public/assets/generated/`, `.cache/`는 `.gitignore`에 있습니다). 생성물의 라이선스는 사용자가 확인합니다. ElevenLabs와 Recraft 생성물은 각 서비스 약관을 따릅니다. Openverse 자료는 기본으로 CC0만 씁니다. CC BY 자료를 허용하면(`FRAMEFORGE_SFX_LICENSES=cc0,by`) 생성기가 `CREDITS.md`를 만들고, 영상을 배포할 때 그 저작자 표시를 함께 실어야 합니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 에이전트가 클론부터 첫 렌더와 스튜디오까지 따라 하는 순서 |
| [docs/agent-install.md](docs/agent-install.md) | 에이전트에게 붙여 넣는 설치·제작·제거 프롬프트(한국어, 영어, 일본어) |
| [docs/manual.md](docs/manual.md) | 사람이 처음부터 따라 하는 설치, 첫 작품, 제거 |
| [docs/install.md](docs/install.md) | 설치 경로별 단계와 확인 방법, 환경 변수 |
| [docs/uninstall.md](docs/uninstall.md) | 완전히 지우는 순서와 확인 방법 |
| [docs/reference/api.md](docs/reference/api.md) | API 지원 범위, 패키지, 소리, 에셋 |
| [docs/reference/studio.md](docs/reference/studio.md) | 스튜디오 실행과 탭 |
| [docs/reference/rendering.md](docs/reference/rendering.md) | 렌더러, 병렬 렌더, 결정성 린트 |
| [docs/reference/quality-checks.md](docs/reference/quality-checks.md) | 글자 잘림 가드와 검사 도구 |
| [docs/reference/cli.md](docs/reference/cli.md) | 저장소 밖 프로젝트 CLI |
| [docs/reference/verification.md](docs/reference/verification.md) | 검증 기록, REA 상태 |
| [docs/guides/README.md](docs/guides/README.md) | 기획, 모션, 에셋, 모델별 작업 가이드 |
| [docs/README.md](docs/README.md) | 모든 문서의 목록 |

기여 방법은 [CONTRIBUTING.md](CONTRIBUTING.md), 보안 문제 신고는 [SECURITY.md](SECURITY.md), 변경 이력은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.
