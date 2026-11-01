# Frameforge를 에이전트 플러그인으로 쓰기 (2026-10-20)

Frameforge는 저장소 자체가 포터블 에이전트 플러그인이다. 기준 엔진이 하는 방식(공식 문서 `docs/ai/claude-code-plugin`, `docs/ai/codex-plugin`, 모노레포 `packages/agent-plugin`·`claude-code-plugin`의 공개 매니페스트)을 그대로 따랐다: 루트 `plugin.json`(agent-plugins.org 스키마) + `skills/<이름>/SKILL.md` + 호스트별 오버레이(`.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`) + 마켓플레이스 파일(`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`). 스킬을 읽는 호스트에는 스킬이 기본 길이다. 스킬을 못 읽는 호스트(Claude Desktop, claude.ai, ChatGPT, OpenAI Responses·Agents SDK)를 위해 2026-10-25부터 로컬 MCP 서버 `frameforge mcp`를 둔다. 호스팅 서버가 아니라 사용자의 컴퓨터에서 CLI를 감싸는 얇은 층이고, 스킬 본문은 `read_skill` 도구로 같은 내용을 준다.

## 스킬

| 스킬 | 용도 |
| --- | --- |
| `frameforge-best-practices` | 전체 규칙과 참조 문서(assets, motion, sound, checks, hosts). 다른 스킬의 진입점 |
| `frameforge-create` | 새 작품: 브리프 → 에셋 → Spot → audio.json → 등록 |
| `frameforge-motion` | 모션그래픽(쇼릴, 아이덴트, 런칭, 홍보): 사건별 정보·시각적 중심·읽기 시간을 설계하고 요청에 맞는 매체로 구현 |
| `frameforge-assets` | 모티프 키트, assets.json 해결(호스트 이미지 스킬 → 생성 → CC0 → 키트), 에셋 시트 |
| `frameforge-audio` | audio.json, 생성·측정, 움직임에서 나오는 효과음 |
| `frameforge-render` | 렌더 옵션(frame-range, concurrency, pipe, idempotent) |
| `frameforge-studio` | 스튜디오 띄우기·스틸 찍기 |
| `frameforge-check` | 검사 순서와 교차 리뷰 |
| `frameforge-blocks` | 블록 카탈로그(글자, 로어서드, 카드, 차트, 코드, 다이어그램)의 공통 계약과 고르는 법 |
| `frameforge-voice` | 나레이션 먼저: narration.json → voice.py → 측정된 시간으로 장면 → 자막 오버레이 → narration-check |
| `frameforge-3d` | 3d.json → 헤드리스 Blender PNG 시퀀스 → ImageSequence, Poly Haven CC0 모델, ThreeCanvas의 Model |
| `frameforge-3d-modeling` | 피사체 고르기(스캔 흉상, builtin, Poly Haven, 스크립트), 순서 있는 subject.ops, 잘리지 않는 자동 프레이밍 |
| `frameforge-3d-materials` | 룩, 맑은·색 유리(IOR, 흡수, 액체), 실측 PBR 값, 스캔 노멀 맵 유지, view 색 관리 |
| `frameforge-3d-lighting` | three-point·product·rim 리그, 피사체별 key:fill:rim 비율, 소프트박스 스튜디오 |
| `frameforge-3d-animation` | 카메라 이동, subject.keys, 실제 움직임의 모션 블러, scatter, 렌즈와 이동 규칙 |
| `frameforge-3d-review` | 숫자 먼저(--inspect) 그림 다음(--review 여섯 방향 시트), 한 번에 변수 하나 |
| `frameforge-generative` | 알고리즘 선언문 → 생성 배경 시스템 → 변수 노출, 색 보정·LUT·라이트 리크·그레인, 손그림 주석 |

약한 모델(haiku, gpt-*-luna, grok build-fast)은 키트와 템플릿 안에서만 움직이고, 강한 모델이 `assets.tsx`와 교차 리뷰를 맡는다. 호스트에 이미지·벡터 생성 도구가 있으면 `FRAMEFORGE_IMAGE_COMMAND`로 에셋 해결기에 연결한다.

## 설치

Claude Code (터미널):
```bash
claude plugin marketplace add jonsoku-dev/frameforge   # 또는 로컬 경로
claude plugin install frameforge@frameforge
```
개발 중에는 `claude --plugin-dir /path/to/frameforge`. 검증은 `claude plugin validate /path/to/frameforge`.

Codex (CLI·ChatGPT 데스크톱):
```bash
codex plugin marketplace add jonsoku-dev/frameforge   # 또는 로컬 경로
codex   # 세션에서 /plugins 로 설치, 새 세션에서 $frameforge-create
```
Codex는 저장소의 `.agents/skills`와 `$HOME/.agents/skills`에서도 스킬을 찾는다.

Cursor: `git clone https://github.com/jonsoku-dev/frameforge.git ~/.cursor/plugins/local/frameforge` 후 재시작(기준 엔진의 Cursor 안내와 같은 방식). Grok Build·스킬만 쓰는 호스트: `npm run skill:install`이 `~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`, `~/.grok/skills` 중 이미 있는 폴더에 스킬 11개를 심볼릭 링크한다(없는 폴더는 건너뛴다).

## MCP 서버와 호스트별 연결

| 파일 | 호스트 | 하는 일 |
| --- | --- | --- |
| `mcp/server.mjs` | 모두 | 도구 16개와 프롬프트 2개. stdio 기본, `--http --port`는 127.0.0.1의 Streamable HTTP(`/mcp`), Host 검사, `--allow-host`는 터널용(`FRAMEFORGE_MCP_TOKEN` 필수) |
| `.claude-plugin/plugin.json`의 `mcpServers` | Claude Code | `node ${CLAUDE_PLUGIN_ROOT}/bin/frameforge.mjs mcp`, 기본 프로젝트는 `CLAUDE_PROJECT_DIR`. 루트 `.mcp.json`은 두지 않는다(이 저장소를 연 세션이 프로젝트 MCP로 읽음) |
| `commands/make.md`, `check.md`, `studio.md` | Claude Code | `/frameforge:make`, `/frameforge:check`, `/frameforge:studio` |
| `agents/frameforge-maker.md` | Claude Code | MCP 도구만으로 작품 하나를 끝까지 만드는 서브에이전트 |
| `mcpb/manifest.json`, `mcpb/server/index.mjs` | Claude Desktop | `npm run pack:mcpb` → `dist/frameforge.mcpb`. 설정 값은 엔진 폴더(필수), 프로젝트 폴더, Chrome 경로 |
| `.codex-plugin/mcp.json` | Codex | 플러그인 폴더에서 `node ./bin/frameforge.mjs mcp`, `tool_timeout_sec` 900 |
| `mcp.json` | agent-plugins.org 포터블 호스트 | `type: stdio`, `${PLUGIN_ROOT}` |
| `examples/agents/openai-agents.py` | OpenAI Agents SDK | stdio로 서버를 띄우고 프롬프트를 지시문으로 써서 작품 하나를 만듦. 키는 환경 변수 `OPENAI_API_KEY`만 |

도구 목록, 호스트별 설치와 확인, 터널 경고(claude.ai, ChatGPT 개발자 모드, Responses API는 공개 URL이 필요하고 서버에는 인증이 없음)는 [install.md의 7번](install.md#7-mcp-서버)에 있다.

## 사용

새 세션에서 `/frameforge:frameforge-create 20초 제품 소개 모션그래픽`(Claude) 또는 `$frameforge-create ...`(Codex). 작품은 플러그인 저장소의 `examples/samples/<slug>/`에 만들어지고, 스튜디오는 `frameforge-studio`로 띄운다.

모션그래픽은 `frameforge-motion`에서 각 사건의 전후 정보, 유지 요소, 주목 대상과 읽기 시간을 계획한다. Claude의 `/frameforge:make`는 실제 렌더와 브리프를 검토하고 근거가 있는 결함을 제작자에게 되돌려 수정·재검토한다. 별도 리뷰어를 썼는지와 실제 재생·청취 여부를 구분해 보고한다. 정지 프레임이나 오디오 파형은 정상 속도 재생과 청취를 대신하지 않으며, 불가능한 평가는 미검증으로 남는다. MCP의 `make_motion_film` 프롬프트와 Codex의 같은 스킬도 이 계획·검토 경로를 따른다. 기술 검사에서 의도한 읽기 구간이 지적되면 실제 상태와 충돌을 보고하고, 경고를 지우기 위한 장식 움직임을 넣지 않는다.

MCP `render`에 `idempotent_frames: [0, 30, 59]`처럼 출력에 포함된 프레임 번호를 지정하면 각 프레임을 두 번 캡처해 비교한다. 성공 시 반환 `summary.idempotentFrames`에 실제 검사한 번호가 나온다. 생략하면 기존과 같이 반복 검사를 실행하지 않는다. 이 검사는 선택한 프레임만 다루며 전체 프레임의 결정성을 보증하지 않는다.

MCP `render`의 `frame_range`는 양 끝을 포함하는 두 개의 0 이상 정수 `[시작, 끝]`이며 시작이 끝보다 클 수 없다. 생략하면 전체 영상을 렌더한다.

외부 프로젝트에서 `score`, `voice` 및 일반 렌더의 자동 음향 생성은 다른 프로젝트와 공유하는 엔진 경로에 덮어쓰지 않도록 임시 실패한다. 공용 생성 음향을 읽는 경로도 차단한다. 프로젝트별 생성 기능이 구현된 것은 아니며, 생성 이미지·3D의 공용 경로는 별도의 미해결 문제다. 지정된 스냅샷을 쓰는 부분 렌더에서는 자동 생성을 실행하지 않는다.

POSIX 환경의 부분 렌더에서 사용자가 선택한 프로젝트 상대경로 WAV와 버전 1 매니페스트(composition, fps, durationInFrames, sha256)를 `audio_snapshot`, `audio_snapshot_manifest`로 함께 지정할 수 있다. 두 인자는 모두 부분 `frame_range`와 함께 필요하며 무음이나 시트 출력과 결합할 수 없다. 최신 스냅샷을 자동 선택하지 않는다. 반환된 summary의 실제 음원과 범위를 보고한다. 스냅샷 사용만으로 현재 소스와의 일치, 실제 청취, 완전한 오프라인 실행이나 범위 밖 바이트 미접근이 증명되지는 않는다.

`audio_snapshot_prepare`는 명시한 프로젝트 상대경로 WAV 전체를 읽고, 지정된 composition·fps·duration과 SHA-256으로 새 매니페스트를 만든다. 기존 파일은 덮어쓰지 않는다. 호출자가 제공한 메타데이터와 WAV 출처, 현재 소스와의 일치는 검증하지 않는다.

새 작품은 `film_new`로 만들고, 기존 작품의 수정은 원래 brief·plan·소스와 지정된 저장 결과를 먼저 읽어 이어서 진행한다. 기준 영상이 있으면 접근 가능한 범위에서 같은 사건의 전·중·후 장면, 사실 상태와 화면의 주목 대상을 대조하고 수정한 구간을 다시 확인한다. 기준의 사실 오류를 그대로 복사하지 않는다. 접근하거나 관찰하지 못한 비교는 NOT VERIFIED로 기록한다.

사실 상태 검증 예시: 사용자 입력이 A팀의 1차전 2–0 승리와 2차전 A 3골·B 2골이라면, A 기준 합계는 5–2다. 2차전 점수를 B–A 순서로 표시할 때는 2–3이고, 합계를 A–B 순서로 표시할 때는 5–2임을 각각 명시한다. 득점 전후에도 팀 순서와 누적 상태를 확인한다. 실제 작업에서는 이 예시보다 사용자의 사실과 의도가 우선이다. 기준과 결과 중 접근하지 못한 쪽은 비교했다고 쓰지 않으며, 샘플 프레임이나 파형만으로 재생과 청취를 확인했다고 쓰지 않는다.

MCP `render`에 구간을 지정하면 결과의 `requestedFrameRange`에 요청한 composition 프레임 범위가 포함된다. `video_frames`의 번호는 저장된 MP4 내부에서 0부터 시작한다. 예를 들어 `[300, 359]`를 렌더했다면 저장 영상 0번은 composition 300번이다. 범위를 모르면 추측하지 않는다. 서로 fps가 다른 영상은 프레임 번호가 아니라 사건이나 시간으로 대응시킨다.

MCP `video_frames`는 프로젝트 안의 기존 MP4에서 최대 8개 프레임을 0부터 시작하는 번호로 추출한다. 중복 번호를 제거하고 오름차순으로 반환한다. 원본 경로·SHA-256과 각 프레임의 실제 presentation timestamp(알 수 없으면 `null`)를 이미지와 함께 반환한다. `still`과 `contact_sheet`는 현재 코드를 다시 렌더하므로, 코드 수정 전 이미 저장된 영상을 확인할 때는 `video_frames`를 사용한다. 추출물은 정상 속도 재생이나 청취가 아니다. 원본과 경로의 심볼릭 링크는 허용하지 않는다. Python 3, FFmpeg, ffprobe와 POSIX `openat` 및 `/dev/fd`가 필요하며 Windows는 지원하지 않는다.

프로젝트 루트와 파일의 inode는 열 때와 결과 반환 직전에 확인한다. 두 검사 사이에 경로가 바뀌었다 복원되거나 반환 후 바뀌지 않았음까지 보증하지는 않으므로, SHA-256을 실제 관찰한 파일의 식별자로 사용한다. 경로에 `..` 구성요소가 있으면 정규화하지 않고 거부한다.

MCP `check`의 `pass`는 모든 검사 행이 PASS일 때만 `true`다. `noFailures`는 FAIL 없이 명령이 끝났는지를 나타내므로 WARN이나 SKIP이 있어도 `true`일 수 있다. 예를 들어 `Cuts: none`으로 이음새 검사를 의도적으로 건너뛴 경우 `noFailures: true`, `pass: false`이며 품질 실패를 뜻하지 않는다. WARN·SKIP은 정상 도구 응답이고 실제 FAIL은 도구 오류로 반환된다. 각 행과 관찰 범위를 함께 확인한다.

## 아직 아닌 것

- npm 배포: 엔진은 아직 npm 레지스트리에 올리지 않았다. 저장소 밖 프로젝트는 `bin/frameforge.mjs`(`frameforge init/new/studio/render/score/art/lint/check`)로 만들 수 있고, `npm link`로 PATH에 올린다(`docs/reference/cli.md`, 설치는 `docs/install.md`). `npx frameforge`처럼 설치 없이 부르는 길과 생성물을 프로젝트 쪽에 두는 일은 남았다.
- Codex 플러그인은 로컬 마켓플레이스로 검증했고, ChatGPT 디렉터리 등록은 하지 않았다.
- MCP 서버는 stdio(테스트와 실제 렌더 세션)와 HTTP(curl)로 확인했다. Claude Desktop에 .mcpb를 실제로 설치하는 것, ChatGPT 개발자 모드·Responses API의 터널 연결, Agents SDK 예제 실행(키 필요)은 확인하지 않았다.
- HTTP 모드에는 인증이 없다. 터널은 쓸 때만 연다.
