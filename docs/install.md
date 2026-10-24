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

## 환경 변수

모두 선택입니다. 값이 없으면 기본값을 씁니다.

| 변수 | 기본값 | 읽는 곳 | 뜻 |
| --- | --- | --- | --- |
| `FRAMEFORGE_PORT` | `4318` | `scripts/render.mjs` | `npm run render`가 띄우는 Vite 서버 포트. 렌더를 동시에 여러 개 돌릴 때 바꿉니다. 스튜디오 포트(4317)와 스튜디오 출력 탭의 렌더 포트(4318 고정)는 바꾸지 않습니다. |
| `FRAMEFORGE_PROJECT` | 없음 | `vite.config.ts` | 저장소 밖 프로젝트 루트. 그 폴더에 `frameforge.json`이 있어야 합니다. `frameforge` CLI가 프로젝트 안에서 실행될 때 자동으로 넣습니다. |
| `VIDEO_ENTRY` | `examples/samples/index.tsx` | `vite.config.ts` | 스튜디오와 렌더가 읽는 진입 파일. `npm run render`는 첫 인자로 이 값을 정합니다. |
| `CHROME_PATH` | 아래 목록에서 처음 있는 것 | `scripts/render.mjs` | Chrome 실행 파일. 기본 목록은 macOS의 Google Chrome, Chromium 앱과 `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`입니다. |
| `FFMPEG_PATH` | `ffmpeg` | 렌더러, 스튜디오 검사, 검사 스크립트, `score.py`, `art.py` | FFmpeg 실행 파일 |
| `FFMPEG` | `ffmpeg` | `score.py`, `score-report.py` | `FFMPEG_PATH`가 없을 때만 보는 옛 이름 |
| `FFPROBE_PATH` | `ffprobe` | Vite 미들웨어, 스튜디오 검사, `art.py`, `frame-check.mjs`, `snapshot-diff.mjs` | ffprobe 실행 파일. `frame-check.mjs`와 `snapshot-diff.mjs`는 값이 없으면 `FFMPEG_PATH`의 `ffmpeg`를 `ffprobe`로 바꾼 경로를 씁니다. |
| `FRAMEFORGE_SFX_LICENSES` | `cc0` | `scripts/assets/sfx.py` | Openverse 효과음의 허용 라이선스(쉼표 목록). `cc0,by`로 CC BY를 허용하면 `CREDITS.md`가 생깁니다. |
| `FRAMEFORGE_IMAGE_COMMAND` | 없음 | `scripts/assets/art.py` | 호스트의 이미지 생성 도구를 부르는 셸 명령 템플릿. `{prompt}`와 선택적으로 `{out}`을 넣습니다. 셸로 실행됩니다. |
| `ELEVENLABS_API_KEY` | 없음 | `scripts/assets/sfx.py`, `score.py` | 효과음 텍스트 생성. 음악 공급자 `"provider": "elevenlabs"`는 아직 연결되지 않은 스텁이라 키가 있으면 `NotImplementedError`로 멈춥니다. 키가 없으면 내장 합성을 씁니다. |
| `ELEVENLABS_URL` | `https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_48000` | `scripts/assets/sfx.py` | 효과음 생성 엔드포인트 |
| `SUNO_API_KEY` | 없음 | `scripts/assets/score.py` | 음악 공급자 `"provider": "suno"`용. ElevenLabs 음악과 같은 스텁입니다. |
| `RECRAFT_API_KEY` | 없음 | `scripts/assets/art.py` | Recraft 벡터 그림 생성(`recraftv4_1_vector`) |
| `RECRAFT_URL` | `https://external.api.recraft.ai/v1` | `scripts/assets/art.py` | Recraft API 기준 주소 |
| `OPENVERSE_URL` | `sfx.py`: `https://api.openverse.org/v1/audio/`, `art.py`: `https://api.openverse.org/v1/images/` | `sfx.py`, `art.py` | Openverse 검색 엔드포인트. 두 스크립트가 같은 이름을 다른 뜻으로 씁니다. 하나에 맞춰 설정하면 다른 하나가 틀린 엔드포인트를 부르므로, 설정할 때는 그 스크립트를 실행하는 명령에만 붙입니다. |

API 키는 셸 프로필이나 실행 명령 앞에 둡니다. 저장소 안 파일에는 적지 않습니다. `art.py`는 이미지 명령을 기록할 때 이름에 `KEY`, `TOKEN`, `SECRET`, `PASSWORD`가 들어간 환경 변수의 값을 `<redacted>`로 가립니다.
