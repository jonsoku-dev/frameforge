# AGENTS.md

이 파일은 이 저장소에서 일하는 코딩 에이전트(Codex, Cursor, Grok Build, Claude Code 등)를 위한 지침입니다. 사람이 읽는 설치 문서는 [docs/manual.md](docs/manual.md)와 [docs/install.md](docs/install.md)입니다.

## 이 저장소

- Frameforge는 React로 영상을 만드는 MIT 엔진입니다. Remotion과 제휴하지 않은 독립 구현입니다.
- 패키지 이름은 `frameforge-local`, 저장소는 https://github.com/jonsoku-dev/frameforge 입니다.
- 작품은 `examples/samples/<slug>/`에 있습니다. 새 작품은 `examples/samples/_template/`에서 시작합니다.
- 작품을 만들 때는 `skills/frameforge-create/SKILL.md`, 검사는 `skills/frameforge-check/SKILL.md`를 따릅니다. 전체 규칙은 `skills/frameforge-best-practices/SKILL.md`입니다.
- Remotion 구현 파일을 열거나 옮기지 않습니다. 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md)의 "독립 구현 규칙"입니다.

## 클론부터 첫 렌더와 스튜디오까지

순서대로 실행합니다. 각 단계의 "성공" 조건을 확인한 뒤 다음 단계로 갑니다. 실패하면 아래 "실패했을 때" 표를 봅니다.

### 1. 필요한 프로그램 확인

```sh
node -v                                   # 성공: v24 이상
ffmpeg -version | head -1                 # 성공: ffmpeg version ...
ffprobe -version | head -1                # 성공: ffprobe version ...
python3 -c "import numpy; print(numpy.__version__)"   # 성공: 버전 숫자
```

Chrome 경로를 찾습니다. 렌더러는 아래 경로를 차례로 보고, 없으면 `CHROME_PATH`를 요구합니다.

```sh
# macOS
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "/Applications/Chromium.app/Contents/MacOS/Chromium" 2>/dev/null
# Linux
ls /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome 2>/dev/null
```

하나도 나오지 않으면 설치된 Chrome 실행 파일 경로를 찾아 `export CHROME_PATH=<경로>`로 지정합니다. 예를 들어 Linux의 `google-chrome-stable`이나 Windows의 `chrome.exe`는 기본 목록에 없습니다.

### 2. 클론과 의존성

```sh
git clone https://github.com/jonsoku-dev/frameforge.git
cd frameforge
npm install
```

성공: `node_modules/`가 생기고 오류 없이 끝납니다. 이미 클론 안에 있으면 `git clone`과 `cd`는 건너뜁니다.

### 3. 스모크 테스트

```sh
npm test
```

성공: 마지막 요약에 `fail 0`이 나옵니다.

### 4. 첫 렌더

```sh
npm run render -- examples/samples/cafe-morning/entry.tsx CafeMorning renders/samples/first.mp4 --frame-range 0-89
```

성공: 마지막에 `"frames": 90`과 `"seconds"`가 든 JSON이 출력되고 `renders/samples/first.mp4`가 생깁니다. 음악과 효과음은 이 명령이 먼저 `public/audio/generated/cafe-morning/`에 만듭니다. 같은 파일이 이미 있으면 렌더러는 `Output already exists`로 멈추므로 다른 이름을 쓰거나 기존 파일을 지웁니다.

확인합니다.

```sh
ffprobe -v error -show_entries stream=codec_name,width,height,nb_frames -of csv=p=0 renders/samples/first.mp4
```

성공: `h264,1920,1080,90`과 `aac` 줄이 나옵니다.

### 5. 화면 구성 검사

```sh
npm run frame-check -- renders/samples/first.mp4
```

`frame-check`는 완성된 영상 한 편을 재는 도구입니다. 마지막 1초(30fps에서 30프레임, `--hold`로 바꿈)를 끝 정지로 보고 빼고 잽니다. 시간 기준은 영상의 fps를 읽어 초 단위로 맞춥니다. 3초짜리 구간 렌더는 도입부 빈 화면 때문에 `FAIL: thin share ...`가 나오는 것이 정상입니다. 이 단계의 성공 조건은 도구가 실행되어 `coverage`, `empty`, `static`, `motion share`, `huddled share`, `thin` 줄을 출력하는 것입니다.

전체 작품으로 확인하려면 `kit-launch`를 끝까지 렌더합니다(약 46초 걸렸습니다). kit-launch는 얼어붙은 구간 기준(1초)이 생기기 전에 만들어서 지금은 `FAIL: frozen ...`이 나옵니다. 옛 기준의 정지 지표만 보면 통과합니다(`docs/research/benchmark-loop.md`).

```sh
npm run render -- examples/samples/kit-launch/entry.tsx KitLaunch renders/samples/kit-launch-check.mp4
npm run frame-check -- renders/samples/kit-launch-check.mp4     # 성공: frozen 외의 실패 없음
```

### 6. 스튜디오

```sh
VIDEO_ENTRY=examples/samples/cafe-morning/entry.tsx npm run dev
```

성공: http://127.0.0.1:4317 이 응답합니다. 확인은 `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4317/`이 `200`을 출력하는 것입니다. 사용자에게 이 URL을 알려 줍니다. 서버는 127.0.0.1에만 열립니다. `VIDEO_ENTRY` 없이 `npm run dev`로 띄우면 샘플 전체(`examples/samples/index.tsx`)가 열립니다. 서버는 계속 실행되므로 백그라운드로 띄우고, 일이 끝나면 끕니다.

### 7. 플러그인이나 스킬 설치(선택)

사용자가 원할 때만 합니다. 지금 실행 중인 호스트에 맞는 것 하나를 고릅니다.

| 호스트 | 명령 | 확인 |
| --- | --- | --- |
| Claude Code | `claude plugin marketplace add jonsoku-dev/frameforge` 다음 `claude plugin install frameforge@frameforge` | `claude plugin list`에 `frameforge@frameforge`, `Status: ✔ enabled` |
| Codex | `codex plugin marketplace add jonsoku-dev/frameforge` 다음 `codex plugin add frameforge@frameforge` | `codex plugin list`의 `frameforge@frameforge` 줄에 `not installed`가 없음 |
| Cursor | `git clone https://github.com/jonsoku-dev/frameforge.git ~/.cursor/plugins/local/frameforge` 후 재시작 | `ls ~/.cursor/plugins/local/frameforge/skills` |
| Grok Build, 스킬 폴더만 읽는 호스트 | 이 클론에서 `npm run skill:install` | `ls -l ~/.grok/skills | grep frameforge` |

로컬 클론을 마켓플레이스로 쓰려면 `jonsoku-dev/frameforge` 대신 클론 경로를 줍니다. 설치한 스킬은 새 세션에서 보입니다. 자세한 내용은 [docs/install.md](docs/install.md)입니다.

## 실패했을 때

| 증상 | 원인 | 할 일 |
| --- | --- | --- |
| `Set CHROME_PATH to your installed Chrome/Chromium executable.` | 기본 경로에 Chrome이 없음 | Chrome 실행 파일 경로를 찾아 `CHROME_PATH=<경로> npm run render -- ...`로 다시 실행 |
| 렌더 중 `Port 4318 is already in use` | 다른 렌더나 스튜디오 출력 탭이 4318을 씀 | `FRAMEFORGE_PORT=4319 npm run render -- ...`처럼 다른 포트로 실행 |
| 스튜디오에서 `Port 4317 is already in use` | 다른 스튜디오가 실행 중 | 그 서버를 쓰거나 `npm run dev -- --port 4330`으로 띄우고 그 URL을 알려 줌 |
| `ModuleNotFoundError: No module named 'numpy'` | Python에 numpy 없음 | `python3 -m pip install --user numpy` 후 다시 실행. Homebrew Python이 이를 막으면 `brew install numpy` |
| `ffmpeg`나 `ffprobe`를 찾지 못함 | PATH에 없음 | 설치하거나 `FFMPEG_PATH`, `FFPROBE_PATH`로 지정 |
| 파일 작업에서 `EPERM`, `EBUSY` | 다른 프로세스(스튜디오, 편집기, 동기화 도구)가 파일을 잡고 있음 | 몇 초 기다렸다 같은 명령을 다시 실행. 계속되면 그 파일을 쓰는 프로세스를 사용자에게 알림 |
| `Output already exists: ...` | 출력 파일이 이미 있음 | 다른 출력 이름을 쓰거나 기존 파일을 지움 |
| `Clipped text: ...` | 글자가 마스크 밖으로 잘림 | 작품의 마스크 여유를 늘림. `docs/reference/quality-checks.md` 참고 |
| `Sound effects ... apart` 또는 `Four sound effects within 4 s` | 효과음이 너무 촘촘함 | `audio.json`의 효과음 간격을 0.5초 이상, 4초에 셋 이하로 고침 |

## 작업 규칙

- 확인 명령. 타입은 `npx tsc --noEmit`, 테스트는 `npm test`, 작품 결정성은 `npm run lint:video -- <entry.tsx>`입니다.
- 렌더 결과는 `renders/`, 생성된 소리와 그림은 `public/audio/generated/`, `public/assets/generated/`에 쌓입니다. 모두 gitignore 대상이며 커밋하지 않습니다.
- 비밀 값(토큰, 비밀번호)을 파일에 쓰지 않습니다. 환경 변수 목록은 [docs/install.md](docs/install.md#환경-변수)입니다.
- 제거는 [docs/uninstall.md](docs/uninstall.md)의 순서를 따릅니다.
