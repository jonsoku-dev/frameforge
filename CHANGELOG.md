# 변경 이력

이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

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
