# 변경 이력

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased]

### 제거

- 유료·키가 필요한 외부 서비스: ElevenLabs(효과음 생성, 음성), Recraft(벡터 그림), Suno(음악 스텁)와 환경 변수 `ELEVENLABS_API_KEY`, `RECRAFT_API_KEY`, `SUNO_API_KEY`. 효과음은 Openverse CC0 → 합성, 그림은 호스트 파일 → `FRAMEFORGE_IMAGE_COMMAND` → Openverse CC0 SVG → 키트, 음성은 kokoro → say → 무음 순입니다. 무료 서비스(Openverse, Google Fonts, Poly Haven, Natural Earth, whisper 모델)는 그대로입니다.

### 추가

- **검증 장면에서 전체 편집으로 연결** 제작 에이전트·make·MCP 지침이 짧은 장면 검증을 중간 단계로 구분하고, 원본 프레임과 전체 시간축 매핑, 장면 사이 물체·보상 상태, 전체 음악의 효과음 위치와 실제 소스 해상도를 확인하도록 안내합니다. 짧은 검증본의 성공을 전체 영상 완성으로 보고하지 않습니다.
- **부분 렌더 오디오 스냅샷** POSIX에서 이미 준비한 프로젝트 내 PCM WAV 전체 믹스와 명시적 매니페스트로 부분 렌더의 음향을 잘라 쓸 수 있습니다. 추가적인 범위 밖 React 프레임 평가와 자동 생성 preflight를 실행하지 않으며, 선택된 WAV 전체는 해시 검증을 위해 읽습니다. 스냅샷과 현재 소스의 의미적 일치, 지각적 음향 품질과 완전한 오프라인 실행은 보장하지 않습니다.
- **저장 영상 프레임 관찰** MCP `video_frames`가 프로젝트의 MP4에서 선택 프레임과 실제 타임스탬프·파일 SHA-256을 반환합니다. POSIX 전용이며 정지 프레임 관찰은 정상 속도 재생이나 청취가 아닙니다. `render.frame_range` 스키마도 두 정수 배열로 호환성을 개선합니다.
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

- **프로젝트 이미지 경로** 외부 프로젝트 `public/`의 PNG·JPEG·WebP·AVIF URL이 엔진 디렉터리로 빠져 이미지 로딩에 실패하던 문제를 수정합니다. 기존 프로젝트 경로·심볼릭 링크 검사와 공용 생성 오디오 보호는 유지합니다.

- **외부 프로젝트 오디오 보호** 같은 slug의 프로젝트가 엔진의 공용 생성 오디오를 덮어쓰거나 다른 프로젝트의 파일을 읽을 수 있어, 프로젝트별 생성이 구현될 때까지 외부 프로젝트의 공용 생성 오디오 쓰기·표준 서빙·믹싱을 차단합니다. 외부 `audio.json`·`narration.json`의 일반 렌더 preflight도 실패합니다. 명시적으로 준비한 프로젝트 `public/`의 비생성 미디어는 사용 가능하며, 동명 엔진 미디어보다 우선합니다. 이미지·3D 생성 경로, 임의 사용자 코드 및 운영체제 전체 접근은 이 보호 범위가 아닙니다.
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

- **행위와 연속성 구분** 물체의 경로가 연속이라는 사실과 캐릭터가 실제로 운반·삽입했다는 증거를 구분합니다. 손의 지지·밀기·해제와 최종 카메라에서의 반응 대상을 실제 저장 구간으로 확인하도록 제작 지침을 보강했습니다.

- **3D 제작 지침 정렬** builtin 우선순위·일률적 크롭 금지·고정 끝 정지·수정 횟수 종료 기준을 실제 장면 목적과 관찰 근거에 맞게 정리했습니다. 직접 제작한 자산과 로컬 장면을 허용하고, 실제 타이포·환경을 합친 대표 화면과 짧은 동작을 먼저 평가합니다. 3D 사용이나 기술 수치만으로 시각 품질을 통과시키지 않습니다.

- **동작 연속성과 글자 진단** 제작 경로가 접촉·물체 소유·몸의 반응·완료 상태를 실제 시퀀스로 대조하도록 구체화됐습니다. `text_overlap` 메시지는 실제 잉크 가림이 아닌 DOM 경계 상자 겹침임을 명시하며, 검사 기준과 진단 상태는 유지합니다.

- **대표 장면부터 제작** 모션 스킬·MCP 프롬프트·maker·make 명령이 실제 자산·타이포·조명이 있는 대표 장면과 핵심 동작을 먼저 관찰하고 수정하도록 연결됩니다. 일률적인 도형·색상 수, 매체 제한과 진단 통과용 움직임 지침을 정리했습니다. 이는 제작 절차 개선이며 전문 품질이나 사용자 수락을 보장하지 않습니다.
- **엔터테인먼트 제작 검토** 모션 스킬이 보상의 목표·조건·작은 화면 정보 계층과 음악 장면의 박자·시각적 연결을 브리프에 맞게 검토하도록 안내합니다. 게임·뮤직 로컬 실험과 실제 관찰 한계는 `docs/research/entertainment-validation-2026-11.md`에 기록합니다.
- **작품 수정과 결과 비평** MCP 제작 프롬프트와 스킬이 기존 작품의 브리프·이력·음향을 읽고 최신 명시 지시를 반영해 필요한 파일만 수정하도록 안내합니다. 기준과 후보의 대응 사건을 실제 저장 영상에서 비교하고, 구체적 차이를 수정한 뒤 같은 구간을 재검토합니다. 부분 MCP 렌더는 요청한 구성 프레임 범위를 반환하며, 정지 이미지 렌더의 사전 생성과 네트워크 부작용은 프레임 선택만으로 제한되지 않습니다. 새 세션 에이전트의 자율 결과나 창작 품질 동등성은 이 지침만으로 보장하지 않습니다.
- **부분 오디오 문맥과 MCP 취소** 스냅샷 없는 부분 렌더의 범위 밖 오디오 문맥은 `NOT_VERIFIED`로 표시합니다. POSIX MCP 취소는 요청별 프로세스 그룹에 신호를 보내며, CLI 렌더러는 SIGTERM을 받으면 자신이 추적 중인 Chrome의 종료를 시도합니다. 렌더러 강제 종료·별도 세션 자손·Chrome 보조 프로세스와 Windows의 완전한 정리는 보장하지 않습니다.
- **모션 효과음 길이** 렌더러가 `FFPROBE_PATH`를 따르며 길이를 확인하지 못할 때 임의로 1초로 대체하지 않고 오류를 보고합니다. 명시적 전체 믹스 스냅샷이 없는 부분 렌더에서는 시작 전의 모션 효과음 꼬리가 빠질 수 있습니다.
- **긴 모션 음향 시퀀스** 많은 모션 표본의 최솟값·최댓값을 순회로 계산해 JavaScript 함수 인자 한도로 실패하는 문제를 고쳤습니다. 실제 장시간 영상 전체 렌더의 성능을 보증하는 것은 아닙니다.
- **프레임 검사 무결성** 잘못된 FPS나 비교할 프레임을 두 장 미만 남기는 명시적 hold, FFmpeg가 감지한 디코딩 오류를 통과로 보고하지 않습니다. 기본 hold가 영상보다 긴 짧은 영상은 전체 프레임을 분석합니다.
- **경계 검사 상태** `frameforge check`는 측정되지 않은 경계를 PASS로 묶지 않고 WARN 또는 SKIP과 이유를 표시합니다. 실제 측정 오류는 FAIL이며 기존 frame-check 기준은 바꾸지 않습니다. MCP `check`의 `pass`는 모든 행이 PASS일 때만 true이고, 오류가 없는 WARN·SKIP을 포함한 실행은 `noFailures: true`로 구분합니다.
- **frame-check** 기본 끝 정지가 2초에서 1초로 줄었습니다(`--hold`). 0.5초 전 프레임과 비교해 얼어붙은 구간이 1초를 넘으면 실패하고, `motion share`를 출력합니다. 옛 정지 지표(앞 프레임과 비교, 4초 기준 실패)는 출력만 합니다. 예전 규칙으로 만든 샘플 렌더는 이 기준에서 실패합니다(`docs/research/benchmark-loop.md`).
- **글자 블록** `GlyphRise` 기본이 단어 단위(`by="word"`, `stagger` 1, `rise` 8), `Typewriter` 기본이 단어 단위(`by="word"`, `speed` 4)입니다. 글자 단위는 `by="glyph"`.
- **규칙 정렬** 의도된 읽기 홀드와 과정의 인과를 유지하고, 보조 움직임·타이포 등장·질감은 장면의 목적과 실제 관찰에 따라 선택합니다. 기술 진단 결과는 창작 판단과 별도로 보고합니다.
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
