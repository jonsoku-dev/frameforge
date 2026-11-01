# 변경 이력

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased]

### 제거

- 유료·키가 필요한 외부 서비스: ElevenLabs(효과음 생성, 음성), Recraft(벡터 그림), Suno(음악 스텁)와 환경 변수 `ELEVENLABS_API_KEY`, `RECRAFT_API_KEY`, `SUNO_API_KEY`. 효과음은 Openverse CC0 → 합성, 그림은 호스트 파일 → `FRAMEFORGE_IMAGE_COMMAND` → Openverse CC0 SVG → 키트, 음성은 kokoro → say → 무음 순입니다. 무료 서비스(Openverse, Google Fonts, Poly Haven, Natural Earth, whisper 모델)는 그대로입니다.

### 추가

- **전환 프레임 반복 검사** 전체 영상 렌더에 `--check-idempotent --idempotent-frames 0,30,120`을 지정하면 선택한 프레임을 두 번 캡처해 비교하고 결과에 실제 검사 목록을 기록합니다. MCP `render`에서는 `idempotent_frames`로 지정합니다. 기본 첫·중간·끝 세 프레임 검사는 그대로입니다. 검사하지 않은 프레임과 영상의 미적 품질은 이 검사로 검증되지 않습니다.
- **모션그래픽 상태와 피드백 설계** 제작 스킬과 에이전트·MCP 프롬프트가 사건 전후의 정보, 시선, 읽기 시간과 구체적 결함의 수정·재검토를 다룹니다. 의도된 정지와 미검증 재생·청취를 구분하며, 비교 근거는 `docs/research/motion-comparison-2026-10.md`에 기록합니다.

- **MCP 서버와 Claude·OpenAI 연결** `frameforge mcp`(`mcp/server.mjs`, stdio 기본, `--http`는 127.0.0.1 Streamable HTTP와 Host 검사): 도구 `project_init`, `film_new`, `film_list`, `film_files`(작품 폴더 밖 경로·심볼릭 링크 거부), `brief_check`, `lint`, `score`, `render`(진행 알림, 시간 제한), `contact_sheet`·`still`(PNG를 이미지로), `check`, `studio_start`/`studio_stop`, `read_skill`, 프롬프트 `make_motion_film`, `make_explainer`. Claude Code 플러그인의 `mcpServers`, `commands/`(make, check, studio), `agents/frameforge-maker.md`, Claude Desktop 확장 `mcpb/manifest.json`과 `npm run pack:mcpb`, Codex 플러그인의 `.codex-plugin/mcp.json`, 포터블 `mcp.json`, `examples/agents/openai-agents.py`. 의존성 `@modelcontextprotocol/sdk` 1.32.1, `zod` 4.6.6.
- **직접 만들기가 먼저** 모션 그래픽 작품(쇼릴, 아이덴트, 런칭, 프로모)은 자기 렌더링 코드를 쓴다. 런타임 `<Canvas2D draw>`(글꼴을 기다린 뒤 그림), `<ThreeCanvas>` 안의 `<Bloom>`, `rng(seed)` 난수열, 참고 `references/bespoke.md`. 블록, 키트, 프리셋은 부록 `references/utilities.md`. `references/showreel.md`는 기준과 자기 점검만 남겼다. 템플릿은 셰이더·캔버스·DOM 세 층의 시작점이고, 예전 설명 영상 패턴은 `examples/samples/explainer-patterns/`. 감사는 `aria-hidden`·`data-fx="ghost"` 복제 글자와 똑같은 글자 겹침을 세지 않고, 지적 기준이 0.3초(여백 밖 글자는 한 번에 이어서 0.3초)다.
- **Blender 3D 스킬과 스튜디오** 스킬 `frameforge-3d-modeling`, `-3d-materials`, `-3d-lighting`, `-3d-animation`, `-3d-review`. `3d.json`에 절차적 소프트박스 스튜디오, 속이 빈 병과 `subject.liquid`, 유리 `absorption`·`density`·`frost`, `view`(standard·agx·neutral), 리그 `three-point`·`product`·`rim`과 `light.ratio`, `subject.ops`, `subject.keys`, `motionBlur`, `scatter`, `denoise`, `radius`를 빼면 잘리지 않는 자동 프레이밍. 기본 `head`는 CC0 스캔 흉상(노멀 맵 유지, 오프라인이면 조각 흉상). `npm run blender -- <3d.json> --inspect`와 `--review`(여섯 방향 시트). Cycles PNG의 렌더 시간 텍스트 청크를 지워 같은 그림이 같은 바이트가 된다.
- **주인공 셰이더 프리셋** `shaders.planet`, `sun`, `sliced`(SDF 흉상·토러스 매듭·덩어리, 광택·주사선·와이어프레임, `u_orbit`, `u_mix`), `orbits`. 에셋 없이 빛을 받는 3D 주인공.
- **키네틱 글자 블록** `WordBeat`, `Thread`, `TextField`, `WhipPan`, `BauhausMosaic`, `Toggle`(`src/blocks/kinetic.tsx`)과 참고 `references/kinetic-type.md`.
- **검사** 감사 코드 `corner_hud`(영상 절반 넘게 모서리에 남는 작은 글자, `data-hud="allow"`로 허락). frame-check의 `featureless`(평평하거나 흐린 프레임 3연속)와 `end hold`(마지막 2초 motion share 0.5 미만).
- **컨셉 먼저** 만들기 규칙: Structure 앞에 `Concept:` 문단. `references/showreel.md`를 정해진 장면 목록에서 계열별 메뉴, 이름 붙인 팔레트 여덟, 계열 둘 이하 규칙으로 바꿨다.
- **셰이더** `<Shader frag width height uniforms palette seed>`(`src/packages/shader.tsx`)와 프리셋 `shaders.iris`, `tunnel`, `liquid`, `grainField`, `gradientMesh`, `streaks`, `cubeField`. WebGL2, 정수 해시, 컴파일 오류는 그 프레임의 오류.
- **후처리 이펙트** `<Glow>`, `<ChromaticShift>`, `<Scanlines>`, `<VhsGlitch>`, `<Extrude>`(`src/packages/post.tsx`).
- **키트 소품** `Bottle`(라벨, `tilt`, `bottleNeck`)과 `Glass`(`fill`, `liquid`, `ice`, `glassLevel`).
- **점수 자체 검사** `python3 scripts/assets/score.py --self-check`. 타격마다 트랜지언트와 앞뒤 덕킹, 생성 때 타격의 강조를 잰다.

### 고침

- 타격이 들리지 않음: 곡과 타격이 리미터 하나를 함께 지나 둘 다 같은 천장에 눌렸다(첨두 기준 0 dB). 곡은 천장에서, 타격 층은 그 위 4 dB까지 제한한다. 촘촘한 타격의 무게는 0.4 아래로 내려가지 않는다. 생성 때 타격이 앞 200ms보다 4 dB 이상 커야 한다. `GENERATION` v4.
- 템플릿의 장면 첫 등장이 컷보다 몇 프레임 먼저 시작해 컷 프레임이 비지 않는다.
- `blockMask`가 아래 0.4em, 좌우 0.3em 여유를 둔다(Bodoni Moda 이탤릭 j가 왼쪽으로 잘림). `Clipped text` 오류가 블록 이름과 고칠 방법을 말한다.
- score.py가 90 bpm, 18.667초에서 패드 꼬리가 자동화 곡선보다 길어 numpy 모양 오류로 멈추던 것.
- 렌더 감사가 3D에서 불투명 카드 뒤에 가려진 글자를 `text_overlap`으로 세던 것.

- **보조 움직임과 흐름** `drift`, `breathe`(`src/packages/ambient.ts`), `<Stream>`/`streamPath`(`src/packages/stream.tsx`), 모두 `frameforge`에서 가져옵니다.
- **감사** `element_cropped`(`data-subject` 요소가 프레임 밖으로 2% 넘게 나감), `subject_overlaps_text`(주인공이 글자를 20% 넘게 가림).
- **블록 카탈로그** `src/blocks/`(`@/blocks`): 글자 6, 로어서드 6변형, 카드 6, 차트 6, 코드 블록(4모드), 다이어그램 4. 공통 prop 계약, 모션 프로브, `CATALOG`. 샘플 `blocks-reel`, `data-reel`. 스킬 `frameforge-blocks`.
- **이음새** `src/packages/seams.tsx`(`cutTheCurve`, `zoomThrough`, `inverseZoom`, `rackFocus`, `waterfallCut`, `waterfallEntry`, `nudge`, `<Seam>`)와 `scripts/seam-check.mjs`(렌더가 쓰는 `<out>.motion.json`에서 이음새 벡터를 재어 `seam_mirrored_vector`, `seam_axis_swap`, `seam_dead_beat`, `seam_speed_mismatch`, `seam_pingpong`). 독트린 `references/seams.md`. 샘플 `seam-reel`.
- **나레이션** `scripts/assets/voice.py`(ElevenLabs, kokoro-onnx, macOS `say`, 길이 추정 무음 순, 줄별 해시 캐시, `narration.timing.json`), `useNarration`, `<Voiceover>`, `<Subtitles>`(rail/embed), `<Formula>`(KaTeX), `scripts/narration-check.mjs`. 렌더러와 개발 서버가 `narration.json`이 있으면 음성을 만들고, 믹스에서 음악이 음성 아래로 내려갑니다. 자막 독트린 `references/captions.md`. 샘플 `narrated-explainer`. 스킬 `frameforge-voice`.
- **3D** `scripts/assets/blender.py`와 `blender_scene.py`(`3d.json` 샷을 헤드리스 Blender로 결정적 PNG 시퀀스 렌더), `scripts/assets/models.py`(Poly Haven CC0 모델·HDRI, `models.lock.json`), `<ImageSequence>`, `<Model>`, `<Turntable>`, `<StudioLights>`. 샘플 `turntable-spot`. 스킬 `frameforge-3d`.
- **생성 배경과 효과** `<Generative>`와 시스템 9종, 효과 `colorCorrectionEffect`, `lutEffect`(.cube), `lightLeakEffect`, `vignetteEffect`, `grainEffect`, 손그림 주석 `Highlight`, `Encircle`, `Underline`, `StrikeThrough`, `Box`, `Bracket`. 샘플 `generative-ident`. 스킬 `frameforge-generative`.
- **렌더러 출력** `.webm`(VP9, 알파), `.mov`(ProRes 4444, 알파), `.gif`, PNG 시퀀스, `--transparent`, `--scale`, `--crf`, `--codec`, `--audio-codec`, `--muted`, `--strict-audit`. 렌더마다 `<out>.motion.json`(움직임 기록)을 남깁니다.
- **감사와 도구** 스튜디오 `audit()`가 `text_outside_safe`, `text_overlap`, `contrast_low`, `text_too_small`을 보고하고 렌더 로그에 `audit` 줄로 찍힙니다. `beatGrid`/`beatsFromSpec`/`loadBeats`와 `scripts/assets/beats.py`, `scripts/silence-detect.mjs`, `frameforge check`의 네 검사 표(frame, flash, seam, narration).
- **지도 블록** `MapOutline`, `RouteMap`, `Markers`(`src/blocks/maps.tsx`)와 `scripts/assets/geo.py`(Natural Earth 공개 데이터, 필터, 단순화, `geo.lock.json`). 샘플 `map-story`.
- **HLS 출력** `.m3u8`(h264/aac, 4초 조각). **음성 전사** `scripts/transcribe.mjs`(whisper.cpp, 한국어 포함, SRT와 Caption JSON). **외부 애니메이션 어댑터** `<Seekable>`, `useSeekable`(Web Animations나 seek 어댑터를 프레임으로 구동).
- 두 차례 교차 리뷰 뒤 손본 것: Blender 스크립트 피사체(머그, 타일), 오로라 곡선 경계, 자막 한 판, `<Seam>` 배경 bleed.
- 조사 기록 `docs/research/motion-tools-absorption.md`(에이전트용 영상 도구 다섯 가지의 REA 증거와 흡수 방식). 의존성 `katex`(devDependencies).

### 바뀜

- **프레임 검사 무결성** 잘못된 FPS나 비교할 프레임을 두 장 미만 남기는 명시적 hold, FFmpeg가 감지한 디코딩 오류를 통과로 보고하지 않습니다. 기본 hold가 영상보다 긴 짧은 영상은 전체 프레임을 분석합니다.
- **경계 검사 상태** `frameforge check`는 측정되지 않은 경계를 PASS로 묶지 않고 WARN 또는 SKIP과 이유를 표시합니다. 실제 측정 오류는 FAIL이며 기존 frame-check 기준은 바꾸지 않습니다. MCP `check`의 `pass`는 모든 행이 PASS일 때만 true이고, 오류가 없는 WARN·SKIP을 포함한 실행은 `noFailures: true`로 구분합니다.
- **frame-check** 기본 끝 정지가 2초에서 1초로 줄었습니다(`--hold`). 0.5초 전 프레임과 비교해 얼어붙은 구간이 1초를 넘으면 실패하고, `motion share`를 출력합니다. 옛 정지 지표(앞 프레임과 비교, 4초 기준 실패)는 출력만 합니다. 예전 규칙으로 만든 샘플 렌더는 이 기준에서 실패합니다(`docs/research/benchmark-loop.md`).
- **글자 블록** `GlyphRise` 기본이 단어 단위(`by="word"`, `stagger` 1, `rise` 8), `Typewriter` 기본이 단어 단위(`by="word"`, `speed` 4)입니다. 글자 단위는 `by="glyph"`.
- **규칙** 모든 숏에 보조 움직임, 글자의 중간 상태 금지(스크램블 금지), 과정 영상의 원인과 결과 동시 표시, 이유를 적은 질감 도구(글로우나 비네트 하나, 그레인, 하프톤, 두 번째 그라데이션, 목적 있는 파티클, HUD 글자) 허용.
- 스튜디오와 `npm run render`, `__VIDEO_ENTRY__`의 기본 진입점이 `examples/samples/index.tsx`입니다. 렌더러의 기본 컴포지션은 `KitLaunch`입니다.
- `art.py`가 모티프 키트 목록을 `src/assets/catalog.ts`에서만 읽습니다. 읽지 못하면(엔진에 `npm install`이 없을 때) 고정 목록으로 대신하지 않고 실패합니다.
- 효과음 밀도 검사(0.5초 간격, 4초에 셋까지)는 MP4 렌더에서 늘 켜져 있습니다.
- `verification.json`과 `docs/reference/verification.md`는 지금 저장소 상태만 적습니다.

### 제거

- 처음 데모 진입점 `examples/index.tsx`와 `examples/Opening.tsx`, 쓰지 않던 `tests/fixtures/entry.tsx`.
- 제3자 호환 데모 `examples/community/`와 `community-compatibility.json`, `THIRD_PARTY_NOTICES.md`의 해당 절.
- 외부 글 요약 `docs/references/opus-5-5/`.
- 비교 실험 작품 `cmp-motion-*` 아홉 편과 플러그인 시험 작품 `plugin-smoke-claude`, `plugin-smoke-codex`, 그리고 `docs/samples/compare.md`, `plan.md`, `reviews/`, `docs/studio/process-log.md`. 비교 결과는 `docs/guides/model-playbook.md`에 두 문장으로 남겼습니다.
- 지금 규칙 이전에 만든 작품 열네 편(saas-launch, kinetic-typo, data-story, event-teaser, app-onboarding, logo-reveal, podcast-promo, education-explainer, countdown-hype, product-feature, recipe-steps, fitness-timer, travel-poster, weather-brief). 스튜디오 테스트가 읽던 기획서는 `tests/fixtures/`로 옮겼습니다.
- `FRAMEFORGE_SFX_GUARD=off` 탈출구, `examples/<slug>.audio.json` 사양 위치, `GENERATION` 이관 메모, 쓰지 않던 `src/components/magicui/magic-card.tsx`.
- 커밋돼 있던 `scripts/assets/__pycache__/`. `.gitignore`에 `__pycache__/`와 `*.pyc`를 넣었습니다.

## [0.1.0] - 2026-10-20

첫 공개 버전입니다. 부분 호환 프로토타입입니다. 아래 수치는 저장소 루트 `verification.json`의 기록입니다.

### 추가

- **코어 API.** `Composition`, `Folder`, `Still`, `Sequence`(`playbackRate`, `trimBefore`, `freeze`), `Series`, `Loop`, `Freeze`, `AbsoluteFill`, `Img`, `staticFile`, `interpolate`, `interpolateColors`, `spring`, `measureSpring`, `Easing`, `random`, `delayRender` 계열, `calculateMetadata`, `getInputProps`, `googleFont`. 수학 함수는 기준 패키지 4.0.537 실행값과 `1e-6` 안에서 맞습니다(`compatibility-benchmark.json`).
- **미디어.** `Audio`, `Video`, `OffthreadVideo`(FFmpeg 프레임 추출), `AnimatedImage`(`ImageDecoder`), `Solid`, `CanvasImage`, `HtmlInCanvas`, `createEffect`, `Artifact`, `Track`, `Interactive`, `IFrame`.
- **패키지.** 전환(`TransitionSeries`, fade, slide, wipe, flip, clockWipe, iris), 플레이어(`Player`, `Thumbnail`), 경로, 도형, 노이즈, 모션 블러, 변형과 스타일 보간, 자막(SRT, VTT, TikTok식 묶기), 레이아웃 측정, 오디오·영상 유틸, 글꼴 로드, zod 스키마 도우미, 미리 불러오기, `ThreeCanvas`, `Lottie`. 패키지 오라클 1만 3천여 건과 비교합니다.
- **렌더러.** `scripts/render.mjs`. Node 내장 `WebSocket`으로 Chrome DevTools Protocol에 붙어 PNG를 찍고 FFmpeg로 H.264(bt709 태그)와 AAC 48 kHz를 만듭니다. `--frames` 컨택트 시트, `--frame-range`, `--concurrency`(병렬 청크), `--pipe`, `--check-idempotent`.
- **스튜디오 2.0.** 컴포지션 레일, 안전 영역 오버레이, 기획·과정·조정·출력 탭, 장면·소리·검사·과정 타임라인, 렌더 큐와 결과 카드. 서버 API는 loopback 전용입니다.
- **소리.** 작품별 `audio.json`에서 음악을 합성(`score.py`), 효과음 해결(ElevenLabs 생성, Openverse CC0, 합성 순), 움직임에서 효과음 시점 뽑기(`useMotionSound`, `MotionProbe`, `MotionSound`), 사이드체인 덕킹, 효과음 밀도 가드.
- **에셋.** 44종 파라미터 모티프 키트(`src/assets/`), `assets.json` 해결기(`art.py`: 호스트 파일, 이미지 명령, Recraft, Openverse CC0 SVG, 키트), SVG 정리와 팔레트 재채색, `<Art>`.
- **검사.** 글자 잘림 가드(렌더 실패, 스튜디오 표시), 결정성 린트(`npm run lint:video`), `frame-check`(빈 화면, 정지, 몰림, 작은 요소), `flash-check`(방송 플래시 지침 근사), `snapshot-diff`(PSNR), `score-report.py`(음량).
- **CLI.** `bin/frameforge.mjs`(`init`, `new`, `studio`, `render`, `score`, `art`, `lint`, `check`)로 저장소 밖 프로젝트에서 작품을 만듭니다.
- **에이전트 플러그인.** 스킬 7개와 Claude Code, Codex 매니페스트, 마켓플레이스 파일. `npm run skill:install`, `npm run skill:uninstall`.
- **문서.** 설치, 제거, 에이전트 설치 프롬프트, 수동 설치, API·스튜디오·렌더링·검사 레퍼런스, 기여 안내, 보안 정책, 제3자 고지.

### 알려진 한계

- 기존 Remotion 프로젝트를 수정 없이 실행하거나 픽셀 단위로 같은 출력을 낸다는 검증은 하지 않았습니다.
- 음악 생성 공급자 `elevenlabs`, `suno`는 스텁입니다.
- 생성된 음악, 에셋, 캐시는 밖 프로젝트에서도 엔진 저장소에 쌓입니다.
- npm 레지스트리에는 배포하지 않았습니다.
