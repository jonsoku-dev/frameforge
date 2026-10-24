# 데이터·코드·다이어그램 블록

`src/blocks/charts.tsx`, `src/blocks/code.tsx`, `src/blocks/diagrams.tsx`의 블록 레퍼런스입니다. 모두 `import {BarChart} from '@/blocks'`로 가져오는 순수 프레임 함수 컴포넌트입니다. 글자·자막·카드 블록은 같은 폴더의 다른 파일에 있고, 전체 목록은 `CATALOG`(`src/blocks/catalog.ts`)에 있습니다. 쓰는 예는 `examples/samples/data-reel/Spot.tsx`입니다.

## 공통 계약

| prop | 뜻 |
| --- | --- |
| `frame` | 장면이 넘겨주는 현재 프레임. 블록은 `useCurrentFrame()`을 부르지 않는다 |
| `at` | 시작 프레임(절대값). 그 전에는 아무것도 그리지 않는다(`null`) |
| `out` | 선택. 이 프레임부터 사라진다. 직전 8프레임 동안 투명해진다 |
| `duration` | 선택. 주 애니메이션 길이(프레임). 블록마다 기본값이 다르다(아래 표) |
| `fps` | 기본 30. 스프링 계산에만 쓴다 |
| `palette` | `{ink, paper, accent, soft}`. 색은 이 넷과 그 혼합에서만 나온다 |
| `fonts` | `{display, ui}`. `googleFont()`가 돌려준 font-family 문자열. 숫자는 `display`, 라벨은 `ui`. `CodeBlock`은 `mono`를 더 받는다 |
| `size` | 기준 px. 짧은 변의 3.5%(1080 기준 38)가 하한이며 라벨 글자 크기가 된다. 기본 38 |
| `stroke` | 선 굵기. 기본 `size × 1.5/3.5`(38이면 16.3). 축·연결선·체크가 모두 이 굵기다 |
| `radius` | 모서리 반지름 하나. 기본 `size × 0.4` |
| `x`, `y`, `width`, `height` | 부모 안의 절대 위치와 크기(px). 블록은 `position: absolute` 상자다 |
| `id` | 선택. `MotionProbe` 키. 기본 `<block>-<at>`. 같은 `at`에 같은 블록을 둘 두면 지정한다 |
| `example` | 차트만. 기본 `true`, 오른쪽 위에 샘플 태그 알약을 붙인다. 글자는 `lang` 또는 차트 라벨의 문자 체계로 Sample, サンプル, 예시 중 하나이고, 문자열을 주면 그 글자다. 작품에서 한 번만 켜거나 각주 하나로 대신한다 |
| `lang` | 차트만. `'en' \| 'ja' \| 'ko'`. 태그 글자의 언어 |

모든 움직임은 `frameforge`의 `interpolate`, `spring`, `Easing`에서 나오고, 선은 `evolvePath`로 길이를 따라 그려집니다. 글자는 `<svg>` 밖의 HTML에 두어 글자 잘림 검사가 걸리지 않게 했고, 숫자는 `tabular-nums`입니다. 막대·경로는 `MotionProbe` family `shape`, 패널·행은 `card`로 보고하므로 `<MotionSound families={['shape', 'card']}>`가 소리를 받습니다.

## 차트 (`charts.tsx`)

### BarChart

막대가 기준선에서 시차를 두고 자라고, 값 라벨이 같이 올라가며 세고, 목표선은 막대가 내려앉은 뒤 왼쪽에서 그려집니다. 목표선이 있으면 오른쪽에 `size × 4`만큼 라벨 자리를 비웁니다.

| prop | 뜻 |
| --- | --- |
| `data` | `{label, value}[]` |
| `max` | 선택. 축 최댓값. 기본은 최댓값(목표 포함)의 1.1배 |
| `target` | 선택. 목표선 값. 라벨 `목표 N` |
| `unit` | 선택. 숫자 뒤 단위(`만`, `%`) |
| `duration` | 기본 60 |

```tsx
<BarChart frame={frame} at={70} out={150} palette={palette} fonts={fonts} size={43} x={160} y={240} width={1600} height={760}
  data={[{label: '1월', value: 42}, {label: '2월', value: 51}]} target={60} unit="만" />
```

### LineChart

축이 먼저 그려지고 선이 길이를 따라 그려지며 앞머리에 점이 달립니다. 면은 선이 반쯤 갔을 때 투명도 0.18로 떠오릅니다. y축에는 `min`·`max` 눈금 둘, x축에는 점마다 라벨, 앞머리 위에는 마지막 값이 세며 올라갑니다.

| prop | 뜻 |
| --- | --- |
| `data` | `{label, value}[]` |
| `max`, `min` | 선택. 기본 최댓값 × 1.1, 0 |
| `area` | 기본 `true` |
| `unit` | 선택 |
| `duration` | 기본 60 |

### BarChartRace

스냅샷 사이에서 순위가 바뀝니다. 각 막대의 y는 이웃한 두 스냅샷의 순위 사이를, 너비는 값 사이를 이징으로 보간하고 라벨이 같이 움직입니다. `duration` 전체를 스냅샷 수 − 1로 나누어 씁니다. 오른쪽 아래에 현재 스냅샷 라벨이 큽니다.

| prop | 뜻 |
| --- | --- |
| `snapshots` | `{label, values: {이름: 값}}[]` |
| `top` | 선택. 보여 줄 행 수 |
| `unit` | 선택 |
| `duration` | 기본 90 |

```tsx
<BarChartRace frame={frame} at={235} duration={96} palette={palette} fonts={fonts} size={43} x={160} y={240} width={1600} height={760}
  snapshots={[{label: '1월', values: {식비: 38, 교통: 22}}, {label: '2월', values: {식비: 41, 교통: 20}}]} unit="만" />
```

### Donut

`makePie`로 만든 고리가 값까지 쓸고 가운데 숫자가 셉니다. `label`은 숫자 아래에 뒤따라 뜹니다.

| prop | 뜻 |
| --- | --- |
| `value`, `max` | 값과 최댓값(기본 100) |
| `unit` | 기본 `%` |
| `label` | 선택 |
| `thickness` | 고리 두께. 기본 `size × 0.8` |
| `duration` | 기본 45 |

### Heatmap

격자 칸이 행 우선(`rows`) 또는 시드 순서(`seeded`, `random(seed-k)`)로 튀어나오고, 칸의 투명도가 값 ÷ 최댓값입니다. 행·열 라벨은 선택입니다.

| prop | 뜻 |
| --- | --- |
| `rows` | `number[][]` |
| `rowLabels`, `colLabels` | 선택 |
| `order` | `'rows'`(기본) 또는 `'seeded'` |
| `seed` | 기본 `'heatmap'` |
| `max` | 선택 |
| `duration` | 기본 60(칸은 앞 75%에 걸쳐 나온다) |

### Sparkline

카드 안에 넣는 작은 선. 축도 라벨도 없이 선만 그려지고 끝에 점이 달립니다. 기본 크기 `size × 8 × size × 2`.

| prop | 뜻 |
| --- | --- |
| `data` | `number[]` |
| `dot` | 기본 `true` |
| `duration` | 기본 30 |

## 코드 (`code.tsx`)

### CodeBlock

잉크색 패널 위의 코드. 작은 정규식 토크나이저(`tokenize(code, lang)`도 export)가 키워드·문자열·숫자·주석·구두점·식별자를 나누고, 키워드는 `accent`, 문자열과 숫자는 `accent`를 `paper`·`soft`와 섞은 두 가지 틴트, 주석은 반투명입니다. 글꼴은 `fonts.mono`, 없으면 `googleFont('JetBrains Mono')`. 줄 높이 `size × 1.5`, 안쪽 여백 `size × 0.8`이므로 높이는 `줄 수 × 1.5 × size + 1.6 × size` 이상이어야 합니다. 긴 줄은 자르지 않습니다(`scroll`만 창을 자르고 `data-clip="allow"`를 답니다).

| prop | 뜻 |
| --- | --- |
| `code` | 소스 문자열 |
| `lang` | `'ts' \| 'js' \| 'python' \| 'json' \| 'bash' \| 'plain'`. 기본 `plain` |
| `mode` | `typing`: 글자가 `charsPerFrame`씩 나타나고 캐럿이 깜박이다 끝나면 사라진다. `highlight`: `highlight: [from, to]`(1부터) 줄에 accent 막대가 위에서 쓸려 내려오고 나머지는 0.3으로 어두워진다. `diff`: `+`/`-`로 시작하는 줄이 왼쪽·오른쪽에서 밀려 들어오고 `ink`에 초록·빨강을 섞은 틴트를 깐다. `scroll`: `lines`줄 높이의 창이 `scrollTo`줄까지 `duration`(기본 45) 동안 내려간다 |
| `charsPerFrame` | 기본 2. `duration`을 주면 전체 길이 ÷ duration |
| `lineNumbers` | 기본 `true` |

```tsx
<CodeBlock frame={frame} at={445} out={525} palette={palette} fonts={{...fonts, mono}} size={38} x={160} y={300} width={1600} height={620}
  code={source} lang="ts" mode="typing" charsPerFrame={5} />
```

## 다이어그램 (`diagrams.tsx`)

### Flowchart

노드는 둥근 사각형(`soft` 채움) 또는 알약(`accent` 채움)이고 시차를 두고 스프링으로 튀어나옵니다. 연결선은 양 끝 노드가 내려앉은 뒤 선과 화살촉이 한 경로로 그려집니다.

| prop | 뜻 |
| --- | --- |
| `nodes` | `{id, label, shape?: 'rect' \| 'pill'}[]` |
| `edges` | 선택. `[from, to][]`. 기본은 순서대로 잇기 |
| `direction` | `'row'`(기본) 또는 `'column'` |

### ProcessSteps

한 줄 위에 번호 원이 서고, 채움선이 현재 단계까지 달리며 가까운 단계가 1.3배로 커집니다. `active`가 없으면 `duration`(기본 60) 동안 모든 단계를 차례로 지납니다.

| prop | 뜻 |
| --- | --- |
| `steps` | `string[]` |
| `active` | 선택. 0부터 세는 현재 단계 |

### Timeline

가로 자 위에 날짜가 찍힌 이정표가 서고 라벨이 위·아래로 번갈아 붙습니다. 마커가 `duration`(기본 60) 동안 처음부터 끝까지 이동하고, 지나간 이정표가 튀어나옵니다.

| prop | 뜻 |
| --- | --- |
| `items` | `{date, label}[]` |

### Compare

두 열 표. 행이 같은 박자로 올라오고(6프레임 시차), `boolean` 칸은 행이 내려앉은 뒤 체크(accent)나 가위표(ink)가 그려지며, 문자열 칸은 글자로 찍힙니다. 짝수 행에 `soft` 줄무늬가 깔립니다.

| prop | 뜻 |
| --- | --- |
| `columns` | `[string, string]` |
| `rows` | `{label, a: boolean \| string, b: boolean \| string}[]` |

## 카탈로그

`CHART_BLOCKS`, `CODE_BLOCKS`, `DIAGRAM_BLOCKS`가 `BlockEntry[]`(`id`, `title`, `family`, `props`, `when`, `sample: 'data-reel'`)로 export되고 `CATALOG`에 합쳐집니다. `tests/blocks-data.test.tsx`가 id 중복과 export 누락을 잡습니다.

## 알려진 한계

- 막대 값이 목표선 바로 아래(한 글자 높이 안)이면 값 라벨이 목표선과 겹친다. 데이터를 고르거나 `max`를 키워 간격을 벌린다.
- `CodeBlock`은 줄을 접지 않는다. 가로 60자 이상이면 `size`를 38로 내리거나 `width`를 키운다.
- 블록은 자기 상자 밖을 자르지 않는다. 라벨이 상자 밖으로 조금 나갈 수 있으니 상자를 세이프 영역 안쪽에 둔다.
