# 렌더링

README에서 옮긴 렌더러 레퍼런스입니다. 측정값과 실행 결과는 적힌 날짜의 기록입니다. 명령 도움말은 `node scripts/render.mjs --help`로 봅니다.

## MP4

독립 CLI `scripts/render.mjs`는 설치 의존성 없이 동작합니다. Node 24의 내장 `WebSocket`으로 Chrome DevTools Protocol에 직접 붙어 프레임마다 `renderFrame`을 호출하고 PNG를 캡처한 뒤 시스템 FFmpeg로 H.264를 만듭니다. `puppeteer-core`는 더 이상 필요 없습니다. Chrome/Chromium과 FFmpeg만 있으면 됩니다. 소리가 있는 작품은 렌더 전에 진입 파일 폴더의 `audio.json`에서 오디오를 생성하므로 Python 3와 numpy도 필요합니다. 저장소에 커밋된 오디오는 없습니다.

```sh
npm run render -- examples/samples/cafe-morning/entry.tsx CafeMorning renders/cafe-morning.mp4
npm run render -- examples/samples/kit-launch/entry.tsx KitLaunch renders/kit-launch.mp4
```

정지 화면 검사용 컨택트 시트는 같은 명령에 `--frames`를 붙입니다. 영상 대신 PNG 한 장이 나옵니다.

```sh
npm run render -- examples/samples/cafe-morning/entry.tsx CafeMorning renders/cafe-morning-sheet.png --frames 30,120,240,360,480,570
```

2026-10-20 실행 결과. 아래 첫 측정 대상인 20초 TV 스팟은 실제 브랜드를 써서 공개판에서 빠졌고, 그 수치는 기록으로만 남깁니다. 그 스팟의 MP4는 H.264(bt709 태그, crf 18) + AAC 48 kHz 스테레오, 1920×1080, 30 fps, 600 frames, 20초, 약 48초 소요. 최종 믹스 통합 음량 −25.0 LKFS, 트루 피크 −6.7 dBTP(국내 TV 기준 −24 ±2 안). 복호 색 검증: 디코드한 프레임의 초록이 `[4,198,82]`(목표 `#06C755` = `[6,199,85]`), 종이 `[242,242,239]`, 검정 `[16,16,16]`. 태그 없이 인코딩하면 같은 초록이 `[0,172,81]`로 어두워진다. 방송 플래시 검사 `node scripts/flash-check.mjs <그 MP4>` 통과(1초 창 최대 전환 3회, 허용 6회). Ofcom 지침의 근사이지 Harding 인증은 아니다. ffprobe로 확인했습니다. 렌더 중 글자 잘림 검사가 한 프레임이라도 실패하면 인코딩 없이 중단됩니다.

`CHROME_PATH`, `FFMPEG_PATH`로 설치 경로를 지정할 수 있습니다. 렌더러는 loopback 서버(4318, HMR 꺼짐)와 임시 Chrome 프로필을 사용하고, 글꼴·이미지·`delayRender` 핸들을 기다린 뒤 PNG 프레임을 H.264로 인코딩합니다. 기존 출력은 덮어쓰지 않습니다. 성공한 인코딩만 최종 파일로 옮깁니다. 오디오 믹싱은 구현했습니다(상수 볼륨, 앞뒤 자르기, `Video` 소리의 `atempo` 배속). 병렬 렌더링은 "결정성 린트와 병렬 렌더" 절을 보세요.

소리가 포함되는 출력에서 모션 효과음의 길이는 `FFPROBE_PATH`(미지정 시 `ffprobe`)로 확인합니다. 실행 실패, `-v error` 진단 출력 또는 길이가 비어 있거나 0 이하·비유한이면 임의 길이로 대체하지 않고 렌더를 실패시킵니다. 종료 코드가 0이어도 진단이 있으면 보수적으로 실패하므로 사용자 지정 probe 역시 정상 실행 시 stderr를 비워야 합니다. `--muted`, `--audio-codec none`과 GIF·PNG처럼 소리가 없는 출력은 모션 효과음 길이를 확인하거나 믹스하지 않습니다. 길이 확인은 전체 오디오 디코딩 검사가 아니며 probe가 보고하지 않는 손상까지 검출한다고 보장하지 않습니다.

부분 렌더는 출력 범위 이전의 모션 이력을 수집하지 않으므로, 범위 시작 전에 발생한 모션 효과음의 꼬리는 빠질 수 있습니다. 이를 복구하는 전체 시간축 분석은 범위 밖 미디어 접근을 안전하게 제한할 수 있을 때까지 지원하지 않습니다.

## 기존 전체 믹스로 부분 렌더하기

외부 프로젝트의 자동 생성 오디오는 현재 공용 엔진 경로의 프로젝트 간 덮어쓰기와 잘못된 파일 사용을 막기 위해 차단됩니다. `audio.json` 또는 `narration.json`이 있으면 일반 렌더의 자동 생성도 실패합니다. 사용자가 직접 준비한 `<프로젝트>/public/music.wav`는 `<Audio src="/music.wav" />`로 지정할 수 있으며 같은 이름의 엔진 파일보다 우선합니다. 프로젝트 미디어 경로의 심볼릭 링크는 허용하지 않습니다. 검사와 열기는 별도 호출이므로 같은 사용자 권한의 동시 경로 교체까지 원자적으로 막지는 못합니다. 명시적으로 준비한 전체 믹스 스냅샷을 쓰는 부분 렌더는 자동 생성을 실행하지 않습니다. 이는 프로젝트별 생성 기능을 구현한 것이 아니며, 일반 프로젝트 미디어와 임의 사용자 코드 전체를 격리한다는 보장도 아닙니다. 이미지·3D 생성물의 공용 경로는 이 오디오 보호 범위 밖입니다.

스냅샷 없는 오디오 포함 부분 렌더는 범위 밖 프레임을 분석하지 않으므로 이전에 시작한 모션 효과음이 빠질 수 있습니다. 이 경우 결과와 motion sidecar의 `audioContext.status`는 `NOT_VERIFIED`입니다.

부분 구간 전에 시작한 효과음의 잔향이 필요할 때, 이미 생성한 전체 작품의 믹스를 명시적으로 선택할 수 있습니다. 다음은 프로젝트 루트에서 실행하는 예입니다. 전체 영상과 구성이 일치하는지 확인하는 책임은 사용자에게 있습니다.

```sh
mkdir -p snapshots
ffmpeg -n -i renders/full.mov -map 0:a:0 -c:a pcm_s16le -ar 48000 -ac 2 snapshots/full.wav
frameforge audio-snapshot-prepare snapshots/full.wav Demo 30 90 --output snapshots/full.json
frameforge render demo Demo renders/part.mov --frame-range 31-46 --audio-snapshot snapshots/full.wav --audio-snapshot-manifest snapshots/full.json
```

생성 명령의 숫자는 전체 컴포지션의 fps와 전체 프레임 수입니다. 이미 존재하는 WAV에서 SHA-256과 사용자가 지정한 구성 정보를 기록하고, 매니페스트를 새 파일로만 생성합니다. 같은 디렉터리에 임시 파일을 완성한 뒤 새 이름으로 게시하며 기존 파일은 덮어쓰지 않습니다. 게시 직후 열린 임시 파일과 최종 경로의 inode·내용을 확인합니다. 같은 사용자 권한의 경로 교체를 완전히 원자적으로 막지는 못하며, 다른 파일로 바뀌었다면 이를 삭제하지 않고 오류를 보고합니다. SIGTERM 중단 시 생성 중인 임시 매니페스트를 정리하지만 SIGKILL·시스템 종료 때는 남을 수 있습니다. 실제 전체 렌더에서 왔는지, 현재 소스·입력·에셋과 같은지 자동으로 증명하지 않습니다. 렌더 결과는 스냅샷 경로, SHA-256, 구성 정보와 적용 프레임, `semanticMatch: NOT_VERIFIED`를 보고합니다. 수동으로 JSON을 만들 필요는 없습니다.

두 경로는 프로젝트 기준 상대경로여야 하며 심볼릭 링크나 프로젝트 밖 경로는 거부합니다. POSIX `openat`/`/dev/fd`, Python 3, FFmpeg와 FFprobe가 필요하고 Windows는 지원하지 않습니다. 단일 PCM WAV 스트림, 정확한 구성 ID·fps·전체 길이와 포함 구간을 검사하며 불일치하거나 확인할 수 없으면 실패합니다. WAV 크기는 헤더를 포함하여 512 MiB 이하여야 합니다(48 kHz 스테레오 16비트에서 대략 46.6분). WAV 전체를 읽어 SHA를 확인하고 임시 복사본을 만드므로 시간과 디스크 공간이 필요합니다. 스테이징과 probe에는 각각 120초와 30초 제한이 있습니다. probe는 전체 디코딩 검사가 아닙니다. 스냅샷 mux는 FFmpeg의 error 진단 또는 오류 종료를 실패로 처리하지만, 선택 구간에서도 디코더가 진단하지 않는 손상은 검출한다고 보장하지 않습니다.

이 옵션은 오디오 복구를 위해 출력 범위 밖 React 프레임을 추가 평가하지 않으며 score·voice·art의 자동 생성과 Vite의 요청 시 자동 생성을 끕니다. 범위 안에 필요한 자산은 미리 준비해야 합니다. 일반 렌더에서 실행하는 범위 내 사용자 코드가 수행하는 파일·네트워크 요청과 기존 비디오 프레임 선추출은 통제하거나 검사하지 않습니다. WAV 전체 바이트는 해시와 복사를 위해 읽습니다. 같은 사용자 권한의 다른 프로세스가 스테이징된 열린 파일의 내용을 인코딩 도중 바꾸고 검사 전 복원하는 경우까지 차단하지 못합니다. snapshot 렌더가 SIGTERM을 받으면 열린 디렉터리에서 확인된 스냅샷 파일을 지우고 빈 디렉터리만 제거합니다. 신원을 확인할 수 없거나 경로가 바뀐 경우에는 남기고 오류를 보고합니다. 같은 사용자에 의한 inode 확인과 unlink 사이의 극단적인 경쟁까지 원자적으로 막지는 못합니다. MCP 취소는 프로세스 그룹에 신호를 보내지만 렌더러에만 직접 보낸 SIGTERM이 모든 자손 프로세스를 종료한다고 보장하지 않습니다. SIGKILL·시스템 종료 또는 정리 실패 시 임시 사본이 남을 수 있습니다.

이 옵션은 부분 `--frame-range`와 오디오가 있는 출력에서만 사용할 수 있습니다. `--muted`, `--audio-codec none`, GIF·PNG·프레임 시트 및 전체 범위와 결합할 수 없으며, 실패 시 일반 믹스로 대체하지 않습니다. FFmpeg가 구간을 자르고 출력 코덱으로 다시 인코딩하므로 샘플 레이트 변환, 시간 반올림, 손실 코덱의 차이가 생길 수 있습니다. 실제 청취와 현재 구성과의 의미적 일치는 별도로 확인해야 합니다.

## 출력 형식, 알파, 배율

출력 경로의 확장자가 컨테이너를 정하고, `--codec`이 코덱을 바꿉니다. 모든 형식에서 `--frame-range`, `--concurrency`, `--pipe`, `--frames` 시트, `--check-idempotent`, `<출력>.motion.json`이 같이 동작합니다(gif와 PNG 시퀀스는 한 청크로 렌더하고 `--concurrency`·`--pipe`를 무시한다고 알립니다).

| 출력 | 비디오 | 소리 기본 | `--transparent` 픽셀 형식 | 청크 |
| --- | --- | --- | --- | --- |
| `.mp4` | libx264 crf 18 (기본, 이전과 같음) | aac 192k | 불가(오류) | concat `-c copy` |
| `.webm` | libvpx-vp9 `-b:v 0 -crf 32 -row-mt 1` | libopus 160k | yuva420p (`-auto-alt-ref 0`) | concat `-c copy` |
| `.mov` | prores_ks 프로파일 4(4444) yuv444p10le | pcm_s16le | yuva444p10le | concat `-c copy` |
| `.gif` | palettegen → paletteuse(bayer), `--gif-fps N`으로 프레임률 제한 | 없음 | 팔레트의 투명 칸 | 한 청크 |
| `.m3u8` | HLS VOD: libx264 crf 18, 4초마다 키프레임(`-force_key_frames expr:gte(t,n_forced*4)`), `-f hls -hls_time 4 -hls_playlist_type vod`, 조각은 재생목록 옆 `<이름>_%03d.ts` | aac 192k | 불가(오류) | 한 청크 |
| `폴더/` 또는 `…/%05d.png` | PNG 그대로(인코딩 없음), 프레임 번호로 이름 | 없음 | rgba | 한 청크 |

- `--audio-codec aac|opus|pcm|none`은 소리 코덱을 바꾸고 `--muted`는 믹스를 건너뜁니다. `--crf N`은 h264와 vp9의 품질입니다. 모든 코덱에 bt709 태그와 변환이 붙습니다.
- `--transparent`는 페이지 배경을 비우고(CDP `Emulation.setDefaultBackgroundColorOverride` {0,0,0,0}과 `html`/`body` 배경 transparent) PNG를 알파째 캡처합니다. 루트에 불투명 배경이 있는 작품은 당연히 불투명하게 나옵니다. `Experimental.Null` 프레임도 투명 RGBA로 만듭니다.
- `--scale S`는 Chrome의 기기 배율을 S로 두어 S배 크기로 캡처하고(1920×1080에 2면 3840×2160), ffmpeg에 같은 크기의 `scale`을 앞에 붙입니다. 가로세로가 정수가 아니면, h264와 vp9에서 홀수면 오류입니다. frame-check와 flash-check는 크기를 읽어 그대로 동작합니다.
- PNG 시퀀스의 motion.json은 그 폴더 안 `motion.json`입니다.
- `.m3u8`은 재생목록 하나를 쓰므로 gif처럼 한 청크로 렌더하고 `--concurrency`와 `--pipe`는 무시한다고 경고합니다. 재생목록은 조각을 경로 없이 이름(`kit_000.ts`)으로 적으므로 폴더째 옮겨도 재생됩니다. 게시는 같은 파일 시스템의 하드 링크로 하며, 조각을 먼저 걸고 재생목록을 마지막에 겁니다. 같은 이름의 파일이 이미 있으면 덮어쓰지 않고 실패합니다.
- 순수 함수 `outputFormat(output, options)`, `videoArgs(format, count, size?)`, `encodeArgs(...)`, `AUDIO`를 내보내고 `tests/render-outputs.test.tsx`가 검사합니다.

2026-10-24 실행 결과(`tests/fixtures/tooling` Translucent 640×360, 루트에 배경 없음, `--frame-range 0-29 --transparent`): `.webm` → ffprobe `codec_name=vp9 … pix_fmt=yuv420p TAG:alpha_mode=1`(이 빌드의 기본 VP9 디코더는 알파 평면을 열지 않아 yuv420p로 보고하고, 알파는 Matroska `alpha_mode` 태그와 별도 스트림에 있습니다). `.mov` → `codec_name=prores profile=4444 pix_fmt=yuva444p12le nb_frames=30`(디코더가 12비트로 올려 보고; 인코드 입력은 yuva444p10le), 알파 평면 `alphaextract,signalstats` YMIN 256(완전 투명) YMAX 3773(불투명) YAVG 570. `.gif --gif-fps 15` → `codec_name=gif pix_fmt=bgra r_frame_rate=15/1`, 15프레임. `폴더/` → `00000.png`–`00029.png` + `motion.json`, `pix_fmt=rgba`, 15번 프레임 알파 YMIN 0 YMAX 255. `--scale 2` → 1280×720 vp9. kit-launch 0-59 `.mov --pipe` → prores 4444 60프레임 + pcm_s16le 48 kHz 스테레오, 10.0초. kit-launch 0-119 `.webm --concurrency 2` → 청크 2, vp9 120프레임 + opus 48 kHz, 4.008초, 26.0초 소요. 레이아웃 감사(`{"audit": [...]}`)는 [tooling.md](tooling.md)에 있습니다.

## 결정성 린트와 병렬 렌더

- 정적 린트: `npm run lint:video -- <entry.tsx>`(`scripts/lint.mjs`)는 진입 파일과 상대 경로로 가져온 `.ts`/`.tsx`/`.css`를 읽고 `{entry, files, findings: [{code, severity, file, line, message, fixHint}]}` JSON을 냅니다. `error`가 하나라도 있으면 종료 코드 1입니다. 코드는 `unseeded_random`(`Math.random(`), `wall_clock`(`Date.now(`, 인자 없는 `new Date()`, `performance.now(`, `requestAnimationFrame(`, `setInterval(`은 오류, `setTimeout(`은 `delayRender`와 함께 쓰는 일이 많아 경고), `css_time_animation`(스타일 객체나 CSS의 `transition`/`animation` 계열 속성, `@keyframes`, 값이 `none`이면 통과), `effect_driven_state`(`useEffect`/`useLayoutEffect` 안에서 `useState` 설정 함수를 부르는데 `delayRender`/`continueRender`가 없음, 경고)입니다. 주석은 무시합니다. `frameforge`, `@/`, 패키지는 엔진과 라이브러리라 따라가지 않습니다. 컴포넌트 안팎을 가리지 않고 파일 전체를 봅니다. `examples/samples/*/entry.tsx` 44개는 모두 지적 0건입니다(2026-10-20).
- 런타임 멱등성: `--check-idempotent`는 렌더 전에 별도 Chrome에서 출력할 첫·가운데·마지막 프레임을 두 번씩 캡처해 PNG 바이트를 비교하고, 다르면 `frame_not_idempotent: frame N ...`으로 멈춥니다. 사건이나 전환 프레임을 확인하려면 `--check-idempotent --idempotent-frames 0,30,120,240`을 사용합니다. 이 옵션은 출력할 프레임 중 검사할 목록을 바꾸며 영상 대신 시트를 만들지 않습니다. `renderMedia({checkIdempotent: true, idempotentFrames: [0, 30, 120, 240]})`도 같습니다. 중복은 제거하고 입력 순서를 유지하며, 빈 목록·잘못된 숫자·출력 범위 밖 프레임은 오류입니다. 성공 JSON의 `idempotentFrames`가 실제 확인한 프레임입니다. 표본 이외의 프레임은 검사되지 않으며, 표본이 많을수록 캡처 시간이 늘어납니다. 불일치 원인은 상태 의존 값뿐 아니라 리소스 준비나 서브픽셀 래스터화일 수도 있으므로 해당 프레임을 조사합니다.
- 범위와 병렬: `--frame-range a-b`(포함 구간)와 `--concurrency N`(청크 하나가 Chrome 문제로 실패하면 새 브라우저로 한 번 재시도; 작품 오류는 재시도하지 않음)(기본 1). `renderMedia({frameRange: [a, b], concurrency})`도 같습니다. N이 2 이상이면 구간을 2초 이상인 연속 청크 최대 N개로 나누고(길이 차이 최대 1프레임), 청크마다 자기 프로필의 헤드리스 Chrome이 하나의 Vite 서버를 공유해 PNG를 찍고, 같은 설정으로 청크 MP4를 인코딩한 뒤 concat demuxer로 재인코딩 없이 잇습니다. 오디오는 청크마다 모은 클립 구간을 키와 첫·끝 프레임으로 이어 붙여 전체 길이에 한 번 섞습니다. 움직임에서 나오는 소리는 전체 프레임 순서가 필요하므로, 첫 청크의 Chrome이 자기 청크를 마친 뒤 나머지 프레임을 캡처 없이 다시 그려 계산합니다(병렬 이득의 상당 부분을 여기서 씁니다).
- 스트리밍 인코딩: `--pipe`는 PNG를 디스크에 쓰지 않고 ffmpeg stdin(`image2pipe`)으로 보냅니다. 기본은 디스크 경로입니다.
- 정지 프레임: 캡처한 PNG의 SHA-1이 직전 프레임과 같으면 디스크에서는 새로 쓰지 않고 하드 링크합니다. 캡처는 항상 합니다. 결과 JSON에 `identicalFrames`, `identicalShare`가 나옵니다.
- 대조: `node scripts/snapshot-diff.mjs --against <old.mp4> <new.mp4> [--threshold 40]`는 ffmpeg `psnr` 필터로 프레임별 PSNR의 최소·중앙·평균, 같은 프레임 수, 기준 아래 첫 프레임을 JSON으로 내고, 기준 아래 프레임이 있거나 프레임 수가 다르면 종료 코드 1입니다.
- 다른 렌더와 동시에 돌릴 때는 `FRAMEFORGE_PORT=4319`처럼 Vite 포트를 바꿉니다(기본 4318).
- 측정(2026-10-20, `examples/samples/cafe-morning` 600프레임 1080p, 다른 렌더 작업과 CPU를 나눠 쓰는 중이라 부하 평균 5–9): 동시성 1 디스크 48.7초·48.4초, 동시성 1 `--pipe` 45.0초, 동시성 3 디스크 35.6초, 동시성 3 `--pipe` 34.1초. 네 결과 모두 600프레임, 20.000초, AAC 938패킷. 동시성 1 대비 동시성 3의 프레임별 PSNR은 최소 45.96dB·평균 57.84dB(같은 프레임 279개), 소리 스트림은 바이트까지 같습니다. 같은 설정 두 번(동시성 1)끼리도 최소 52.32dB라 캡처 자체가 실행마다 조금 다릅니다. 동일 프레임 비율 0.488. `--frame-range 300-419` 출력은 전체 렌더의 같은 구간과 최소 53.96dB입니다.
