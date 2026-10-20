# 처음부터 따라 하기

이 문서는 아무것도 설치되지 않은 컴퓨터에서 첫 영상을 만들고 지우기까지를 사람이 한 단계씩 따라 하는 안내입니다. 각 단계에 기대하는 출력을 붙였습니다. 출력은 2026-10-20에 macOS(Apple Silicon)에서 실행한 결과를 줄인 것입니다. 경로와 시간은 컴퓨터마다 다릅니다.

에이전트에게 맡기려면 [agent-install.md](agent-install.md)를, 설치 경로별 세부와 환경 변수는 [install.md](install.md)를 봅니다.

## 1. 필요한 프로그램 설치

Node.js 24 이상, Git, FFmpeg(ffprobe 포함), Python 3와 numpy, Chrome이 필요합니다.

### macOS (Homebrew)

```sh
brew install node@24 git ffmpeg python numpy
brew install --cask google-chrome
```

`node@24`는 keg-only라 PATH에 바로 오르지 않을 수 있습니다. 설치가 끝날 때 Homebrew가 알려 주는 `echo 'export PATH=...' >> ~/.zshrc` 줄을 실행합니다. 이미 nvm 같은 버전 관리자를 쓰면 `nvm install 24`로 대신합니다.

### Ubuntu (apt)

Ubuntu 기본 저장소의 Node는 24보다 오래되었으므로 NodeSource 저장소에서 받습니다.

```sh
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git ffmpeg python3 python3-numpy chromium-browser
```

Chrome을 쓰려면 Google의 `.deb`를 설치합니다. 이때 실행 파일이 렌더러의 기본 목록(`/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`)에 없으면 `export CHROME_PATH=$(command -v google-chrome-stable)`처럼 지정합니다. Ubuntu 절차는 이 문서를 쓸 때 실행해 보지 않았습니다.

### Windows (winget)

```powershell
winget install OpenJS.NodeJS.LTS Git.Git Gyan.FFmpeg Python.Python.3.13 Google.Chrome
py -m pip install numpy
```

Windows에서는 확인하지 않았습니다. 알려진 차이가 셋 있습니다. 렌더러의 기본 Chrome 목록에 Windows 경로가 없어 `CHROME_PATH`가 필요합니다(`$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"`). npm 스크립트가 `python3`를 부르므로 그 이름으로 Python이 실행되어야 합니다. `npm run skill:install`은 심볼릭 링크를 만들므로 개발자 모드나 관리자 권한이 필요합니다. 막히면 WSL2의 Ubuntu에서 위 Ubuntu 절차를 따르는 편이 안전합니다.

### 확인

```sh
node -v
ffmpeg -version | head -1
ffprobe -version | head -1
python3 -c "import numpy; print(numpy.__version__)"
```

기대 출력:

```text
v24.20.0
ffmpeg version 7.1.1 Copyright (c) 2000-2025 the FFmpeg developers
ffprobe version 7.1.1 Copyright (c) 2007-2025 the FFmpeg developers
2.4.4
```

Node가 v24보다 낮으면 렌더러가 Chrome에 붙지 못합니다.

## 2. 클론과 설치

```sh
git clone https://github.com/jonsoku-dev/frameforge.git
cd frameforge
npm ci
npm test
```

기대 출력(마지막 부분):

```text
ℹ pass 144
ℹ fail 0
```

테스트 수는 버전마다 다릅니다. `fail 0`이면 됩니다.

## 3. 첫 렌더

샘플 `cafe-morning`의 처음 3초를 렌더합니다.

```sh
npm run render -- examples/samples/cafe-morning/entry.tsx CafeMorning renders/cafe-morning.mp4 --frame-range 0-89
```

기대 출력(줄임):

```text
{"slug": "cafe-morning", "files": ["music.wav", ...]}
30/90 frames
60/90 frames
90/90 frames
{
  "outputLocation": ".../renders/cafe-morning.mp4",
  "composition": {"id": "CafeMorning", "width": 1920, "height": 1080, "fps": 30, "durationInFrames": 600},
  "frames": 90,
  ...
  "seconds": 11.0
}
```

첫 줄은 음악과 효과음 생성 결과입니다. 처음 실행할 때는 생성에 몇 초 더 걸립니다. 파일을 확인합니다.

```sh
ffprobe -v error -show_entries stream=codec_name,width,height,nb_frames -of csv=p=0 renders/cafe-morning.mp4
```

```text
h264,1920,1080,90
aac,142
```

`Set CHROME_PATH to your installed Chrome/Chromium executable.`이 나오면 Chrome 경로를 `CHROME_PATH`로 지정하고 다시 실행합니다. `Output already exists`가 나오면 출력 파일 이름을 바꿉니다.

## 4. 스튜디오 열기

```sh
VIDEO_ENTRY=examples/samples/index.tsx npm run dev
```

브라우저에서 http://127.0.0.1:4317 을 엽니다. 왼쪽 목록에서 작품을 고르고 재생합니다. 오른쪽 탭은 기획, 과정, 조정, 출력입니다. 출력 탭에서 렌더를 요청하면 결과가 `renders/studio/<slug>/`에 생깁니다. 끌 때는 터미널에서 Ctrl+C를 누릅니다.

`Port 4317 is already in use`가 나오면 다른 스튜디오가 이미 떠 있는 것입니다. 그 창을 쓰거나 `npm run dev -- --port 4330`으로 띄우고 http://127.0.0.1:4330 을 엽니다.

탭별 설명은 [reference/studio.md](reference/studio.md)에 있습니다.

## 5. 템플릿으로 작품 만들기

엔진 저장소를 건드리지 않도록 밖 폴더에 프로젝트를 만듭니다.

```sh
npm link                      # 엔진 저장소에서 한 번
frameforge init ~/my-films
cd ~/my-films
frameforge new demo-spot
```

기대 출력:

```text
/Users/you/my-films 를 만들었습니다. cd /Users/you/my-films && frameforge new <slug>
/Users/you/my-films/films/demo-spot 를 만들고 /Users/you/my-films/films/index.tsx 에 DemoSpot 를 등록했습니다.
```

`films/demo-spot/`에 다섯 파일이 생깁니다.

| 파일 | 고칠 내용 |
| --- | --- |
| `prompt.md` | 기획. 먼저 씁니다. 목적 한 문장, 색 넷, 글꼴 둘, 장면표 |
| `Spot.tsx` | 프레임 함수. 화면과 움직임 |
| `assets.tsx` | 직접 그린 그림(필요할 때) |
| `audio.json` | 음악 분위기, 빠르기, 구간, 효과음 |
| `entry.tsx` | 이 작품만 등록하는 진입 파일 |

규칙은 [samples/rules.md](samples/rules.md), 쓰는 법은 [guides/motion-graphics.md](guides/motion-graphics.md)에 있습니다. 고치는 동안 스튜디오로 봅니다.

```sh
frameforge score demo-spot
frameforge studio
```

## 6. 렌더와 검사

```sh
frameforge lint demo-spot
frameforge render demo-spot DemoSpot out.mp4
frameforge check out.mp4
```

`lint`는 `"findings": []`이면 통과입니다. 템플릿 그대로 렌더하면 600프레임에 약 52초가 걸렸습니다. `check`의 기대 출력(줄임):

```text
out.mp4 1920x1080 600f (hold 60)
  coverage min ... median ...
  ...
  PASS
{
  ...
  "pass": true
}
```

앞부분은 `frame-check`(빈 화면, 정지, 가운데 몰림, 작은 요소), 뒷부분은 `flash-check`(깜빡임)입니다. `FAIL: static ...`은 4초 넘게 멈춘 구간, `FAIL: thin share ...`는 헤드라인급 요소가 없는 프레임이 많다는 뜻입니다. 기준은 [samples/rules.md](samples/rules.md)의 구성 최소치입니다. `frame-check`는 영상 한 편 전체를 재는 도구라, 짧게 자른 구간은 실패할 수 있습니다.

검사 도구 설명은 [reference/quality-checks.md](reference/quality-checks.md)에 있습니다.

## 7. 지우기

전체 순서와 확인 명령은 [uninstall.md](uninstall.md)에 있습니다. 이 문서대로만 설치했다면 아래로 끝납니다.

```sh
npm unlink -g frameforge-local        # 엔진 저장소에서
rm -rf ~/my-films                     # 남길 작품은 먼저 옮깁니다
cd .. && rm -rf frameforge            # 생성된 소리, 그림, 캐시도 함께 지워집니다
which frameforge                      # 아무것도 출력하지 않으면 끝
```
