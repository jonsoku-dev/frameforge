# 완전히 지우기

이 문서는 Frameforge가 남긴 것을 모두 지우는 순서입니다. [install.md](install.md)의 역순으로 진행합니다. 엔진 클론은 마지막에 지웁니다. 앞 단계의 스크립트(`npm run skill:uninstall`)가 클론 안에 있기 때문입니다.

각 단계 끝에 확인 명령이 있습니다. 확인 명령이 아무것도 출력하지 않으면 그 단계가 끝난 것입니다. 단계를 건너뛰면 무엇이 남는지도 함께 적었습니다.

설치하지 않은 경로는 건너뜁니다.

## 1. 스킬 심볼릭 링크

`npm run skill:install`로 만든 링크를 지웁니다. 엔진 저장소에서 실행합니다.

```sh
npm run skill:uninstall -- --dry-run    # 지울 링크만 출력
npm run skill:uninstall
```

이 스크립트는 `~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`, `~/.grok/skills`에서 이름이 `frameforge-`로 시작하고 이 클론 안을 가리키는 심볼릭 링크만 지웁니다. 실제 폴더와 다른 곳을 가리키는 링크는 `keep ...`으로 출력하고 남깁니다. 스킬 원본(`skills/`)은 건드리지 않습니다.

확인합니다.

```sh
ls -l ~/.claude/skills ~/.codex/skills ~/.cursor/skills ~/.grok/skills 2>/dev/null | grep frameforge
```

건너뛰면 링크가 남습니다. 클론을 지운 뒤에는 깨진 링크가 되고, 호스트가 시작할 때 스킬을 못 찾는다는 경고를 낼 수 있습니다. 그때는 `rm ~/.grok/skills/frameforge-*`처럼 직접 지웁니다.

## 2. Cursor

```sh
rm -rf ~/.cursor/plugins/local/frameforge
```

Cursor를 재시작하고 확인합니다.

```sh
ls ~/.cursor/plugins/local | grep frameforge
```

건너뛰면 Cursor가 계속 플러그인을 읽습니다. 이 폴더는 엔진 클론과 별개인 두 번째 클론이므로, 그 안에서 만든 생성물(5번 단계의 폴더들)도 함께 지워집니다.

## 3. Codex

1. 플러그인을 지웁니다. 이 명령은 플러그인의 로컬 캐시도 지웁니다.

   ```sh
   codex plugin remove frameforge@frameforge
   ```

2. 마켓플레이스를 지웁니다.

   ```sh
   codex plugin marketplace remove frameforge
   ```

3. `~/.codex/config.toml`에 남은 블록을 확인하고, 있으면 그 블록을 지웁니다.

   ```sh
   grep -n -A3 'frameforge' ~/.codex/config.toml
   ```

   남을 수 있는 블록은 둘입니다.

   ```toml
   [marketplaces.frameforge]
   source_type = "local"
   source = "/path/to/frameforge"

   [plugins."frameforge@frameforge"]
   enabled = true
   ```

4. 확인합니다.

   ```sh
   codex plugin marketplace list | grep frameforge
   codex plugin list | grep frameforge
   ls ~/.codex/plugins/cache ~/.codex/plugins/data 2>/dev/null | grep frameforge
   ```

건너뛰면 Codex가 세션마다 마켓플레이스 경로를 읽으려 합니다. 클론을 지운 뒤에는 그 경로가 없다는 오류가 날 수 있습니다.

## 4. Claude Code

1. 플러그인을 지웁니다. 플러그인 데이터 폴더(`~/.claude/plugins/data/` 아래)도 지워집니다. 남기려면 `--keep-data`를 붙입니다. 프로젝트 범위로 설치했다면 `-s project`나 `-s local`을 붙입니다.

   ```sh
   claude plugin uninstall frameforge@frameforge
   ```

2. 마켓플레이스를 지웁니다.

   ```sh
   claude plugin marketplace remove frameforge
   ```

3. 확인합니다.

   ```sh
   claude plugin list | grep frameforge
   claude plugin marketplace list | grep frameforge
   ls ~/.claude/plugins/cache ~/.claude/plugins/data 2>/dev/null | grep frameforge
   grep -n frameforge ~/.claude/settings.json ~/.claude/plugins/known_marketplaces.json ~/.claude/plugins/installed_plugins.json
   ```

   설치 상태에서는 `~/.claude/plugins/cache/frameforge/frameforge/0.1.0/`, `settings.json`의 `enabledPlugins`와 `extraKnownMarketplaces` 항목, `known_marketplaces.json`과 `installed_plugins.json`의 항목이 있습니다. 두 명령 뒤에 남은 것이 있으면 그 항목만 지웁니다.

`claude --plugin-dir`로만 썼다면 지울 것이 없습니다. 그 세션에만 불러온 것입니다.

건너뛰면 Claude Code가 계속 스킬을 불러오고, 클론을 지운 뒤에는 마켓플레이스 경로를 찾지 못한다는 경고를 냅니다.

## 5. 전역 `frameforge` 명령과 밖 프로젝트

1. 전역 링크를 지웁니다.

   ```sh
   npm unlink -g frameforge-local
   ```

   `--dry-run`을 붙이면 지우지 않고 `removed 1 package`를 출력합니다. 이 출력은 실제로 지웠다는 뜻이 아닙니다.

2. 확인합니다.

   ```sh
   npm ls -g --depth=0 | grep frameforge-local
   which frameforge
   ```

3. `frameforge init`으로 만든 프로젝트 폴더를 지웁니다. 그 안의 `films/`가 작품 원본이므로 남길 작품은 먼저 옮깁니다.

   ```sh
   rm -rf ~/my-films
   ```

   `init`이 만드는 것은 `films/_template/`, `films/index.tsx`, `frameforge.json`, `package.json`, `README.md`입니다. 그 뒤에 `films/<slug>/`(작품, `overrides.json`, `process.json` 포함)와 `renders/studio/`(스튜디오 렌더 결과)가 생깁니다. 프로젝트 작품의 음악, 에셋, 캐시는 프로젝트가 아니라 엔진에 쌓이므로 6번 단계에서 지웁니다.

건너뛰면 `frameforge` 명령이 PATH에 남습니다. 클론을 지운 뒤에는 깨진 링크가 되어 `command not found`나 모듈을 찾지 못한다는 오류를 냅니다.

## 6. 엔진 안의 생성물

클론을 남기고 생성물만 지울 때도 이 단계를 씁니다. 엔진 저장소에서 실행합니다.

```sh
rm -rf public/audio/generated public/assets/generated .cache dist
find renders -mindepth 1 ! -name .gitkeep -exec rm -rf {} +
rm -rf node_modules/.vite node_modules/.vite-*
```

| 경로 | 무엇인가 |
| --- | --- |
| `public/audio/generated/<slug>/` | `score.py`가 만든 음악, 효과음, `sfx.json`, `CREDITS.md`. 밖 프로젝트 작품의 것도 여기 있습니다. |
| `public/assets/generated/<slug>/` | `art.py`가 해결한 SVG와 PNG, 매니페스트, 호스트 원본(`.host/`) |
| `.cache/video-frames/`, `.cache/remote/` | `<Video>` 프레임 PNG, 내려받은 https 미디어 |
| `renders/` | 렌더 결과. 스튜디오 렌더는 `renders/studio/<slug>/` |
| `node_modules/.vite`, `node_modules/.vite-render-<포트>`, `node_modules/.vite-temp` | Vite 의존성 캐시 |
| `dist/` | `npm run build` 결과 |

렌더 도중 프로세스를 강제로 끝냈다면 임시 폴더가 남을 수 있습니다. 렌더러는 정상 종료 때 이 폴더를 지웁니다.

```sh
ls -d "${TMPDIR:-/tmp}"/frameforge-* 2>/dev/null      # 렌더용 Chrome 프로필, snapshot-diff의 frameforge-psnr-*
rm -rf "${TMPDIR:-/tmp}"/frameforge-*
find . -name '.frameforge-*' -prune -print          # 출력 파일 옆의 인코딩 준비 폴더
```

확인합니다.

```sh
ls public/audio/generated public/assets/generated .cache dist 2>/dev/null
ls renders
ls -d node_modules/.vite* 2>/dev/null
```

`ls renders`는 `.gitkeep`만 남으므로 아무것도 출력하지 않습니다.

건너뛰면 생성한 소리와 그림, 영상 캐시가 디스크에 남습니다. 7번 단계에서 클론을 지우면 함께 지워집니다.

## 7. 클론

```sh
cd ..
rm -rf frameforge
```

확인합니다.

```sh
ls -d frameforge 2>/dev/null
```

남는 것은 직접 설치한 Node, Chrome, FFmpeg, Python, numpy와 `art.py`가 설치했을 수 있는 `vtracer`뿐입니다. `vtracer`는 `python3 -m pip uninstall vtracer`로 지웁니다.
