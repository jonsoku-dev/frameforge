# 프로그래매틱 비디오 엔진 조사: Frameforge 설계를 위한 비교 (2026-10-20)

이 문서는 Frameforge의 다음 단계를 정하기 위해 Remotion, HyperFrames, Motion Canvas, Revideo, MotionForge를 비교한다. 각 주장 옆에 직접 연 파일 경로나 문서 URL을 적었다. "관찰"은 파일을 열어 확인한 사실이고, "추론"은 그 사실에서 끌어낸 판단이다. 열지 못했거나 확인하지 못한 것은 마지막 절에 따로 모았다.

## 조사 기준

| 프로젝트 | 열어 본 저장소 | 고정한 커밋 | 방식 |
| --- | --- | --- | --- |
| Remotion | `remotion-dev/remotion` | `main` (2026-10-20 raw 조회, 법무 검토 문서의 기준 커밋은 `051aeb2`) | GitHub API로 `packages/` 목록, `packages/docs/docs/*.mdx` 공개 문서, `LICENSE.md`만 읽음. 구현 파일은 열지 않음 |
| HyperFrames | `heygen-com/hyperframes` | `f503387` | shallow clone (Git LFS 건너뜀), README, 패키지 README, 핵심 소스 |
| Motion Canvas | `motion-canvas/motion-canvas` | `7b91435` | shallow clone, 핵심 소스 |
| Revideo | `midrender/revideo` (`redotvideo/revideo`가 이 주소로 리다이렉트됨, GitHub API의 `full_name` 값) | `b5de67a` | shallow clone, 핵심 소스와 docs 패키지 |
| MotionForge (A) | `codedbytahir/motionforge` | `d0f2466` | shallow clone |
| MotionForge (B) | `codewithwan/motionforge` | `7576e05` | shallow clone |
| Theatre.js | `theatre-js/theatre` | README만 | 라이선스 확인용 |

## 내 앱: Frameforge

Frameforge는 React 19, TypeScript, Vite로 만든 로컬 영상 도구다. `src/core/index.tsx`와 `src/core/math.ts`는 Remotion 공개 API의 일부(`Composition`, `Sequence`, `Series`, `Loop`, `Freeze`, `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`, `random`, `delayRender`, `googleFont`)를 MIT로 독립 구현한 것이다. Vite alias `frameforge`가 이 구현을 가리키므로 기존 Remotion 컴포지션은 import 지정자를 `frameforge`로 바꾸면 올라간다(당시 저장소에 있던 커뮤니티 예제가 그렇게 했다). 구현 범위는 이후 크게 넓어졌다(`docs/research/feature-parity-roadmap.md`).

코어의 시간 모델은 단순하다(관찰, `src/core/index.tsx`). `FrameProvider`가 `TimelineContext`에 `{frame, config}`를 넣고, `Sequence`는 `parent.frame - from`에 `playbackRate`와 `trimBefore`를 적용해 자식 컨텍스트를 새로 만든다. 렌더 대기는 모듈 전역 `pending` 맵과 `whenRenderReady()` 폴링으로 처리한다. 작성 당시 `Video`, `OffthreadVideo`는 호출 즉시 예외를 던졌다. 지금은 ffmpeg 프레임 추출로 구현되어 있다(로드맵 B·F 단계). `Audio`는 상수 볼륨과 트림만 지원한다.

`src/studio/main.tsx`는 작성 당시 장면 목록, 재생, 슬라이더 탐색만 가진 미리보기 화면이었다. 지금은 스튜디오 2.0(레일, 스테이지, 인스펙터 네 탭, 타임라인, `docs/studio/spec.md`)이다. `?render` 쿼리가 붙으면 `window.__FRAMEFORGE__`에 `configure(props)`, `renderFrame(id, frame, props)`, `audit()`을 노출한다. `audit()`은 글자 잘림을 찾아 보고하며, 미리보기 하단에도 "글자 잘림 N곳"으로 표시된다.

`scripts/render.mjs`는 Vite 개발 서버를 띄우고, Chrome을 `--headless=new --remote-debugging-port=0`으로 직접 실행한 뒤 Node 내장 `fetch`와 `WebSocket`으로 CDP에 붙는다. 프레임마다 `renderFrame`을 평가하고 `Page.captureScreenshot`으로 PNG를 디스크에 쓰며, 끝나면 시스템 FFmpeg로 `libx264`, `yuv420p` 인코딩을 한다. 출력은 하드 링크로 원자적으로 게시한다. 작성 당시에는 직렬 렌더였고, 지금은 `--concurrency` 청크 병렬과 `--pipe` 스트리밍이 있다(4.2, 4.3). 오디오는 2026-10-20에 붙었다. `Audio`가 절대 시작 프레임을 레지스트리에 등록하고, 렌더러가 프레임마다 수집해 `adelay`/`amix`로 섞는다(4.4의 제안이 구현된 상태).

독립 CLI `scripts/render.mjs`는 2026-10-20에 `puppeteer-core` 없이 Chrome DevTools Protocol로 다시 작성됐고, 같은 날 당시 데모 두 편(600프레임, 450프레임)을 끝까지 렌더해 ffprobe로 확인했다. 아래 4.2와 4.3의 병렬·파이프 제안은 이 CLI 위에 얹었다.

목적은 Claude 같은 AI 에이전트가 광고와 모션 그래픽 영상을 결정적 프레임 함수로 작성하게 하는 것이다. 법적 경계는 `docs/legal/remotion-license-review.md`에 있다. Remotion 구현 코드는 복사하거나 가깝게 옮기지 않고, 공개 문서와 공개 타입, 블랙박스 동작만 쓴다. Apache-2.0과 MIT 프로젝트는 깊게 읽고 패턴을 다시 구현할 수 있으며, 코드를 옮겨 오면 출처를 남긴다.

## 1. 아키텍처 비교

| 항목 | Remotion | HyperFrames | Motion Canvas | Revideo | MotionForge (A / B) |
| --- | --- | --- | --- | --- | --- |
| 컴포지션 표현 | React 컴포넌트 | HTML 파일 + `data-*` 속성 | TSX로 만든 Canvas 씬 그래프(`2d/src/lib/components`) | Motion Canvas와 같음 | A: React 컴포넌트, B: `project.config.json` + 단일 `index.html` |
| 시간 모델 | `useCurrentFrame()` 랜덤 접근 | `data-start`/`data-duration`, `FrameAdapter.seekFrame(frame)` | 제너레이터 `yield*`, `Thread.time` 시그널 | 같음, 변수는 시그널(`Variables.ts`) | A: 프레임 번호 컨텍스트, B: 일시정지된 GSAP 타임라인 |
| 렌더 파이프라인 | 헤드리스 Chrome + FFmpeg(`@remotion/renderer`), WebCodecs 클라이언트 렌더(`@remotion/web-renderer`) | 헤드리스 Chrome `HeadlessExperimental.beginFrame` + FFmpeg | 브라우저 Canvas, `Exporter.handleFrame`, FFmpeg 플러그인 | 브라우저 Canvas + WebCodecs(`mp4-wasm`), 오디오만 Node FFmpeg | A: SVG `foreignObject`→Canvas→`VideoEncoder`/`MediaRecorder`, B: Puppeteer PNG + FFmpeg |
| 미리보기/편집기 | Studio, 시각적 props 편집, `@remotion/player` | Studio, `<hyperframes-player>`, `snapshot` CLI | 편집기(`ui` 패키지), 타임 이벤트 | 편집기, React `<Player/>` | A: Next.js 앱, B: `?debug=1` 스크럽 패널 |
| 배치/분산 | `renderMedia`의 `frameRange`, `concurrency`, Lambda, Cloud Run | `parallelCoordinator`, AWS Lambda, 렌더 HTTP 서버 | 없음(편집기에서 내보내기) | `renderVideo({workers})`, `renderPartialVideo()` | 없음 |
| 라이선스 | Remotion License (Free License / Company License) | Apache License 2.0 | MIT License | MIT License | 둘 다 MIT License |

Remotion 라이선스 요약(관찰, `LICENSE.md`). Free License 자격은 "an individual", "a for-profit organization with up to 3 employees", "a non-profit or not-for-profit organization", 상업적 사용 전의 평가 단계다. 그 밖의 영리 조직은 Company License를 사야 한다. 기능 차이는 없다고 FAQ가 밝힌다(`packages/docs/docs/license/faq.mdx`). 파생물 제한은 Free License 절 아래의 다음 문장이다. Company License 절은 Free License의 허용 용도를 부여한다고만 적으므로, 이 제한이 Company License 보유자에게도 그대로 걸린다는 것은 추론이다. "It is not allowed to copy or modify Remotion code for the purpose of selling, renting, licensing, relicensing, or sublicensing your own derivate of Remotion." 5.0에서 문구가 바뀐다는 안내가 같은 파일 머리에 있다(PR #3750, 법무 검토 문서에 정리됨). 패키지별로 MIT인 것(`@remotion/paths`, `@remotion/shapes` 등)과 Remotion License인 것이 섞여 있다는 점도 법무 문서에 기록되어 있다.

Theatre.js는 README만 열었다. 코어(`@theatre/core`)는 Apache-2.0이고 스튜디오(`@theatre/studio`)는 AGPL 3.0이며, 마지막 push는 2024-08-14다. 스튜디오 코드를 MIT 제품에 섞을 수 없으므로 이 문서에서는 더 다루지 않는다.

## 2. 각 프로젝트에서 잘 만든 부분

### Remotion

DX와 학습 곡선. React를 아는 사람에게는 "프레임 번호를 받아 화면을 돌려주는 함수"라는 모델 하나로 충분하다. `flickering.mdx`는 이 모델을 네 가지 검사로 요약한다: 같은 프레임은 항상 같은 화면, 프레임 순서에 의존하지 않음, 정지 상태에서 움직이지 않음, `random()` 외 난수 금지.

결정성과 안정성. 렌더러가 여러 탭에 프레임을 나눠 주기 때문에 프레임 함수가 순수하지 않으면 바로 깜빡임으로 드러난다(`flickering.mdx`). 즉 병렬성이 결정성을 강제하는 구조다. 에셋 대기는 `delayRender`와 미디어 컴포넌트가 맡는다.

애니메이션 제어. `interpolate`, `spring`, `Sequence`, `Series`의 조합은 직관적이다. 시간 이동이 컴포넌트 트리 구조로 드러나서 코드만 보고 타이밍을 읽을 수 있다(추론).

AI 에이전트 친화성. 공식 Agent Skills(`/remotion-best-practices`, `/remotion-markup`, `/remotion-render` 등, `ai/skills.mdx`), MCP, 각 플러그인 문서(`ai/` 디렉터리 목록)를 갖췄다. `schemas.mdx`는 에이전트에게 줄 프롬프트를 문서에 그대로 싣는다.

서버/배치 적합성. `renderMedia`는 `frameRange`, `concurrency`, `everyNthFrame`, `separateAudioTo`, `forSeamlessAacConcatenation`, `repro`, `cancelSignal` 등 운영 옵션이 풍부하다(`renderer/render-media.mdx`의 옵션 목록). `distributed-rendering.mdx`는 자체 분산 렌더러의 청사진을 공개한다. 핵심 규칙은 "Every chunk must render the same amount of frames, except the last one"이며 AAC 오디오 이음매 때문이라고 설명한다.

확장성과 생태계. `packages/` 아래에 transitions, lottie, three, skia, captions, whisper, media-parser, webcodecs, web-renderer 등 수십 개 패키지가 있다(GitHub API 목록). 시각적 편집은 `defaultProps`에서 컨트롤을 추론하고, 인라인 리터럴이면 코드로 다시 저장한다(`visual-editing.mdx`).

### HyperFrames

DX와 학습 곡선. 빌드 단계 없이 `index.html`이 그대로 재생된다(README "Why HyperFrames?"). 타이밍은 `data-start`, `data-duration`, `data-track-index` 속성이고, 애니메이션은 일시정지된 GSAP 타임라인을 `window.__timelines`에 등록하는 방식이다(README "How It Works").

결정성. 문서가 규칙을 짧게 못박는다. 벽시계 금지, 시드 없는 난수 금지, 렌더 중 fetch 금지, 크기와 fps 고정, 유한한 길이(`docs/concepts/determinism.mdx`). 프레임 시간은 `time = floor(frame) / fps`로 정수 연산한다. 캡처는 `HeadlessExperimental.beginFrame`으로 원자적으로 한다(관찰, `packages/engine/src/services/screenshotService.ts`의 `beginFrameCapture`). Docker 렌더로 Chromium, 폰트, FFmpeg를 고정하라는 권고도 있다.

성능. `frameCapture.ts`에 정적 프레임 중복 제거가 기본으로 켜져 있다. 바이트가 같은 연속 프레임은 직전 버퍼를 재사용하고, PSNR 검증을 붙였다(관찰, `packages/engine/src/services/frameCapture.ts`의 `staticDedup*` 필드, `parallelCoordinator.ts`의 `psnrDb` import). `streamingEncoder.ts`는 PNG를 디스크에 쓰지 않고 FFmpeg로 바로 흘린다(`packages/engine/README.md`).

애니메이션 제어. `FrameAdapter`가 다섯 필드짜리 작은 계약이다(관찰, `packages/core/src/adapters/types.ts`).

```ts
interface FrameAdapter {
  id: string;
  init?: (ctx: FrameAdapterContext) => Promise<void> | void;
  getDurationFrames: () => number;
  seekFrame: (frame: number) => Promise<void> | void;
  destroy?: () => Promise<void> | void;
}
```

계약 문서는 정방향, 역방향, 임의 탐색 모두 같은 상태를 내야 하고, 비동기 작업은 캡처 전에 끝나야 한다고 요구한다(`docs/concepts/frame-adapters.mdx`의 Contract 절). GSAP, Lottie, Three.js, CSS, WAAPI를 같은 계약 아래에 둔다.

AI 에이전트 친화성. 이 항목이 가장 강하다. 21개 스킬과 라우터 스킬(`/hyperframes`), `/remotion-to-hyperframes` 이식 스킬이 있다(README "Skills"). 린터는 기계가 읽을 수 있는 코드를 낸다. 예: `css_transition_used`("runs on the browser clock and cannot be seeked deterministically"), `missing_timeline_registry`, `root_missing_dimensions`, `timeline_id_mismatch`(관찰, `packages/lint/src/rules/core.ts`). CLI에는 `lint`, `check`, `snapshot`, `validate`, `inspect`, `keyframes`, `layout`, `contrast-*`가 있다(관찰, `packages/cli/src/commands/`). `snapshot`은 키 프레임 몇 장이나 균등 간격 프레임, 특정 요소 확대, 기준 영상과의 비교(`--against ref.mp4`)를 지원한다(`snapshot.ts`의 예시 문자열). 에이전트가 영상을 전부 렌더하지 않고 스스로 검증할 수 있게 하는 도구다(추론).

서버/배치. `@hyperframes/producer`는 `createRenderJob`/`executeRenderJob`과 HTTP 렌더 서버(`startServer`, `POST /render`)를 제공하고, mp4, webm(VP9 알파), mov(ProRes 4444), png-sequence, hls를 출력한다(`packages/producer/README.md`). `parallelCoordinator.ts`의 `WorkerTask`는 `startFrame`, `endFrame`, `outputFrameOffset`, 그리고 인터리브 분배용 `stride`를 가진다.

확장성. `data-composition-variables`로 바꿔도 되는 입력을 타입과 함께 선언한다(`docs/concepts/variables.mdx`). 카탈로그(`hyperframes add`)로 블록을 설치한다.

### Motion Canvas

DX와 학습 곡선. 제너레이터 문법(`yield* waitFor(1)`)은 처음엔 낯설지만 "순서대로 일어나는 일"을 서술하기 좋다. 반면 React 경험은 거의 재사용되지 않는다(추론).

결정성. 씬마다 메타 파일의 시드로 `Random`을 만든다(관찰, `packages/core/src/scenes/GeneratorScene.ts` 150, 289행). `Thread`는 `time` 외에 프레임 길이의 배수인 `fixed` 시간을 따로 둬서 한 프레임보다 짧은 대기를 보정한다(관찰, `packages/core/src/threading/Thread.ts`).

중요한 관찰 하나. 탐색은 랜덤 접근이 아니다. `PlaybackManager.seek(frame)`은 뒤로 가거나 다른 씬으로 가면 씬을 `reset()`하고, 목표 프레임까지 `next()`를 반복한다(관찰, `packages/core/src/app/PlaybackManager.ts` 83~108행). 긴 씬의 끝 프레임을 렌더하려면 앞부분을 다시 시뮬레이션해야 하므로 프레임 단위 분산에 불리하다(추론).

애니메이션 제어. `all`, `any`, `chain`, `sequence`, `loop`, `delay` 같은 흐름 연산자가 `packages/core/src/flow/`에 있다. `waitUntil('event')`는 이름 붙은 시간 이벤트를 기다리고, 그 길이는 `useDuration(event)`로 메타 파일에서 읽는다(관찰, `packages/core/src/flow/scheduling.ts`). 편집기 타임라인에서 이 이벤트를 끌어 옮기면 코드 수정 없이 타이밍이 바뀐다(문서 주석 "Time events are displayed on the timeline and can be edited", 같은 파일). 내레이션 맞추기에 강하다.

AI 에이전트 친화성. 별도 에이전트 도구는 찾지 못했다. 시간 이벤트를 메타 파일(JSON)에 두는 구조는 에이전트가 숫자만 고치기 좋다(추론).

서버/배치. `Exporter` 인터페이스(`configuration`, `start(sounds, duration)`, `handleFrame(canvas, frame, sceneFrame, sceneName, signal, context)`, `stop`)가 깔끔하다(관찰, `packages/core/src/app/Exporter.ts`). FFmpeg 연동은 Vite 서버 쪽 브리지로 한다(`packages/ffmpeg/server/FFmpegBridge.ts`). 헤드리스 배치 렌더 API는 코어에 없다.

확장성. `makePlugin`과 `DefaultPlugin`으로 플러그인을 붙인다(`packages/core/src/plugin/`). 2D 컴포넌트에 `Latex`, `Code`, `CodeBlock`, `Camera`가 있어 설명 영상에 강하다.

### Revideo

DX. Motion Canvas 모델을 그대로 쓰면서 README가 "A scene is plain TypeScript, so Claude or Codex can produce one from a prompt"라고 에이전트 생성을 전면에 둔다.

성능과 파이프라인. 프레임 그리기와 비디오 인코딩은 브라우저에서 Canvas와 WebCodecs `VideoEncoder`로 하고, Node 쪽 FFmpeg는 오디오 추출과 병합만 한다(관찰, `packages/docs/src/content/guide/rendering-videos.mdx` "How does Rendering work?"). 구현은 `mp4-wasm`의 `createWebCodecsEncoder`를 쓴다(관찰, `packages/core/src/exporter/WasmExporter.ts`). PNG 왕복이 없으므로 스크린샷 방식보다 빠르다는 것이 문서의 주장이다("almost always faster than real-time"). 직접 측정하지는 않았다.

서버/배치. `renderVideo()`의 `RenderSettings.workers`로 한 머신에서 병렬화하고, 워커마다 Vite 포트를 하나씩 올린다(`viteBasePort`, 관찰, `packages/renderer/server/render-video.ts` 27~58행). 서버리스용으로 `renderPartialVideo({workerId, numWorkers})`를 노출하고, 결과는 `concatenateMedia()`와 `mergeAudioWithVideo()`로 합친다. 프레임 분할은 `packages/renderer/client/render.ts` 117행 부근의 `framesPerWorker` 계산이다.

오디오. `packages/ffmpeg/src/generate-audio.ts`가 `atrim`, `adelay`, `amix` 필터로 클립별 오디오를 잘라 지연시키고 섞는다. Frameforge가 오디오를 붙일 때 가장 짧은 참고가 된다.

주의. README에 PostHog 익명 렌더 수집이 있고 `DISABLE_TELEMETRY=true`로 끈다. 패턴을 가져올 때 텔레메트리는 가져오지 않는다.

### MotionForge

이름이 모호하다. GitHub 검색에 같은 이름의 저장소가 여럿 나오며, 그중 README와 LICENSE가 있는 두 개를 열었다. 둘은 서로 무관하고, 둘 다 MIT다. 둘 다 확립된 엔진이라고 보기는 어렵다.

MotionForge (A), `codedbytahir/motionforge`. "Free open-source Remotion alternative"를 표방하는 React/Next.js 프로젝트다. 내보내기는 DOM을 SVG `foreignObject`로 감싸 Canvas에 그리고 `VideoEncoder` 또는 `MediaRecorder`로 인코딩한다(관찰, `packages/motionforge/src/renderer/export.ts` 75~111행, 204~305행). 프레임마다 `requestAnimationFrame` 한 번과 `setTimeout(20)`을 기다린다(같은 파일 430행 부근). WebCodecs 경로의 주석은 컨테이너 먹싱 없이 청크를 이어 붙여 유효한 WebM이 아닐 수 있다고 스스로 인정한다(254행 부근). 소스 주석에 "Remotion-like framework"라는 표현이 있다(`core/types.ts`, `utils/animation.ts` 1행). 법적 주의: 이 코드가 Remotion 구현을 옮긴 것인지 확인하지 않았으므로 Frameforge로 코드를 가져오면 피하려던 제한을 우회 경로로 들여올 위험이 있다. 아이디어도 참고하지 않는 편이 낫다.

MotionForge (B), `codewithwan/motionforge`. 엔진이 아니라 Agent Skill이다(`SKILL.md`, `metadata.based_on: bang-motion by Bang Tutorial (MIT)`). 프로젝트를 `project.config.json`(스타일 브리프, 씬 목록, 에셋 목록)으로 정의하고 GSAP 타임라인을 가진 단일 `index.html`을 생성한다. 렌더는 Puppeteer로 PNG를 뽑고 FFmpeg로 인코딩한다(`scripts/export-frames.mjs`, README "Render to MP4 / GIF"). 볼 만한 부분은 기술이 아니라 연출 규칙이다. "Scenes change because the world or the camera moves", "At most two text tiers per scene", "Motion every second"처럼 기계적으로 검사할 수 있는 규칙을 둔다(README "What makes it not look like slides", 전체 목록은 `references/anti-ppt.md`라고 README가 안내하나 그 파일 본문은 확인하지 않음). 광고 영상을 에이전트에게 맡길 때 품질 하한을 올리는 장치다(추론).

## 3. Remotion의 강점과 약점, 그리고 다른 프로젝트의 보완

강점. 첫째, `useCurrentFrame()` 기반 랜덤 접근 시간 모델이다. 어느 프레임이든 독립적으로 계산할 수 있어 병렬, 분산, 부분 재렌더가 쉽다. Motion Canvas 계열은 구조상 이것이 없다(`PlaybackManager.seek` 관찰). Frameforge가 이미 이 모델을 가졌다는 점이 가장 큰 자산이다. 둘째, React 생태계 전체를 쓸 수 있다. 셋째, 렌더 옵션과 분산 렌더 문서가 성숙했다. 넷째, 공식 Agent Skills와 시각적 props 편집이 있다.

| Remotion의 약점 | 근거 | 보완하는 프로젝트와 방식 |
| --- | --- | --- |
| 라이선스: 4인 이상 영리 조직은 Company License, 파생물 재라이선스 금지 | `LICENSE.md` | HyperFrames(Apache-2.0), Motion Canvas/Revideo(MIT). Frameforge는 독립 구현으로 같은 위치를 노린다 |
| 번들러와 React가 필수 | HyperFrames README 비교표 | HyperFrames: 빌드 없는 HTML. 에이전트가 산출물 하나만 쓰면 됨 |
| 벽시계 기반 라이브러리(GSAP, CSS 애니메이션)를 그대로 쓰면 깨짐 | `flickering.mdx` | HyperFrames `FrameAdapter`: 외부 라이브러리를 일시정지 후 `seekFrame`으로 구동. 린터가 `css_transition_used`로 사전 차단 |
| 분산 렌더는 사실상 Lambda로 유도, 자체 구현은 직접 해야 함 | `distributed-rendering.mdx` | Revideo `renderPartialVideo` + `concatenateMedia`, HyperFrames `parallelCoordinator`의 `WorkerTask`. 둘 다 허용 라이선스라 패턴 학습 가능 |
| 스크린샷 기반 서버 렌더는 PNG 왕복 비용이 큼 | 추론(Frameforge 자체 `render.mjs`에서도 같은 구조) | Revideo: Canvas + WebCodecs. HyperFrames: 스트리밍 인코더, 정적 프레임 중복 제거. Remotion 자신도 `@remotion/web-renderer`로 WebCodecs 경로를 추가함 |
| 에이전트 자기 검증 도구가 렌더/스틸 중심 | `ai/skills.mdx` | HyperFrames `lint`/`check`/`snapshot --against`, 기계 판독 오류 코드 |
| 타이밍을 숫자로 코드에 박아 넣음 | 추론 | Motion Canvas 이름 붙은 시간 이벤트(`waitUntil`), HyperFrames `data-composition-variables` |
| 연출 품질은 작성자 몫 | 추론 | MotionForge (B)의 검사 가능한 연출 규칙 |

## 4. Frameforge에 가져올 아이디어 (우선순위순)

구현 상태(2026-10-20 저녁): 4.1은 `npm run lint:video`와 `--check-idempotent`로, 4.2·4.3은 `scripts/render.mjs`의 `--frame-range`/`--concurrency`/`--pipe`와 정지 프레임 하드 링크로, 4.4는 오디오 믹스로, 4.5는 `--frames` 컨택트 시트와 `scripts/snapshot-diff.mjs --against`로, 4.6은 스튜디오 조정 탭의 `variables`로 들어왔다. 4.7과 4.8(GSAP 어댑터)은 없다. 아래 본문은 제안을 쓴 시점의 글이다.

아래는 모두 패턴 수준의 제안이다. Remotion에서는 공개 문서에 적힌 규칙과 옵션 이름만 쓰고, HyperFrames와 Revideo에서 코드를 옮길 경우 해당 파일 경로와 라이선스를 주석으로 남긴다.

### 4.1 결정성 린트와 기계 판독 오류 코드 (P0)

출처: HyperFrames `packages/lint/src/rules/core.ts`, Remotion `flickering.mdx`의 네 가지 검사.

Frameforge의 목적상 에이전트가 쓴 컴포지션의 비결정성을 렌더 전에 잡는 것이 가장 효과가 크다. 정적 검사는 엔트리 파일과 그 import 그래프에서 `Math.random(`, `Date.now(`, `performance.now(`, `requestAnimationFrame(`, `setInterval(`, CSS `transition`/`animation`/`@keyframes`를 찾는다. 런타임 검사는 렌더 모드에서 같은 프레임을 두 번 그려 DOM 직렬화나 픽셀 해시가 같은지 비교한다. 이미 있는 `audit()`(글자 잘림)과 같은 표면에 붙인다.

```ts
// src/studio/main.tsx 의 window.__FRAMEFORGE__ 확장
type LintCode = 'wall_clock' | 'unseeded_random' | 'css_time_animation'
  | 'frame_not_idempotent' | 'text_clipped' | 'pending_delay_render';
interface LintFinding {
  code: LintCode; severity: 'error' | 'warning';
  compositionId: string; frame?: number;
  message: string; fixHint: string; // 에이전트가 그대로 읽고 고칠 수 있는 한 문장
}
interface FrameforgeBridge {
  audit(): Omit<ClippedText, 'element'>[];   // 기존
  lint(id: string, sampleFrames: number[]): Promise<LintFinding[]>; // 신규
}
```

`scripts/render.mjs`에 `--lint-only` 모드를 두고 결과를 JSON으로 출력한다. `random()`은 이미 시드형이므로 `fixHint`에 "`random('seed')`를 쓰라"고 적을 수 있다.

### 4.2 프레임 범위 분할 병렬 렌더 (P0)

출처: Remotion 문서의 `frameRange`/`concurrency` 옵션 이름과 청크 규칙, Revideo `renderPartialVideo`, HyperFrames `WorkerTask`.

Frameforge의 프레임 함수는 이미 랜덤 접근이므로 병렬화에 구조적 장애가 없다. `renderMedia`에 `frameRange`와 `concurrency`를 추가하고, 워커마다 Chrome 프로세스(또는 같은 Chrome의 탭)를 하나씩 두며, 각 워커가 자기 범위를 세그먼트 파일로 인코딩한 뒤 FFmpeg concat demuxer(`-f concat -c copy`)로 합친다. 오디오는 비디오와 분리해 마지막에 한 번만 붙이면 Remotion 문서가 경고한 AAC 청크 경계 문제를 피한다.

```ts
// scripts/render.mjs
interface RenderMediaOptions {
  serveUrl: string; composition: string; outputLocation: string;
  inputProps?: Record<string, unknown>;
  frameRange?: [number, number];   // 포함 구간, 0..durationInFrames-1
  concurrency?: number;            // 기본 1
}
interface Chunk { index: number; start: number; end: number; file: string }
// 청크는 마지막을 제외하고 같은 길이로 나눈다.
```

렌더 흐름: Vite 서버 1개 → `configure` 1회로 메타데이터 확정 → 청크 계획 → 워커 N개가 각자 CDP 세션에서 `renderFrame` + 캡처 + FFmpeg stdin 인코딩 → concat → (오디오 있으면) mux → 하드 링크 게시. 실패한 청크만 재시도한다.

### 4.3 PNG 디스크 왕복 제거와 정적 프레임 재사용 (P1)

출처: HyperFrames `streamingEncoder.ts`, `frameCapture.ts`의 정적 중복 제거.

작성 당시 `render.mjs`는 프레임마다 base64 PNG를 디스크에 쓰고 마지막에 FFmpeg를 돌린다. FFmpeg를 먼저 `-f image2pipe -i -`로 띄우고 디코딩한 버퍼를 stdin에 쓰면 디스크 I/O와 임시 공간이 사라진다. 광고 영상은 정지 구간이 많으므로, 직전 프레임과 바이트가 같은 PNG는 해시 비교로 재사용한다. 비교는 캡처 후 버퍼에서 하므로 정확성에 영향이 없다. HyperFrames는 캡처 자체를 건너뛰는 예측까지 하지만, 그 부분은 검증 비용이 크므로 뒤로 미룬다.

`HeadlessExperimental.beginFrame`은 원자적 캡처라는 장점이 있지만 `chrome-headless-shell`이 필요하다(HyperFrames `packages/engine/README.md`의 browserManager 설명). Frameforge에서 시험하지 않았으므로 측정 후 결정한다.

### 4.4 오디오: 선언 수집 후 FFmpeg 믹스 (P1)

출처: Revideo `packages/ffmpeg/src/generate-audio.ts`(MIT), HyperFrames `audioMixer.ts`(Apache-2.0)의 구조. Remotion의 `<Audio>` 공개 props 이름만 맞춘다.

`src/core/index.tsx`의 `Audio`는 작성 당시 예외를 던졌다. 렌더 모드에서는 소리를 재생할 필요가 없으므로, `Audio`가 렌더 중 자신의 절대 시작 프레임과 길이를 레지스트리에 등록하고 아무것도 그리지 않으면 된다. 미리보기에서는 `<audio>` 요소를 현재 프레임에 맞춰 동기화한다. 절대 프레임 계산을 위해 `TimelineContext`에 부모 기준 오프셋을 함께 실어야 한다(현재는 지역 `frame`만 있음).

```ts
// src/core/index.tsx
interface AudioClip {
  src: string;                 // staticFile() 결과
  startFrame: number;          // 루트 타임라인 기준 절대 프레임
  durationInFrames: number;
  trimBefore: number;          // 원본 오디오에서 건너뛸 프레임
  volume: number | number[];   // 상수 또는 프레임별 값
}
// 렌더 모드 브리지: window.__FRAMEFORGE__.audioClips(id): AudioClip[]
```

`scripts/render.mjs`는 비디오를 다 만든 뒤 클립마다 `atrim`과 `adelay`, 볼륨을 적용하고 `amix`로 합쳐 AAC로 mux한다. 프레임별 볼륨 배열은 처음에는 지원하지 않고 상수만 받는다. Revideo의 필터 구성 문자열을 옮겨 쓴다면 파일 상단에 출처와 MIT 고지를 남긴다.

### 4.5 에이전트용 스냅샷과 대조 (P1)

출처: HyperFrames `snapshot` 명령.

전체 렌더 없이 대표 프레임 K장만 PNG로 뽑아 한 장의 컨택트 시트로 합치는 명령이다. 기존 `renderFrame`과 캡처 코드를 그대로 재사용한다. 에이전트는 이 이미지를 보고 레이아웃을 고친다. 기준 영상이나 이전 스냅샷과의 픽셀 차이를 숫자로 내는 `--against`는 회귀 테스트에도 쓰인다(README의 픽셀 비교 작업과 같은 용도).

```sh
npm run render -- snapshot examples/samples/kit-launch/entry.tsx KitLaunch --frames 0,45,90,300 --out renders/kit-launch-sheet.png
```

### 4.6 선언된 입력 변수 (P2)

출처: HyperFrames `data-composition-variables`, Remotion 문서의 `defaultProps` 추론과 Zod 스키마 개념.

광고는 같은 디자인에 문구, 색, 로고만 바꾸는 일이 많다. `CompositionDefinition`에 선택적 `variables` 배열을 두면 스튜디오가 컨트롤을 만들고, CLI가 입력 JSON을 검증하고, 에이전트가 무엇을 바꿔도 되는지 안다. Zod 의존을 추가하지 않고 작은 JSON 기술자로 시작한다.

```ts
type VariableSpec =
  | {id: string; type: 'string' | 'color' | 'asset'; label?: string; default: string}
  | {id: string; type: 'number'; label?: string; default: number; min?: number; max?: number}
  | {id: string; type: 'enum'; label?: string; default: string; options: string[]};
// CompositionDefinition.variables?: VariableSpec[]
```

### 4.7 이름 붙은 시간 마커 (P3)

출처: Motion Canvas `waitUntil`/`useDuration`과 `scenes/timeEvents/`.

`useMarker('cta')`가 컴포지션 옆 JSON에서 프레임 번호를 읽게 하면 에이전트나 사람이 코드 대신 숫자만 고쳐 타이밍을 조정할 수 있다. 다만 Frameforge는 `Sequence`의 `from`이 이미 같은 역할을 하고, 변수(4.6)로도 표현할 수 있으므로 우선순위가 낮다. 제너레이터 시간 모델 자체는 랜덤 접근을 잃으므로 가져오지 않는다.

### 4.8 외부 애니메이션 라이브러리 어댑터 (P3)

출처: HyperFrames `FrameAdapter`.

GSAP 같은 라이브러리를 Frameforge 안에서 쓰고 싶을 때 `useFrameAdapter(adapter)` 훅이 렌더마다 `seekFrame(useCurrentFrame())`를 호출하게 할 수 있다. 계약(같은 프레임은 같은 상태, 임의 탐색, 캡처 전 비동기 종료)은 HyperFrames 문서의 표현을 참고해 새로 쓴다. 에이전트가 React 대신 GSAP 지식을 쓰게 되는 장점이 있지만, 기존 Remotion 호환 목표와는 직접 관계가 없다.

## 5. 최종 정리

### 도입할 기능 TOP 5

| 순위 | 기능 | 이유 | 출처 | 구현 위치 |
| --- | --- | --- | --- | --- |
| 1 | 결정성 린트 + 기계 판독 오류 코드 | 에이전트 작성 영상의 가장 흔한 실패(깜빡임, 비결정)를 렌더 전에 차단 | HyperFrames lint, Remotion `flickering.mdx` | `src/studio/main.tsx` 브리지, `scripts/render.mjs --lint-only` |
| 2 | `frameRange` + `concurrency` 병렬 렌더 | 랜덤 접근 모델의 이점을 실제 속도로 바꿈 | Remotion 문서 옵션명, Revideo `renderPartialVideo`, HyperFrames `WorkerTask` | `scripts/render.mjs` |
| 3 | 오디오 클립 수집과 FFmpeg 믹스 | 광고 영상에 음악과 효과음은 필수, 작성 당시 최대 기능 공백 | Revideo `generate-audio.ts`, HyperFrames `audioMixer.ts` | `src/core/index.tsx`의 `Audio`, `scripts/render.mjs` |
| 4 | 스트리밍 인코딩 + 정적 프레임 재사용 | 디스크 I/O 제거, 정지 구간이 많은 광고에서 캡처 비용 절감 | HyperFrames `streamingEncoder.ts`, `frameCapture.ts` | `scripts/render.mjs` |
| 5 | 스냅샷 컨택트 시트와 픽셀 대조 | 에이전트 자기 검증 루프, 회귀 테스트 | HyperFrames `snapshot` | `scripts/render.mjs` 하위 명령 |

### 이 스택에서의 권장 구현

1번은 정적 검사부터 시작한다. 정규식 수준으로도 대부분 잡히고, 결과를 `LintFinding[]` JSON으로 내면 에이전트가 바로 쓴다. 런타임 멱등성 검사(같은 프레임 두 번 렌더 후 비교)는 `renderFrame`을 두 번 부르고 `document.getElementById('root').innerHTML` 해시를 비교하는 것으로 충분하다.

2번은 외부 의존 없이 지금의 CDP 코드를 함수로 감싸 N번 호출하는 방식이 가장 작다. Vite 서버는 하나를 공유하고, Chrome은 워커마다 임시 프로필을 따로 쓴다. 청크 출력은 같은 코덱 설정의 MP4 세그먼트로 만든다.

3번은 `TimelineContext`에 절대 오프셋을 추가하는 코어 변경이 먼저다. 그다음 렌더 모드 전용 레지스트리와 FFmpeg 필터 그래프를 붙인다. 미리보기 동기화는 마지막에 한다.

4번은 `spawn(ffmpeg, ['-f','image2pipe','-framerate',fps,'-i','-', ...])`로 바꾸고 `writeFile` 대신 `stdin.write`를 쓰는 작은 변경이다. 정적 재사용은 PNG 버퍼의 SHA-1 비교로 시작한다.

5번은 기존 캡처 경로를 재사용하고 FFmpeg `tile` 필터로 한 장에 합친다.

### Remotion에서 가져올 것과 피할 것

가져올 것은 공개 API 이름과 인자 형태(`renderMedia`의 `frameRange`, `concurrency`, `<Audio>`의 `volume`, `trimBefore`), 공개 문서에 적힌 운영 규칙(청크 길이 규칙, 깜빡임 네 가지 검사, 에셋 대기 원칙), 그리고 블랙박스 실행으로 얻은 입출력 쌍이다. 지금까지 해 온 방식 그대로다.

피할 것은 구현 파일 열람과 이식이다. 특히 `remotion`, `@remotion/renderer`, `@remotion/player`, `@remotion/cli`는 Remotion License, `@remotion/transitions`는 `UNLICENSED`이므로(법무 검토 문서) 동작을 맞추고 싶어도 문서와 블랙박스 관찰로만 맞춘다. `@remotion/paths`, `@remotion/shapes`처럼 MIT인 패키지도 패키지별 라이선스를 확인한 뒤에만 참고한다. 또한 "Remotion-like"를 자처하는 제3자 프로젝트(MotionForge (A) 등)의 코드는 출처가 불확실하므로 들여오지 않는다. 5.0 라이선스의 렌더링 서비스 운영 금지 조항은 Frameforge가 Remotion 코드를 쓰지 않는 한 직접 적용되지 않지만, 호스팅 서비스로 갈 때는 법무 검토를 다시 한다.

### 단계별 로드맵

MVP (현재 구조 유지, 의존성 추가 없음)
1. 독립 CLI는 검증됐다(2026-10-20). 이 단계는 끝났다.
2. 결정성 정적 린트와 JSON 출력. 완료(`npm run lint:video`, `--lint-only` 대신 별도 스크립트).
3. FFmpeg stdin 스트리밍 인코딩과 해시 기반 정적 프레임 재사용. 완료(`--pipe`, SHA-1 하드 링크).
4. 스냅샷 컨택트 시트. 완료(`--frames`).

확장 1 (속도와 소리)
5. `frameRange`, `concurrency`, concat 병합. 완료.
6. `TimelineContext` 절대 오프셋, `Audio` 클립 수집, `adelay`/`amix` 믹스(상수 볼륨). 2026-10-20 구현 완료.
7. 런타임 멱등성 검사(같은 프레임 이중 렌더 비교). 완료(`--check-idempotent`, PNG 바이트 비교).

확장 2 (에이전트 작업 흐름)
8. `variables` 선언과 스튜디오 컨트롤, CLI 입력 검증. 스튜디오 쪽은 완료(조정 탭, `overrides.json`).
9. Frameforge 전용 Agent Skill 문서(완료, `skills/frameforge-*`, `docs/plugin.md`): 결정성 규칙, 린트 코드표, 스냅샷 루프, MotionForge (B) 방식의 검사 가능한 연출 규칙.
10. 픽셀 대조(`--against`)로 회귀 테스트 자동화. 대조 도구는 완료(`scripts/snapshot-diff.mjs`).

확장 3 (선택)
11. `beginFrame` 캡처 실험과 측정.
12. Canvas 전용 장면을 위한 WebCodecs 경로(Revideo 방식). DOM 장면에는 적용할 수 없으므로 범위를 제한한다.
13. 외부 라이브러리 어댑터, 시간 마커, 비디오 프레임 추출. 비디오 프레임 추출과 Lottie 어댑터는 완료.

## 확인하지 못한 것

- HyperFrames의 AWS Lambda, Cloud Run, 클라우드 렌더 동작은 패키지 이름만 보았고 실행하거나 코드를 읽지 않았다.
- HyperFrames `beginFrame` 캡처가 Frameforge 환경(macOS, 시스템 Chrome)에서 동작하는지 시험하지 않았다.
- Motion Canvas 편집기의 시간 이벤트 UI는 `EditableTimeEvents.ts` 파일이 있다는 것만 확인했고 UI 코드는 읽지 않았다.
- Revideo 워커 분할의 경계 처리(`render.ts` 117행 부근의 오프셋)는 읽었으나 실행으로 검증하지 않았다. "실시간보다 빠름"은 문서 주장이며 측정하지 않았다.
- Remotion Lambda, Studio 내부, `@remotion/web-renderer`의 실제 성능은 문서만 읽었다.
- MotionForge (A)의 코드 출처(Remotion 이식 여부)는 확인하지 않았다. 다른 동명 저장소(`mayalhc/motionforge`, `danusempack/motionforge` 등)는 열지 않았다.
- VideoFlow, html-video, Diffusion Studio core는 열지 않았다. Theatre.js는 README의 라이선스 절만 읽었다.
