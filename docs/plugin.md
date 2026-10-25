# Frameforge를 에이전트 플러그인으로 쓰기 (2026-10-20)

Frameforge는 저장소 자체가 포터블 에이전트 플러그인이다. 기준 엔진이 하는 방식(공식 문서 `docs/ai/claude-code-plugin`, `docs/ai/codex-plugin`, 모노레포 `packages/agent-plugin`·`claude-code-plugin`의 공개 매니페스트)을 그대로 따랐다: 루트 `plugin.json`(agent-plugins.org 스키마) + `skills/<이름>/SKILL.md` + 호스트별 오버레이(`.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`) + 마켓플레이스 파일(`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`). 스킬을 읽는 호스트에는 스킬이 기본 길이다. 스킬을 못 읽는 호스트(Claude Desktop, claude.ai, ChatGPT, OpenAI Responses·Agents SDK)를 위해 2026-10-25부터 로컬 MCP 서버 `frameforge mcp`를 둔다. 호스팅 서버가 아니라 사용자의 컴퓨터에서 CLI를 감싸는 얇은 층이고, 스킬 본문은 `read_skill` 도구로 같은 내용을 준다.

## 스킬

| 스킬 | 용도 |
| --- | --- |
| `frameforge-best-practices` | 전체 규칙과 참조 문서(assets, motion, sound, checks, hosts). 다른 스킬의 진입점 |
| `frameforge-create` | 새 작품: 브리프 → 에셋 → Spot → audio.json → 등록 |
| `frameforge-motion` | 모션그래픽(쇼릴, 아이덴트, 런칭, 홍보): 콘셉트 하나를 셰이더·캔버스·three.js 코드로 직접 그림. 엔진은 렌더, 음악, 검사만 |
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
| `mcp/server.mjs` | 모두 | 도구 14개와 프롬프트 2개. stdio 기본, `--http --port`는 127.0.0.1의 Streamable HTTP(`/mcp`), Host 검사, `--allow-host`는 터널용(`FRAMEFORGE_MCP_TOKEN` 필수) |
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

## 아직 아닌 것

- npm 배포: 엔진은 아직 npm 레지스트리에 올리지 않았다. 저장소 밖 프로젝트는 `bin/frameforge.mjs`(`frameforge init/new/studio/render/score/art/lint/check`)로 만들 수 있고, `npm link`로 PATH에 올린다(`docs/reference/cli.md`, 설치는 `docs/install.md`). `npx frameforge`처럼 설치 없이 부르는 길과 생성물을 프로젝트 쪽에 두는 일은 남았다.
- Codex 플러그인은 로컬 마켓플레이스로 검증했고, ChatGPT 디렉터리 등록은 하지 않았다.
- MCP 서버는 stdio(테스트와 실제 렌더 세션)와 HTTP(curl)로 확인했다. Claude Desktop에 .mcpb를 실제로 설치하는 것, ChatGPT 개발자 모드·Responses API의 터널 연결, Agents SDK 예제 실행(키 필요)은 확인하지 않았다.
- HTTP 모드에는 인증이 없다. 터널은 쓸 때만 연다.
