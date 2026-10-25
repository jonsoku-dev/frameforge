# 저장소 밖 프로젝트 CLI

`bin/frameforge.mjs` 레퍼런스입니다. 설치는 [../install.md](../install.md), 지우는 법은 [../uninstall.md](../uninstall.md)에 있습니다. 전체 명령은 `frameforge help`로 봅니다.

## 저장소 밖 프로젝트에서 쓰기

`bin/frameforge.mjs`가 엔진 저장소 밖 폴더에서 영상을 만들게 해 준다. 엔진 저장소에서 `npm link`를 한 번 하면 `frameforge`가 PATH에 올라가고, 아니면 `node <엔진>/bin/frameforge.mjs`로 부른다.

```sh
frameforge init ~/my-films && cd ~/my-films     # films/_template, films/index.tsx, frameforge.json, package.json, README.md
frameforge new demo-spot                         # films/demo-spot, 컴포지션 id DemoSpot, films/index.tsx에 등록
frameforge score demo-spot                       # 음악과 효과음
frameforge studio --port 4330                    # 스튜디오, 파일 열기 링크는 이 프로젝트 경로를 가리킨다
frameforge render demo-spot DemoSpot out.mp4 --frame-range 0-59
frameforge render demo-spot DemoSpot out.webm --transparent     # .webm/.mov/.gif/폴더/ 는 rendering.md "출력 형식"
frameforge check out.mp4 --film demo-spot        # frame-check, flash-check, seam-check, narration-check를 한 표로
frameforge art demo-spot / frameforge lint demo-spot
frameforge voice demo-spot                       # narration.json → 음성 파일과 narration.timing.json (voice.md)
frameforge blender demo-spot --frames 0-1        # 3d.json의 샷을 헤드리스 Blender로 (three-d.md)
frameforge models demo-spot                      # models.json의 CC0 모델·HDRI
frameforge seam-check out.mp4.motion.json --prompt films/demo-spot/prompt.md
frameforge narration-check demo-spot --prompt films/demo-spot/prompt.md
frameforge mcp --project ~/my-films             # MCP 서버(stdio). --http --port 4319는 http://127.0.0.1:4319/mcp, --allow-host는 터널 호스트 허용
```

`check <video> [--fps 30] [--film <slug|폴더>] [--prompt prompt.md] [--json]`은 네 검사를 차례로 돌리고 `검사  PASS|FAIL|SKIP  한 줄 요약` 표를 찍은 뒤 FAIL이 하나라도 있으면 종료 코드 1입니다. frame-check와 flash-check는 항상 돕니다. seam-check는 `scripts/seam-check.mjs`와 `<video>.motion.json`(영상 렌더가 옆에 씁니다)이 있을 때 `--prompt`(없으면 `--film` 폴더의 prompt.md)와 함께, narration-check는 그 스크립트와 `--film` 폴더의 `narration.timing.json`이 있을 때 돕니다. 없으면 SKIP과 이유(`scripts/seam-check.mjs 없음`, `narration.timing.json 없음`, `--film 없음`)를 적습니다. 요약은 frame-check의 FAIL 줄(통과면 첫 줄), flash-check의 최악 1초 플래시 수, 나머지는 출력 첫 줄입니다. `--json`은 `[{check, status, detail}]`입니다. 2026-10-24 kit-launch 0-29 렌더: `frame-check PASS / flash-check PASS worst second 0 flashes (limit 3), 0 transitions / seam-check PASS … 0 seam(s) checked / narration-check SKIP narration.timing.json 없음`.

CLI는 엔진을 자기 파일 위치에서, 프로젝트를 현재 폴더에서 위로 올라가며 찾은 `frameforge.json`(`{"engine", "films"}`)에서 찾는다. 엔진 저장소 안(`frameforge.json` 없음)에서는 slug가 `examples/samples/<slug>`를 뜻하고 나머지는 npm 스크립트와 같다. 프로젝트 모드에서는 `FRAMEFORGE_PROJECT`가 Vite의 `server.fs.allow`, 소리·에셋 즉석 생성, 스튜디오 API(`/api/project`, 파일 열기)를 프로젝트의 films 폴더로 돌린다. 생성된 음악(`public/audio/generated/<slug>`), 에셋(`public/assets/generated/<slug>`), 캐시(`.cache`)는 엔진 저장소에 쌓이므로 slug는 엔진 예제와 다른 프로젝트 사이에서도 겹치지 않아야 한다(지금의 제약). 스튜디오 렌더 결과는 프로젝트의 `renders/studio/`에 쓴다.
