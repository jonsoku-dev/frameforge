# 모션그래픽 에이전트 도구 다섯 가지의 흡수 보고 (2026-10-24)

사용자 요구: 코딩 에이전트용 영상 도구 다섯 가지(HTML 프레임 렌더러와 그 스킬 묶음, 기준 엔진의 공식 Agent Skills, Blender용 MCP, 수학 애니메이션 스킬, 제너레이티브 아트 스킬)를 REA로 분석해 그 기능을 Frameforge에 들인다. 이 문서는 분석 대상과 증거, 라이선스 경계, 기능 대조표, 흡수 방식, 검증 기록이다. 다른 연구 문서와 같은 규칙으로 쓴다. "관찰"은 파일을 열어 확인한 사실, "추론"은 그로부터 끌어낸 판단이다. 제품 코드·API·스킬·브리프에는 이들 도구의 이름이 들어가지 않는다([docs/legal/](../legal/)과 `CONTRIBUTING.md`의 독립 구현 규칙).

## 1. 분석 대상과 REA 증거

모두 2026-10-24에 shallow clone으로 받았다. REA는 `analyze_javascript_application`으로 디렉터리 전체의 인벤토리 식별자(루트 sha256)를 만들고 JavaScript/TypeScript 원본만 구문 그래프로 파싱한다. Python과 Markdown은 인벤토리에만 잡힌다(REA의 한계 기록: "JavaScript and HTML were parsed as inert text"). 증거 번들은 세션 스크래치에 내보냈다(10개 레코드, 178,814,169바이트). `verification.json`의 `rea.motion_tools`에 같은 값이 있다.

| 대상 | 커밋 | 라이선스(관찰) | 루트 sha256 | 상위 증거 ID | REA가 파싱한 것 |
| --- | --- | --- | --- | --- | --- |
| HTML 프레임 렌더러 모노레포 (`heygen-com/hyperframes`) | `cf7266d81586` | Apache-2.0 (`LICENSE`) | `789673d94a2637bfd15e46377dbb49c3a54b30aac21ada58d857364de3dad7a8` | `ev_a4b5bd32e3b89ba8ef0e1f522b1a75a7d7106b456852a6664e4e8dc36451fe65` | 선택한 12개 파일(어댑터 타입, 린트 규칙 5개, CLI 명령 6개), 51,158 AST 노드, 586 findings. 나머지 6,784개 파일은 인벤토리만 |
| 기준 엔진 Agent Skills (`remotion-dev/skills` 4.0.538) | `6c67adcd9cdb` | 라이선스 파일 없음(관찰: `package.json`에 `license` 필드 없음) | `551f80b5ceafcaadfc7fdb9ed097c7d16ac5c653f57fc93be401104f83c756e9` | `ev_15a84bfcfdb8e8bcc0728a71b25722d58f6bf15cdb4da190e4eaea5002ae171a` | 45개 JS/TSX 파일(지도 기법의 예제 코드와 스크립트). 이 코드는 참고하지 않았고 Markdown 지침만 공개 문서로 읽었다 |
| Blender용 MCP (`ahujasid/blender-mcp`, PyPI `mcp-for-blender`) | `5a3618fccb2d` | MIT (`LICENSE`), 별도 `TERMS_AND_CONDITIONS.md`에 텔레메트리 조항 | `81b66cd7e61ac04c3862b4b8c8f3fe8e07836c9f370d4d52807d223199542543` | `ev_8ccfb91292402f3d1c5257e262a0cf2615da79e51028e33811407188de0f6dbe` | JS 없음(뷰포트 HTML의 인라인 스크립트 1개는 미분석). 도구 표면은 `src/blender_mcp/server.py`의 `@mcp.tool` 데코레이터를 grep해 읽었다 |
| 수학 애니메이션 스킬 (`Yusuke710/manim-skill`) | `a0048d9e2654` | MIT | `bdacdb1282b2c84247e33337744eadfcafad6f5ed08968af956c080242823bc0` | `ev_be02c32958c1ed1acf50b7540e12a1a1f33e3c952fe0ca25df55fe0d28dfa8c3` | JS 없음(뷰어 HTML 인라인 스크립트 미분석). `SKILL.md`와 `tools/README.md`를 읽었다 |
| 제너레이티브 아트 스킬 (`anthropics/skills` 중 `algorithmic-art`) | `dbd4588f9e10` | Apache-2.0 (`skills/algorithmic-art/LICENSE.txt`) | `17de4ae72b4455325bf369ba8815a569dd0d52fbb7d9bd90bafd2b1aa3d28025` | `ev_5ea5c88b986dea5e0e83c7b3087171a642330cca9b3c755543571186566b4fc7` | `templates/generator_template.js` 1개(269 AST 노드). `SKILL.md`의 작업 순서만 참고 |

## 2. 라이선스 경계와 흡수 방식

- Apache-2.0(HTML 프레임 렌더러, 제너레이티브 아트 스킬): 읽고 패턴을 독립 구현한다. 코드를 옮기지 않았으므로 고지 의무가 생기지 않는다. 옮길 일이 생기면 `THIRD_PARTY_NOTICES.md`에 Apache 고지를 함께 싣는다.
- 기준 엔진 Agent Skills: 라이선스 선언이 없어 Markdown 지침을 공개 문서로만 읽었다(`docs/legal/remotion-license-review.md`의 허용 범위: 공개 문서). 지도 기법의 `.tsx` 예제 코드와 스크립트는 열지 않았고 옮기지 않았다.
- MIT(Blender용 MCP, 수학 애니메이션 스킬): 아이디어만 가져왔다. 코드를 옮기지 않았다. Blender용 MCP의 텔레메트리와 유료 생성 모델 연동은 가져오지 않는다.
- 공통: Frameforge에는 MCP 서버를 두지 않는다(2026-10-20 결정). 모든 기능은 Spot 옆의 JSON 사양과 멱등한 스크립트, React 컴포넌트, 검사 스크립트로 들어온다.

## 3. 기능 대조표

"있음"은 2026-10-24 착수 시점의 Frameforge 상태, "흡수"는 이번 작업으로 들어온 것(구현 파일은 4절).

### 3.1 HTML 프레임 렌더러와 그 스킬 묶음

| 기능(관찰) | 착수 시점 | 흡수 |
| --- | --- | --- |
| 결정성 린트, 기계 판독 코드(`css_transition_used` 등 130여 개) | 있음(`scripts/lint.mjs`, 코드 4종) | 린트 범위는 유지. 스튜디오 감사에 `text_outside_safe` `text_overlap` `contrast_low` `text_too_small` 추가 |
| 스냅샷 시트, `--against` 대조 | 있음 | 유지 |
| 병렬·스트리밍 렌더, 정지 프레임 재사용 | 있음 | 유지 |
| 출력 컨테이너: mp4, webm(VP9 알파), mov(ProRes 4444), png 시퀀스, hls | mp4만 | webm(VP9, 알파), mov(ProRes 4444, 알파), gif, png 시퀀스, `--transparent` `--crf` `--scale` `--muted`. hls는 범위 밖 |
| 블록 카탈로그 약 210개(로어서드, 코드, 차트, 지도, 배경, 전환, VFX, 카드) | 모티프 키트 44종, 도형 11종, 전환 6종 | `src/blocks/` 카탈로그: 텍스트 6, 로어서드 1×6변형, 카드 6, 차트 6, 코드 1×4모드, 다이어그램 4. 배경은 `generative`로. 지도 블록은 지리 데이터가 필요해 보류 |
| 모션 독트린(벡터 법칙, 하나의 흐름 방향, 속도 맞춘 이음새, 중간 동작에서 컷, 이음새 게이트) | 모션 가족 셋 규칙만 | `references/seams.md`(독트린), `src/packages/seams.tsx`(이음새 곡선), `scripts/seam-check.mjs`(렌더가 남긴 `*.motion.json`에서 이음새 벡터를 재서 `seam_mirrored_vector` 등으로 보고) |
| 자막 오버레이 모델(drop/rail/embed) | SRT 파싱만 | `references/captions.md`, `<Subtitles style="rail"|"embed">` |
| CLI 자기 검증: `beats`, `tts`, `transcribe`, `contrast-*`, `layout`, `check` | frame-check, flash-check, 음량 보고 | `src/packages/beats.ts` + `scripts/assets/beats.py`, `scripts/assets/voice.py`, 스튜디오 감사의 대비·레이아웃, `frameforge check` 통합(frame, flash, seam, narration). 전사(transcribe)는 whisper 실행 파일이 없어 보류 |
| 외부 애니메이션 라이브러리 어댑터(seek 계약) | Lottie 어댑터만 | 보류(React 프레임 함수가 같은 역할). 이유는 `video-engine-landscape.md` 4.8 |

### 3.2 기준 엔진 Agent Skills(문서만)

| 주제 파일(관찰) | 착수 시점 | 흡수 |
| --- | --- | --- |
| text-highlights(손그림 주석: 하이라이트, 원, 밑줄, 상자, 괄호) | 없음 | `src/packages/annotations.tsx` 6종, 시드 거칠기, DOM 측정 없이 백분율 좌표 |
| light-leaks, effects, color-correction(노출·색온도·대비·채도·LUT) | blur, colorMatrix | `colorCorrectionEffect` `lutEffect`(.cube) `lightLeakEffect` `vignetteEffect` `grainEffect` |
| voiceover(TTS → 길이 측정 → 컴포지션 길이 계산) | 없음 | `narration.json` → `voice.py` → `narration.timing.json` → `useNarration` |
| captions(전사, SRT, 표시) | 파싱·직렬화 | `<Subtitles>`, `captionsFromTiming` → SRT |
| silence-detection | 없음 | `scripts/silence-detect.mjs` |
| audio-visualization | 있음(`visualizeAudio`) | 유지 |
| maps | 없음 | 보류(지리 데이터 공급원 미정) |
| video-editing(Track), multi-scene, calculate-metadata | 있음 | 유지 |

### 3.3 Blender용 MCP

| 도구 표면(관찰, `server.py`) | 흡수 |
| --- | --- |
| `get_scene_info`, `execute_blender_code`, `look`(뷰포트 캡처) | 소켓 대신 파일: `3d.json` 사양 → `blender -b --python`으로 결정적 PNG 시퀀스 렌더(`scripts/assets/blender.py`, `blender_scene.py`), `<ImageSequence>`로 재생. 사용자 스크립트는 `subject.kind: "script"` |
| `search_assets`, `import_asset`(Poly Haven, Sketchfab, Poly Pizza) | Poly Haven CC0만(`scripts/assets/models.py`, 키 불필요, `models.lock.json`에 출처와 라이선스 고정). Sketchfab과 Poly Pizza는 키·약관 때문에 보류 |
| `generate_3d`(유료 생성 모델) | 가져오지 않음 |
| 텔레메트리, 궤적 기록 | 가져오지 않음 |
| 뷰포트 반복 확인 | 콘택트 시트와 스튜디오로 대신 |

### 3.4 수학 애니메이션 스킬

| 단계(관찰, `SKILL.md`) | 흡수 |
| --- | --- |
| 나레이션 먼저 → 로컬 TTS → 길이 측정 → 코드가 측정값을 시간 예산으로 사용 | 같은 순서. 공급자 계층: ElevenLabs(키) → kokoro-onnx(en/ja) → macOS `say`(ko 포함) → 길이 추정 무음. 이 기계에서는 `say`가 한국어를 낸다 |
| 장면당 `add_subcaption`과 자막 린트(겹침, 넘침) | `<Subtitles>`와 `scripts/narration-check.mjs` |
| 수식 `MathTex` | `<Formula tex draw>`(KaTeX, MIT, devDependency) |
| 뷰어의 타임스탬프 캡처 피드백 | 스튜디오의 변경 요청(프레임 고정, C 키)이 같은 역할. 추가 구현 없음 |
| 세션 폴더 격리 | 생성물은 이미 `public/*/generated/<slug>/`로 격리됨 |

### 3.5 제너레이티브 아트 스킬

| 요소(관찰) | 흡수 |
| --- | --- |
| 알고리즘 철학을 먼저 쓴 뒤 코드로 표현 | `skills/frameforge-generative/SKILL.md`의 첫 단계(prompt.md 머리에 선언문) |
| 시드 난수, 파라미터 객체, 뷰어 슬라이더 | `<Generative seed params>`, 시스템별 파라미터 스키마 → 스튜디오 조정 탭 변수 |
| 흐름장, 입자, 노이즈 필드 | `flowField` `particles` `starfield` `meshGradient` `halftone` `ripples` `voronoi` `noiseLines` `aurora`, 모두 프레임의 순수 함수 |
| 인터랙티브 HTML 출력 | 영상 프레임으로 바꿈. 프레임 사이 상태 누적 없음 |

## 4. 구현 파일과 검증

작업은 2026-10-24에 일곱 작업 흐름으로 나눠 병렬로 진행했다. 소유 파일과 검증은 각 참조 문서에 있다: `docs/reference/blocks-text.md`, `blocks-data.md`, `seams.md`, `voice.md`, `three-d.md`, `effects.md`, `generative.md`, `tooling.md`. 통합 검증 결과(타입 검사, 테스트 수, 벤치마크, 샘플 렌더와 frame-check)는 `verification.json`과 `CHANGELOG.md`에 적는다.

## 5. 확인하지 못한 것

- HTML 프레임 렌더러의 블록 카탈로그 210개 중 블록별 구현은 열지 않았다(제목 목록만). 흡수한 블록은 제목이 가리키는 기능을 독립 구현한 것이다.
- 기준 엔진 Agent Skills의 라이선스는 저장소에 선언이 없어 모노레포의 라이선스를 따를 가능성이 있다. 그래서 Markdown도 인용하지 않고 주제 목록만 썼다.
- Blender용 MCP의 Python 코드는 REA가 파싱하지 않았다. 도구 표면은 grep으로 읽은 데코레이터 목록이다.
- kokoro-onnx와 ElevenLabs 공급자는 이 기계에서 실행하지 않았다(패키지 미설치, 키 없음). `say`와 무음 추정만 실행했다.
