# 설치

이 문서는 Frameforge를 설치하는 모든 경로를 다룹니다. 각 단계에는 설치가 됐는지 확인하는 명령이 붙어 있습니다. 지우는 방법은 [uninstall.md](uninstall.md)에 있습니다.

필요한 프로그램(Node, Chrome, FFmpeg, Python과 numpy)은 [README의 요구 사항](../README.md#요구-사항)을 먼저 확인합니다.

| 경로 | 언제 쓰나 |
| --- | --- |
| [1. 저장소 받기](#1-저장소-받기) | 항상. 다른 경로는 모두 이 클론을 씁니다. |
| [2. 전역 `frameforge` 명령](#2-전역-frameforge-명령) | 저장소 밖 폴더에서 영상을 만들 때 |
| [3. Claude Code 플러그인](#3-claude-code-플러그인) | Claude Code에서 스킬로 쓸 때 |
| [4. Codex 플러그인](#4-codex-플러그인) | Codex CLI나 ChatGPT 데스크톱에서 쓸 때 |
| [5. Cursor](#5-cursor) | Cursor에서 쓸 때 |
| [6. 스킬 폴더만 읽는 호스트](#6-스킬-폴더만-읽는-호스트) | Grok Build처럼 플러그인 없이 스킬 폴더를 읽는 호스트 |
| [7. MCP 서버](#7-mcp-서버) | Claude Desktop, claude.ai, ChatGPT, OpenAI Responses·Agents SDK처럼 스킬 대신 MCP 도구로 엔진을 부를 때. Claude Code와 Codex 플러그인도 이 서버를 함께 띄웁니다. |

## 1. 저장소 받기

1. 저장소를 클론합니다.

   ```sh
   git clone https://github.com/jonsoku-dev/frameforge.git
   cd frameforge
   ```

2. 의존성을 설치합니다. `package-lock.json`에 고정된 버전을 그대로 받으려면 `npm ci`를 씁니다.

   ```sh
   npm ci
   ```

3. 도구가 보이는지 확인합니다.

   ```sh
   node --version        # v24 이상
   ffmpeg -version | head -1
   ffprobe -version | head -1
   python3 -c "import numpy; print(numpy.__version__)"
   ```

4. 엔진이 동작하는지 확인합니다.

   ```sh
   npx tsc --noEmit
   npm test
   npm run dev           # http://127.0.0.1:4317 에서 스튜디오가 열리면 성공. Ctrl+C로 끕니다.
   ```

5. 렌더가 되는지 확인합니다. Chrome을 찾지 못하면 `Set CHROME_PATH to your installed Chrome/Chromium executable.` 오류가 납니다.

   ```sh
   npm run render -- examples/samples/cafe-morning/entry.tsx CafeMorning renders/cafe-morning.mp4 --frame-range 0-89
   ffprobe -v error -show_entries stream=codec_name,width,height -of csv=p=0 renders/cafe-morning.mp4
   ```

   `h264,1920,1080`과 `aac` 줄이 나오면 성공입니다.

## 2. 전역 `frameforge` 명령

`bin/frameforge.mjs`는 엔진 저장소 밖 폴더에서 영상을 만드는 CLI입니다. `npm link`로 `PATH`에 올립니다.

1. 엔진 저장소에서 링크합니다. 전역 패키지 이름은 `frameforge-local`이고 명령 이름은 `frameforge`입니다.

   ```sh
   npm link
   ```

2. 확인합니다.

   ```sh
   which frameforge
   npm ls -g --depth=0 | grep frameforge-local
   frameforge help
   ```

   `frameforge-local@0.1.0 -> <엔진 경로>`가 보이고 `frameforge help`가 명령 목록을 출력하면 성공입니다.

3. 프로젝트를 만듭니다.

   ```sh
   frameforge init ~/my-films
   cd ~/my-films
   frameforge new demo-spot
   frameforge lint demo-spot
   ```

   `init`은 `films/_template/`, `films/index.tsx`, `frameforge.json`, `package.json`, `README.md`를 만듭니다. `new demo-spot`은 `films/demo-spot/`을 만들고 `films/index.tsx`에 `DemoSpot`을 등록합니다. `lint`가 `"findings": []`를 담은 JSON을 출력하면 성공입니다.

`npm link`를 쓰지 않으려면 모든 명령을 `node <엔진 경로>/bin/frameforge.mjs <명령>`으로 부릅니다. CLI가 엔진과 프로젝트를 찾는 방법은 [reference/cli.md](reference/cli.md)에 있습니다.

## 3. Claude Code 플러그인

저장소 루트의 `.claude-plugin/marketplace.json`이 `frameforge`라는 마켓플레이스를 선언하고, 그 안에 `frameforge` 플러그인이 하나 있습니다.

1. 마켓플레이스를 추가합니다. GitHub `owner/repo`나 로컬 클론 경로를 줍니다.

   ```sh
   claude plugin marketplace add jonsoku-dev/frameforge
   # 또는 로컬 클론
   claude plugin marketplace add /path/to/frameforge
   ```

2. 플러그인을 설치합니다.

   ```sh
   claude plugin install frameforge@frameforge
   ```

   대화형으로 설치하려면 Claude Code 세션에서 `/plugin`을 열고 `frameforge` 마켓플레이스에서 고릅니다.

3. 확인합니다.

   ```sh
   claude plugin marketplace list     # frameforge, 로컬 클론이면 Source: Folder (<경로>)
   claude plugin list                 # frameforge@frameforge, Status: enabled
   claude plugin validate /path/to/frameforge   # 로컬 클론이 있을 때
   ```

   새 세션에서 `/frameforge:frameforge-create 20초 제품 소개 모션그래픽`을 입력해 스킬이 뜨는지 봅니다.

개발 중에는 설치하지 않고 한 세션에만 불러올 수 있습니다.

```sh
claude --plugin-dir /path/to/frameforge
```

## 4. Codex 플러그인

저장소 루트의 `.agents/plugins/marketplace.json`이 Codex용 `frameforge` 마켓플레이스이고, `.codex-plugin/plugin.json`이 플러그인 매니페스트입니다.

1. 마켓플레이스를 추가합니다. `owner/repo[@ref]`, Git URL, 로컬 경로를 받습니다.

   ```sh
   codex plugin marketplace add jonsoku-dev/frameforge
   # 또는 로컬 클론
   codex plugin marketplace add /path/to/frameforge
   ```

2. 플러그인을 설치합니다. 둘 중 하나를 씁니다.

   ```sh
   codex plugin add frameforge@frameforge
   ```

   또는 `codex` 세션에서 `/plugins`를 열고 `frameforge`를 설치합니다.

3. 확인합니다.

   ```sh
   codex plugin marketplace list       # frameforge  <경로>
   codex plugin list | grep frameforge # frameforge@frameforge 줄의 상태가 not installed가 아님
   grep -n frameforge ~/.codex/config.toml
   ```

   `~/.codex/config.toml`에 `[marketplaces.frameforge]` 블록이 생깁니다. 새 세션에서 `$frameforge-create 20초 제품 소개 모션그래픽`으로 스킬을 부릅니다.

## 5. Cursor

Cursor는 로컬 플러그인 폴더에 저장소를 클론하고 재시작하는 방식입니다.

```sh
git clone https://github.com/jonsoku-dev/frameforge.git ~/.cursor/plugins/local/frameforge
cd ~/.cursor/plugins/local/frameforge
npm ci
```

Cursor를 재시작하고 확인합니다.

```sh
ls ~/.cursor/plugins/local/frameforge/skills    # frameforge-* 폴더 11개
```

이 경로는 `docs/plugin.md`의 안내를 옮긴 것입니다. Cursor에서 플러그인이 실제로 로드되는지는 이 문서를 쓸 때 확인하지 않았습니다. Cursor가 스킬 폴더(`~/.cursor/skills`)를 읽는다면 6번 방법도 됩니다.

## 6. 스킬 폴더만 읽는 호스트

Grok Build처럼 플러그인 매니페스트 없이 스킬 폴더를 읽는 호스트에는 스킬을 심볼릭 링크합니다.

```sh
npm run skill:install
```

이 명령은 `~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`, `~/.grok/skills` 중 이미 있는 폴더에만 `skills/frameforge-*` 11개를 링크합니다. 없는 폴더는 `skip <경로> (no such folder)`로 건너뜁니다. 대상에 같은 이름이 이미 있으면 지우고 다시 링크하므로, 같은 이름의 직접 만든 폴더가 있으면 먼저 옮겨 둡니다.

확인합니다.

```sh
ls -l ~/.grok/skills | grep frameforge     # frameforge-* -> <엔진 경로>/skills/frameforge-*
npm run skill:uninstall -- --dry-run       # 지울 링크 목록만 출력, 아무것도 지우지 않음
```

## 7. MCP 서버

`frameforge mcp`는 CLI 명령을 MCP 도구로 내는 서버입니다(`mcp/server.mjs`). 엔진 로직은 없고, 도구마다 정해진 인자로 `bin/frameforge.mjs`를 셸 없이 실행합니다. 엔진은 로컬에서 돌고 키가 필요 없습니다. OpenAI나 Anthropic 모델 호출은 사용자의 호스트가 합니다.

| 도구 | 하는 일 |
| --- | --- |
| `project_init` | 프로젝트 폴더를 만들고 이후 호출의 기본 프로젝트로 삼음 |
| `film_new`, `film_list` | 템플릿에서 작품 만들기, 작품 목록과 컴포지션 id |
| `film_files` | `films/<slug>/` 안의 파일 목록·읽기·쓰기. 절대 경로, `..`, 심볼릭 링크는 거부 |
| `brief_check`, `lint` | 브리프 검사, 결정성 린트 |
| `score` | `audio.json`으로 음악과 효과음 생성 |
| `render` | 전체나 프레임 구간을 `<프로젝트>/renders/`의 MP4로. 경로와 렌더러 JSON 요약을 돌려주고 진행 알림을 보냄. 기본 60분 뒤 중단 |
| `contact_sheet`, `still` | 여러 프레임 시트, 한 프레임(기본 0.5배)을 PNG 이미지로 돌려줌 |
| `video_frames` | 프로젝트의 저장된 MP4에서 프레임과 원본 SHA·타임스탬프를 반환(POSIX 전용, 재생·청취는 아님) |
| `check` | `frameforge check --json`의 표 |
| `studio_start`, `studio_stop` | 스튜디오를 127.0.0.1에 띄우고 URL을 돌려줌, 끄기 |
| `read_skill` | 스킬이나 참고 문서(`frameforge-motion`, `frameforge-best-practices/bespoke` 등)를 이름으로 읽기. 이름 없이 부르면 목록 |

프롬프트 `make_motion_film`, `make_explainer`는 요청 원문을 받아 브리프 → 콘셉트 → `film_files`로 직접 쓴 코드 → `score` → `contact_sheet` → 두 번째 손질 → `render` → `check` 순서를 모델에 줍니다.

공통 준비는 [1. 저장소 받기](#1-저장소-받기)입니다(`npm ci`가 MCP SDK도 설치). 프로젝트는 `--project <폴더>`, 환경 변수 `FRAMEFORGE_PROJECT_DIR`, 현재 폴더 순으로 정하고, `frameforge.json`이 없으면 엔진의 `examples/samples`를 씁니다. 도구마다 `project`(절대 경로) 인자로 바꿀 수도 있습니다.

```sh
node bin/frameforge.mjs mcp --help          # 이 클론에서. npm run mcp, npx frameforge mcp도 같음
frameforge mcp --project ~/my-films         # npm link 뒤 어디서나(stdio)
frameforge mcp --http --port 4319           # http://127.0.0.1:4319/mcp
```

`npx frameforge-local mcp`는 npm 레지스트리에 패키지가 없으므로 `npm link`로 전역에 올린 클론을 부릅니다. 링크한 클론이 이 버전보다 오래되면 `모르는 명령: mcp`가 나오니 그 클론을 갱신하거나 다시 링크합니다.

HTTP 모드는 127.0.0.1에만 열리고 `Host` 헤더가 `127.0.0.1:<포트>`나 `localhost:<포트>`가 아니면 403으로 막습니다(DNS 리바인딩 방어). 터널을 쓰면 `--allow-host <터널 호스트>`를 더하고, 환경 변수 `FRAMEFORGE_MCP_TOKEN`에 16자 이상의 임의 문자열을 넣어야 합니다(없으면 서버가 시작하지 않습니다). 모든 요청은 `Authorization: Bearer <토큰>` 헤더를 보내거나, 헤더를 못 보내는 호스트라면 `/mcp/<토큰>` 경로를 씁니다. 토큰을 파일에 적지 말고, 쓸 때만 터널을 열고 끝나면 닫습니다.

### Claude Code

[3. Claude Code 플러그인](#3-claude-code-플러그인)을 설치하면 `.claude-plugin/plugin.json`의 `mcpServers`가 `node ${CLAUDE_PLUGIN_ROOT}/bin/frameforge.mjs mcp`를 띄웁니다. 기본 프로젝트는 세션의 프로젝트 폴더(`CLAUDE_PROJECT_DIR`)입니다. 서버는 플러그인 폴더의 `node_modules`가 필요하므로 로컬 클론을 마켓플레이스로 추가하는 방법(`claude plugin marketplace add /path/to/frameforge`, 클론에서 `npm ci`)을 권합니다. GitHub에서 설치했다면 `claude plugin list`가 알려 주는 설치 경로에서 `npm ci`를 한 번 실행합니다.

플러그인이 함께 싣는 것:

- `/frameforge:make <요청>` 작품 하나를 끝까지 만들어 보고서를 돌려줌(서브에이전트 `frameforge-maker`에 맡김)
- `/frameforge:check <video.mp4> [slug]` 검사 표와 실패마다 고칠 점
- `/frameforge:studio [port|stop]` 스튜디오 URL

확인합니다.

```sh
claude plugin validate /path/to/frameforge     # Validation passed (CLAUDE.md 경고 하나는 기존 그대로)
claude --plugin-dir /path/to/frameforge mcp list   # plugin:frameforge:frameforge: node .../bin/frameforge.mjs mcp - ✔ Connected
```

렌더가 길면 도구 시간 제한에 걸릴 수 있습니다. `MCP_TOOL_TIMEOUT=1800000 claude`처럼 밀리초로 늘립니다.

플러그인 없이 서버만 붙이려면 `claude mcp add frameforge -- node /path/to/frameforge/bin/frameforge.mjs mcp --project ~/my-films`입니다.

### Claude Desktop (.mcpb 확장)

1. 확장을 만듭니다. 패커(`@anthropic-ai/mcpb` 2.1.2)는 `npx`가 받습니다.

   ```sh
   npm run pack:mcpb        # dist/frameforge.mcpb (약 2 kB)
   ```

2. Claude Desktop의 설정 → 확장 프로그램에서 `dist/frameforge.mcpb`를 열거나 창에 끌어다 놓습니다.
3. 설정 값을 넣습니다. `Frameforge engine folder`(필수)는 `npm ci`를 마친 클론, `Project folder`는 `frameforge init`으로 만든 폴더(비우면 엔진의 `examples/samples`), `Chrome executable`은 Chrome이 기본 위치에 없을 때만 넣습니다.

확장에는 매니페스트와 진입 파일만 들어 있습니다. 엔진(Node 의존성, Chrome, ffmpeg, Python과 numpy)은 확장에 담을 수 없어서 진입 파일이 설정한 클론의 `mcp/server.mjs`를 불러옵니다. 클론을 갱신하면 확장을 다시 만들 필요가 없습니다.

### claude.ai (웹)

claude.ai의 커스텀 커넥터는 Anthropic 서버가 MCP URL에 접속하므로 공개 HTTPS 주소가 필요합니다. 이 서버는 렌더에 로컬 Chrome과 파일이 필요해 로컬 전용입니다. 쓰려면 `frameforge mcp --http --port 4319 --allow-host <터널 호스트>`와 사용자가 직접 띄운 터널(예: `cloudflared tunnel --url http://127.0.0.1:4319`)로 `https://<터널 호스트>/mcp`를 커넥터에 넣습니다. 위의 인증 없음 경고가 그대로 적용됩니다. 또 이 저장소는 최상위 `bin/` 폴더가 있어 claude.ai와 Cowork의 플러그인 설치 대상이 되지 않습니다. 로컬에서는 Claude Desktop 확장을 씁니다.

### Codex

[4. Codex 플러그인](#4-codex-플러그인)을 설치하면 `.codex-plugin/plugin.json`의 `mcpServers`(`.codex-plugin/mcp.json`)가 플러그인 폴더에서 `node ./bin/frameforge.mjs mcp`를 띄우고 도구 시간 제한을 900초로 둡니다. 플러그인 폴더가 작업 폴더이므로 프로젝트는 `FRAMEFORGE_PROJECT_DIR`(Codex가 환경에서 넘김)이나 도구의 `project` 인자로 줍니다. 스킬은 그대로 함께 실립니다.

플러그인 없이 서버만 붙입니다.

```sh
codex mcp add frameforge -- npx frameforge-local mcp --project ~/my-films   # npm link 뒤
# 또는
codex mcp add frameforge -- node /path/to/frameforge/bin/frameforge.mjs mcp --project ~/my-films
codex mcp list                                                              # frameforge 줄이 보이면 성공
```

긴 렌더는 `~/.codex/config.toml`의 `[mcp_servers.frameforge]`에 `tool_timeout_sec = 1800`을 더합니다.

### ChatGPT 개발자 모드

ChatGPT도 OpenAI 서버가 URL에 접속하므로 claude.ai와 같은 터널이 필요합니다.

1. `FRAMEFORGE_MCP_TOKEN=<임의 문자열> frameforge mcp --http --port 4319 --allow-host <터널 호스트>`와 터널을 띄웁니다.
2. ChatGPT 설정 → 앱과 커넥터 → 고급 설정에서 개발자 모드를 켜고, 커넥터 만들기에서 URL `https://<터널 호스트>/mcp/<토큰>`, 인증 없음을 고릅니다(토큰이 경로에 들어 있습니다).
3. 대화에서 그 커넥터를 켜고 `make_motion_film` 순서대로 요청합니다.

도구에는 `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` 표시가 붙어 있어 ChatGPT가 쓰기 도구(`film_files`, `render` 등)만 확인을 묻습니다. 위젯(출력 템플릿)은 없습니다. 이미지는 MCP 이미지 콘텐츠로 돌아갑니다.

### OpenAI Responses API

Responses API의 `mcp` 도구도 OpenAI 쪽에서 접속하므로 공개 URL(터널)이 필요합니다.

```python
import os
from openai import OpenAI
client = OpenAI()   # OPENAI_API_KEY는 환경 변수에서
response = client.responses.create(
    model="<모델>",
    tools=[{"type": "mcp", "server_label": "frameforge", "server_url": "https://<터널 호스트>/mcp",
            "headers": {"Authorization": f"Bearer {os.environ['FRAMEFORGE_MCP_TOKEN']}"}}],
    input="read_skill로 frameforge-motion을 읽고 8초 아이덴트를 만들어 줘",
)
```

`require_approval`을 지정하지 않으면 도구 호출마다 승인을 묻습니다. `"never"`로 두면 쓰기 도구도 묻지 않고 실행하므로, 처음에는 기본값으로 씁니다.

### OpenAI Agents SDK

Agents SDK는 로컬 프로세스로 서버를 띄우므로 터널이 필요 없습니다. `examples/agents/openai-agents.py`가 stdio로 서버를 띄우고, 요청에 맞는 프롬프트(`make_motion_film` 또는 `make_explainer`)를 지시문으로 받아 작품을 끝까지 만듭니다.

```sh
python3 -m pip install openai-agents
export OPENAI_API_KEY=...        # 셸에서만. 파일에 적지 않습니다
python3 examples/agents/openai-agents.py ~/my-films "12초 제품 런칭 모션그래픽, 마지막에 이름"
```

## 환경 변수

모두 선택입니다. 값이 없으면 기본값을 씁니다.

| 변수 | 기본값 | 읽는 곳 | 뜻 |
| --- | --- | --- | --- |
| `FRAMEFORGE_PORT` | `4318` | `scripts/render.mjs` | `npm run render`가 띄우는 Vite 서버 포트. 렌더를 동시에 여러 개 돌릴 때 바꿉니다. 스튜디오 포트(4317)와 스튜디오 출력 탭의 렌더 포트(4318 고정)는 바꾸지 않습니다. |
| `FRAMEFORGE_MCP_TOKEN` | 없음 | `mcp/server.mjs` | HTTP MCP 서버의 접근 토큰(16자 이상). `--allow-host`(터널)를 쓸 때 필수입니다. 요청은 `Authorization: Bearer <토큰>` 또는 `/mcp/<토큰>` 경로로 보냅니다. 파일에 적지 않습니다. |
| `FRAMEFORGE_PROJECT` | 없음 | `vite.config.ts` | 저장소 밖 프로젝트 루트. 그 폴더에 `frameforge.json`이 있어야 합니다. `frameforge` CLI가 프로젝트 안에서 실행될 때 자동으로 넣습니다. |
| `FRAMEFORGE_PROJECT_DIR` | 현재 폴더 | `mcp/server.mjs` | MCP 서버의 기본 프로젝트(`frameforge.json`이 있는 폴더). `--project`가 먼저입니다. 프로젝트가 아니면 엔진의 `examples/samples`를 씁니다. |
| `FRAMEFORGE_ENGINE` | `mcp/`의 위 폴더 | `mcp/server.mjs`, `mcpb/server/index.mjs` | MCP 서버가 쓰는 엔진 클론. Desktop 확장이 설정 값으로 넣습니다. |
| `VIDEO_ENTRY` | `examples/samples/index.tsx` | `vite.config.ts` | 스튜디오와 렌더가 읽는 진입 파일. `npm run render`는 첫 인자로 이 값을 정합니다. |
| `CHROME_PATH` | 아래 목록에서 처음 있는 것 | `scripts/render.mjs` | Chrome 실행 파일. 기본 목록은 macOS의 Google Chrome, Chromium 앱과 `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`입니다. |
| `FFMPEG_PATH` | `ffmpeg` | 렌더러, 스튜디오 검사, 검사 스크립트, `score.py`, `art.py` | FFmpeg 실행 파일 |
| `FFMPEG` | `ffmpeg` | `score.py`, `score-report.py` | `FFMPEG_PATH`가 없을 때만 보는 옛 이름 |
| `FFPROBE_PATH` | `ffprobe` | Vite 미들웨어, 스튜디오 검사, `art.py`, `frame-check.mjs`, `snapshot-diff.mjs`, 렌더러의 모션 효과음 길이 검사 | ffprobe 실행 파일. `frame-check.mjs`와 `snapshot-diff.mjs`는 값이 없으면 `FFMPEG_PATH`의 `ffmpeg`를 `ffprobe`로 바꾼 경로를 씁니다. |
| `FRAMEFORGE_SFX_LICENSES` | `cc0` | `scripts/assets/sfx.py` | Openverse 효과음의 허용 라이선스(쉼표 목록). `cc0,by`로 CC BY를 허용하면 `CREDITS.md`가 생깁니다. |
| `FRAMEFORGE_IMAGE_COMMAND` | 없음 | `scripts/assets/art.py` | 호스트의 이미지 생성 도구를 부르는 셸 명령 템플릿. `{prompt}`와 선택적으로 `{out}`을 넣습니다. 셸로 실행됩니다. |
| `OPENVERSE_URL` | `sfx.py`: `https://api.openverse.org/v1/audio/`, `art.py`: `https://api.openverse.org/v1/images/` | `sfx.py`, `art.py` | Openverse 검색 엔드포인트. 두 스크립트가 같은 이름을 다른 뜻으로 씁니다. 하나에 맞춰 설정하면 다른 하나가 틀린 엔드포인트를 부르므로, 설정할 때는 그 스크립트를 실행하는 명령에만 붙입니다. |

이미지 명령에 넣는 토큰 같은 비밀 값은 셸 프로필이나 실행 명령 앞에 둡니다. 저장소 안 파일에는 적지 않습니다. `art.py`는 이미지 명령을 기록할 때 이름에 `KEY`, `TOKEN`, `SECRET`, `PASSWORD`가 들어간 환경 변수의 값을 `<redacted>`로 가립니다.
