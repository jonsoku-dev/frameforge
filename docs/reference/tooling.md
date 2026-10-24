# 박자 격자, 레이아웃 감사, 무음 검출

세 도구의 레퍼런스입니다. 출력 형식(webm, mov, gif, PNG 시퀀스, 알파, 배율)은 [rendering.md](rendering.md), `frameforge check` 표는 [cli.md](cli.md)에 있습니다.

## 박자 격자 (`beatGrid`, `beatsFromSpec`, `loadBeats`)

`src/packages/beats.ts`, `frameforge`에서 가져옵니다. 프레임 값은 정확한 실수입니다(110 BPM의 한 박은 16.36프레임). 컷처럼 정수가 필요한 곳에서 반올림합니다.

```ts
import {beatsFromSpec, useCurrentFrame, useVideoConfig} from 'frameforge';
import spec from './audio.json';

const grid = beatsFromSpec(spec, 30);           // 모듈 수준에서 한 번
const cuts = grid.bars(0, 599).map(Math.round);  // 마디선에 컷
export function Spot() {
  const frame = useCurrentFrame();
  const kick = grid.pulse(frame, 8);             // 박마다 1에서 8프레임에 걸쳐 0으로
  const bar = grid.barAt(frame);                 // 몇 번째 마디인가
  return <div style={{transform: `scale(${1 + 0.04 * kick})`}}>…</div>;
}
```

| 함수 | 뜻 |
| --- | --- |
| `beatGrid({bpm, fps, offsetFrames = 0, beatsPerBar = 4})` | 규칙 격자. `framesPerBeat = fps × 60 / bpm` |
| `beatAt(frame)` / `nextBeat(frame)` | 직전(같은 프레임 포함) 박과 다음 박의 프레임 |
| `beatIndex(frame)` / `barAt(frame)` | 직전 박의 번호(첫 박이 0, 그 앞은 음수)와 그 박이 든 마디 번호 |
| `phase(frame)` | 박 안의 위치 0..1 |
| `pulse(frame, decayFrames)` | 박에서 1, `decayFrames` 뒤 0까지 직선으로 |
| `onBeat(frame, toleranceFrames = 0)` | 박에서 허용 프레임 안인가 |
| `bars(fromFrame, toFrame)` | 구간 안의 마디선 프레임 목록 |
| `beatsFromSpec(audioSpec, fps, beatsPerBar = 4)` | `audio.json` 객체의 `bpm`으로 격자를 만든다. `offsetMs`가 있으면 그 위상, 없으면 아래 "마디선 위상" |
| `loadBeats(json, fps, beatsPerBar = 4)` | `beats.py`가 쓴 `{bpm, offsetMs, beats: ms[]}`. 박 목록을 그대로 쓰고(불규칙해도 됨) 앞뒤는 평균 간격으로 늘린다. 목록이 없으면 규칙 격자 |

마디선 위상. `scripts/assets/score.py`는 편성(어느 악기가 연주하는가)을 마디선에서만 바꾸고, 그 마디선의 위상은 `hits`(가중치 2)와 섹션 시작(가중치 1)이 마디선에 가장 가깝게 오도록 고릅니다. `beatsFromSpec`은 같은 규칙(`barPhaseSeconds`)으로 위상을 계산하므로 Spot의 `bars()`가 음악의 편성 변화와 같은 프레임에 떨어집니다. 예를 들어 120 BPM에 `hits: [2.5, 12.5]`면 마디선은 0.5초부터이고 30 fps에서 `bars(0, 120)`은 `[15, 75]`입니다. kit-launch(`hits: [3, 14]`)는 위상 0이라 `[0, 60, 120, …]`입니다. `audio.json`의 `offsetMs`를 적으면 그 값이 이깁니다.

`hits`와의 관계. `hits`는 음악이 스스로 치는 타격의 초 단위 시각이고 `audio.json`에 적습니다. 타격 자체는 마디선으로 당겨지지 않고 적힌 자리에서 납니다. 그래서 큰 등장은 `hits`의 프레임(`Math.round(hit × fps)`)에 두고, 그 앞뒤 반 초에는 `MotionSound`의 `quiet`로 도출 효과음을 비웁니다([audio-score.md](../audio-score.md)). 박마다 되풀이되는 작은 움직임(살짝 커짐, 밝아짐, 흔들림)은 `pulse`로, 장면 전환은 `bars()`로 맞추면 컷이 음악의 편성 변화와 함께 옵니다. 템포가 바뀌는 음악이나 외부 음원은 `npm run beats -- <파일> --out beats.json`으로 박을 검출해 `loadBeats`로 읽습니다.

`scripts/assets/beats.py <파일> [--out beats.json]`. numpy만 씁니다(파일 디코딩은 ffmpeg). 1024 창·256 홉의 STFT에서 로그 스펙트럼 플럭스를 구하고, 1초 창의 평균과 편차를 넘는 봉우리를 온셋으로 고르며(50 ms 간격), 자기상관에서 60–200 BPM 사이의 주기를 고릅니다(120 BPM 쪽으로 약하게 가중, 반 주기의 증거가 80% 이상이면 빠른 쪽, 포물선 보간). 첫 박 위상은 빗 모양 필터로 온셋 에너지를 가장 많이 모으는 자리이고, 각 박은 박의 1/8 안에 검출된 온셋이 있으면 그리로 붙습니다. 출력은 `{"bpm", "offsetMs", "beats": [ms], "onsets": [ms]}`. `--self-check`는 120·93·150 BPM 클릭 트랙을 합성해 BPM 1 안, 오프셋 25 ms 안, 박 30 ms 안을 확인합니다. 한계: 4/4 고정, 스윙과 박자 변화는 온셋 스냅으로만 따라갑니다.

## 레이아웃 감사 (`findLayoutFaults`)

`src/studio/audit.ts`. 렌더는 프레임마다 `window.__FRAMEFORGE__.audit()`를 불러 글자 잘림(`Clipped text`, 그 프레임은 바로 실패)과 아래 네 가지를 모으고, 렌더 끝에 한 줄 `{"audit": [...]}`로 찍습니다(`code`+`text`로 중복 제거, 첫 프레임 `frame`과 본 프레임 수 `frames`). 영상 렌더에서는 1/4초(30 fps에서 8프레임) 미만으로 보인 지적은 움직임(글자가 들어오는 중, 디졸브)으로 보고 버립니다. 컨택트 시트는 모든 프레임을 보고합니다. `--strict-audit`을 주면 지적이 하나라도 있으면 렌더가 실패합니다.

| code | 조건 | 고치는 법 |
| --- | --- | --- |
| `text_outside_safe` | 보이는 글자(불투명도 0.05 초과, `visibility` visible, 화면 안)의 상자가 가로세로 5% 세이프 영역을 벗어남 | 안으로 옮기거나, 일부러 넘치는 띠에 `data-clip="allow"` |
| `text_overlap` | 두 글자 상자의 겹침이 작은 쪽 넓이의 20%를 넘음 | 시간이나 자리를 띄운다 |
| `contrast_low` | 글자색과 배경의 WCAG 대비가 38px 이상에서 3:1, 그 아래에서 4.5:1 미만. 배경은 글자 상자 중심 아래에 칠해진 요소들(`elementsFromPoint`, 와이프나 카드 같은 형제 레이어 포함)에서 처음 만나는 불투명 `background-color`, 없으면 페이지 배경. 그라데이션·이미지·반투명 배경은 알 수 없어 건너뜀 | 글자나 배경을 밝히거나 어둡힌다 |
| `text_too_small` | 글자 크기가 짧은 변의 3.5% 미만(1080 기준 38px) | 키우거나, 법적 고지 같은 줄에 `data-size="allow"` |

글자 상자는 텍스트 노드의 `Range` 사각형(요소마다 합집합)이라 변환(transform)이 적용된 자리입니다. 투명 렌더(`--transparent`)에서는 페이지 배경을 알 수 없어 배경 없는 글자의 대비는 검사하지 않습니다. 순수 함수 `contrastRatio`, `parseCssColor`(`#hex`, `rgb()`/`rgba()`, `transparent`만), `effectiveBackground`(조상만 보는 판), `paintedBackground`, `rectsOverlap`, `insideSafeArea`, `over`를 내보내고 `tests/render-outputs.test.tsx`가 검사합니다. `tests/fixtures/tooling/`의 Translucent 컴포지션은 네 가지를 하나씩 일부러 갖고 있어 렌더 한 번으로 감사가 도는지 봅니다.

## 무음 검출 (`scripts/silence-detect.mjs`)

```sh
node scripts/silence-detect.mjs <media> [--min 0.5] [--fps 30] [--json]
```

두 번 지나갑니다. 먼저 `loudnorm=print_format=json`으로 입력의 게이트 문턱 `input_thresh`(통합 음량보다 약 10 LU 아래)를 재고, 그 값을 `silencedetect`의 잡음 바닥 `n`으로 써서 `--min`초 이상 이어지는 무음을 찾습니다. 그래서 음성 밑의 룸톤이나 음악 꼬리는 소리로 칩니다. 출력은 앞 무음(초와 시작 프레임), 뒤 무음(초와 끝 프레임), 구간 목록(초와 프레임 범위), 그리고 소리 나는 부분만 남기는 `--frame-range` 제안입니다. `silencedetect`의 경계는 실제 컷에서 몇 ms 어긋나므로 프레임 환산에 10 ms 여유를 둡니다. `--json`은 같은 내용을 `{duration, loudness: {integrated, truePeak}, noiseFloorDb, leading, trailing, segments, trim}`으로 냅니다. 전체가 무음이면 바닥은 -60 dB입니다.

2026-10-24 측정. 1초 무음 + 2초 440 Hz + 1초 무음(4초) 파일에서 바닥 -32.57 dB, 앞 무음 1 s(프레임 30), 뒤 무음 1 s(끝 프레임 89), 구간 `0-1 s (frames 0-29), 3-4 s (frames 90-119)`, 제안 `--frame-range 30-89`.
