# 변경 이력

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased]

### 제거

- 유료·키가 필요한 외부 서비스: ElevenLabs(효과음 생성, 음성), Recraft(벡터 그림), Suno(음악 스텁)와 환경 변수 `ELEVENLABS_API_KEY`, `RECRAFT_API_KEY`, `SUNO_API_KEY`. 효과음은 Openverse CC0 → 합성, 그림은 호스트 파일 → `FRAMEFORGE_IMAGE_COMMAND` → Openverse CC0 SVG → 키트, 음성은 kokoro → say → 무음 순입니다. 무료 서비스(Openverse, Google Fonts, Poly Haven, Natural Earth, whisper 모델)는 그대로입니다.

### 추가

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
