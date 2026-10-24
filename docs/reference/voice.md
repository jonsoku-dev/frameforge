# 내레이션과 자막

말이 있는 작품은 **대사를 먼저** 쓴다. 대사를 읽혀 길이를 재고, 장면은 그 길이에서 나온다. 순서는 대사 → 목소리 → 타이밍 → 장면이다. 자막은 장면 위에 얹는 오버레이이고, 장면이 대사 중간에서 바뀌면 검사가 막는다.

## 파일

| 파일 | 역할 | 커밋 |
| --- | --- | --- |
| `examples/samples/<slug>/narration.json` | 대사 사양 | 한다 |
| `examples/samples/<slug>/narration.timing.json` | `npm run voice`가 잰 결과. Spot이 `import timing from './narration.timing.json'`으로 읽는다 | 한다(작다) |
| `public/audio/generated/<slug>/voice.wav` | 이어 붙인 목소리. 48 kHz 스테레오, −16 LUFS | 안 한다 |
| `public/audio/generated/<slug>/voice/<hash>.wav`, `manifest.json` | 줄 단위 캐시와 생성 기록 | 안 한다 |

## 사양 `narration.json`

```json
{
  "slug": "narrated-explainer",
  "language": "ko",
  "voice": {"provider": "auto", "name": "Yuna"},
  "rate": 1.0,
  "leadMs": 600,
  "gapMs": 420,
  "lines": [
    {"id": "hook", "text": "하루에 쓰는 시간을 숫자 하나로 볼 수 있을까요?", "emphasis": ["숫자 하나로"]},
    {"id": "define", "text": "예시 지수는 집중한 시간을 전체 시간으로 나눈 값입니다.", "embed": "집중", "pauseMs": 700}
  ]
}
```

| 필드 | 뜻 |
| --- | --- |
| `slug` | 폴더 이름과 같아야 한다 |
| `language` | `ko`, `en`, `ja`. 기본 목소리와 무음 추정 속도를 정한다 |
| `voice.provider` | `auto`(기본), `elevenlabs`, `kokoro`, `say`, `silent`. `auto`는 아래 순서로 처음 되는 것을 쓴다. 하나를 지정하면 그것만 쓰고, 안 되면 이유를 말하고 멈춘다 |
| `voice.name` | 선택. `say`의 목소리 이름, kokoro의 voice id, ElevenLabs의 voice id |
| `rate` | 선택. 속도 배수 0.5–2. `say`는 분당 180단어 × rate, kokoro는 `speed`, ElevenLabs는 `voice_settings.speed` |
| `leadMs` | 선택. 첫 줄 앞 무음(기본 0) |
| `gapMs` | 선택. 줄 사이 기본 쉼(기본 400) |
| `lines[].id` | 소문자 슬러그. Spot에서 `at('hook')`로 부른다 |
| `lines[].text` | 읽을 문장 그대로. 자막에도 그대로 나간다 |
| `lines[].pauseMs` | 선택. 이 줄 뒤 쉼(`gapMs` 대신) |
| `lines[].emphasis` | 선택. 자막에서 accent 밑줄로 강조할 구절(본문에 있어야 한다) |
| `lines[].embed` | 선택. 피사체 뒤에 크게 띄울 한 단어. 줄마다 하나까지, 이웃한 줄에 연달아 두지 않는다 |

## 생성기 `npm run voice -- examples/samples/<slug>/narration.json`

`scripts/assets/voice.py`. 한 번 실행에 생성기 하나를 고른다.

| 순서 | 생성기 | 조건 | 비고 |
| --- | --- | --- | --- |
| 1 | `elevenlabs` | `ELEVENLABS_API_KEY` | `POST /v1/text-to-speech/<voice>?output_format=pcm_48000`, `eleven_multilingual_v2`. 키는 환경 변수로만 읽고 어디에도 쓰지 않는다 |
| 2 | `kokoro` | `pip install kokoro-onnx`와 모델 파일(`KOKORO_MODEL`, `KOKORO_VOICES`, 기본 `~/.cache/frameforge/kokoro/`) | 영어와 일본어만. 한국어는 건너뛴다 |
| 3 | `say` | macOS | `say -v <voice> -o line.wav --data-format=LEF32@48000`. 기본 목소리 ko Yuna, ja Kyoko, en Samantha. 목록은 `say -v '?'` |
| 4 | `silent` | 항상 | 글 길이로 잰 무음. 한국어 5음절/초, 영어 2.5단어/초, 일본어 6자/초. 타이밍에 `estimated: true` |

줄마다 `(생성기, 목소리, 언어, rate, 본문)`의 해시로 `voice/<hash>.wav`를 캐시한다. 바뀌지 않은 줄은 다시 읽지 않는다. `--force`는 전부 다시 읽는다. 줄은 −45 dB 아래 앞뒤 무음을 잘라 60 ms씩 남기고, 길이는 ffprobe로 잰다. `leadMs`, 줄, 쉼 순으로 이어 붙여 피크 −3 dBFS로 맞춘 뒤 ffmpeg loudnorm으로 −16 LUFS(TP −3)로 맞추고, 샘플 수를 `totalMs`에 고정한다. 무음 생성기의 결과는 정규화하지 않는다.

이 Mac에서 `say`는 같은 문장에 같은 바이트를 두 번 냈다. 다른 macOS 판에서는 몇 ms가 달라질 수 있으니 `--force` 뒤에는 `narration.timing.json`의 변화를 확인한다.

`--self-check`는 무음 생성기로 임시 사양을 돌려 시작·끝·합계가 맞는지, `voice.wav` 길이가 `totalMs`인지, 두 번째 실행이 모두 캐시 히트인지, `--force`가 다시 만드는지 확인한다.

## 결과 `narration.timing.json`

```json
{"slug": "narrated-explainer", "provider": "say", "voice": "Yuna", "totalMs": 26299,
 "lines": [{"id": "hook", "text": "…", "startMs": 600, "endMs": 3615, "estimated": false, "emphasis": ["숫자 하나로"]}]}
```

생성 시각은 넣지 않는다. 같은 사양은 같은 파일을 낸다. `emphasis`와 `embed`는 자막이 읽도록 사양에서 그대로 옮긴다.

## Spot에서 쓰기 (`frameforge`에서 가져온다)

```tsx
import timing from './narration.timing.json';
const n = useNarration(timing);
const at = {define: n.at('define'), formula: n.at('formula')};
<Voiceover src="/audio/generated/<slug>/voice.wav" />
<Subtitles timing={timing} fonts={{display, ui}} palette={{ink, paper, accent}} radius={18} />
```

| 이름 | 하는 일 |
| --- | --- |
| `NarrationTiming`, `NarrationLine` | timing.json의 형 |
| `narrationFrames(timing, fps)` | 줄마다 `startFrame`, `endFrame`, `durationInFrames`와 `total` |
| `useNarration(timing)` | `useVideoConfig`의 fps와 `useCurrentFrame`으로 `{lines, total, current, index, progress, at(id), line(id)}`. `at`은 시작 프레임, `line`은 줄 전체. 없는 id는 오류 |
| `<Voiceover src volume />` | `voice.wav`의 `<Audio>`. 루트에 하나 |
| `<Subtitles timing style="rail"｜"embed" position maxChars fonts palette size radius />` | `rail`(기본): 대사를 그대로, 하단 10% 안쪽 가운데, 단어가 줄의 앞 60% 동안 차례로 나타나고(판은 드러난 단어만 감싸며 가운데 정렬), `emphasis`는 paper 글자에 accent 밑줄, 판은 ink와 paper를 82:18로 섞은 불투명 색, 모서리는 `radius`. `maxChars`(기본 24)를 넘으면 가운데 가까운 띄어쓰기에서 두 줄. 다음 줄이 오기 전 0.5초까지 남고, 마지막 줄은 목소리와 함께 사라진다. `embed`: 현재 줄의 `embed` 단어 하나를 아주 크게(기본 짧은 변의 46%) 가운데에, 10프레임 들어오고 8프레임에 나간다. 피사체 **아래**에 마운트한다 |
| `<SubtitleLine line reveal fonts palette size radius maxChars />` | 위치 없는 레일 한 줄. 직접 배치할 때 |
| `captionsFromTiming(timing)` | 줄마다 `Caption` 하나. `serializeSrt({lines: captions.map(c => [c])})`로 .srt |

자막은 오버레이다. 장면은 프레임 중앙에 그대로 두고, 자막 자리를 비우려고 올리지 않는다. 작은 글자(라벨)만 아래 자막 띠(두 줄이면 세로 76%부터)에서 뺀다. 원칙은 `skills/frameforge-best-practices/references/captions.md`.

## 수식 `<Formula>`

`<Formula tex display size color draw highlight highlightColor />`는 KaTeX로 그린다. `draw` 0–1은 왼쪽부터 드러내고(`clip-path`), `highlight`는 `tex` 안의 부분 문자열을 `\htmlClass`로 감싸 `highlightColor`로 칠한다. 파싱 오류는 `Formula could not parse "<tex>": …`로 던져 렌더가 멈춘다. 브라우저에서는 KaTeX 스타일시트를 한 번 읽고 KaTeX 글꼴이 모두 로드될 때까지 `delayRender`로 프레임을 잡는다. JSX 속성 문자열은 이스케이프를 해석하지 않으므로 `tex="\frac{a}{b}"`처럼 백슬래시 하나로 쓴다.

## 검사 `npm run narration-check -- examples/samples/<slug> [--scenes 0,121,253 | --prompt prompt.md] [--fps 30] [--rate-ko 8] [--json]`

`narration.timing.json`을 읽고 실패하면 종료 코드 1. 언어는 `narration.json`에서, 길이는 `entry.tsx`의 `durationInFrames={…}`에서 읽는다. `--prompt`는 `prompt.md`의 표에서 각 행의 첫 정수 칸(`120` 또는 `120–240`의 120)을 장면 시작으로 읽는다.

| 코드 | 조건 | 고치기 |
| --- | --- | --- |
| `line_overlap` | 다음 줄이 앞 줄이 끝나기 전에 시작 | `npm run voice`를 다시 돌리거나 `gapMs`를 올린다 |
| `line_too_fast` | 읽기 속도 초과. 한국어 8음절/초, 영어 4단어/초, 일본어 7자/초(`--rate-<lang>`) | 줄을 나누거나 `rate`를 1 아래로 |
| `line_past_end` | 줄이 컴포지션 길이 뒤에 끝남 | `durationInFrames`를 끝 + 60 이상으로 |
| `scene_inside_line` | 장면이 줄의 시작이 아닌 중간에서 시작 | `at(id)`에서 시작하거나 다음 줄까지 유지 |
| `embed_adjacent` | 이웃한 두 줄이 모두 `embed` | 하나를 뺀다 |
| `voice_missing` | 타이밍이 측정값인데 `voice.wav`가 없음 | 렌더 전에 `npm run voice` |
| `line_empty` | 끝이 시작보다 앞 | 본문을 채우고 다시 생성 |

## 아직 없는 것

- 렌더러(`scripts/render.mjs`)와 개발 서버는 `audio.json`만 자동 생성한다. `voice.wav`는 렌더와 스튜디오 전에 `npm run voice`로 만들어야 한다.
- 렌더러는 0프레임에 시작하는 모든 클립을 음악으로 묶어 효과음 아래로 덕킹한다. 목소리 아래로 음악을 줄이는 덕킹은 아직 없어, 샘플은 음악 `<Audio volume={0.45}>`로 낮춰 둔다.
