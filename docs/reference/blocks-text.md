# 블록 카탈로그: 글자, 로어서드, 카드

`src/blocks/`의 글자(`text.tsx`), 로어서드(`lower-thirds.tsx`), 카드(`cards.tsx`) 블록 레퍼런스입니다. 차트·코드·다이어그램 블록은 [blocks-data.md](blocks-data.md)에 있습니다. 어떤 블록을 고를지는 `skills/frameforge-blocks/SKILL.md`, 전체 사용 예는 `examples/samples/blocks-reel/Spot.tsx`입니다.

```tsx
import {LowerThird, GlyphRise, StatCard} from '@/blocks';
```

## 공통 계약

모든 블록은 프레임 함수입니다. 장면이 `useCurrentFrame()`으로 받은 `frame`을 그대로 넘기고, 블록은 그 프레임의 화면만 그립니다. 상태, 효과, CSS 애니메이션은 없습니다.

| prop | 뜻 |
| --- | --- |
| `frame` | 현재 프레임. 장면이 넘긴다 |
| `at` | 등장이 시작되는 절대 프레임. 그 전에는 `visibility: hidden`으로 숨긴다(언마운트하지 않는다) |
| `out` / `duration` | 퇴장이 시작되는 절대 프레임, 또는 `at`부터의 길이. 둘 다 없으면 끝까지 머문다. 퇴장은 등장과 같은 축을 거꾸로 간다 |
| `fps` | 기본 30. 스프링 계산에 쓴다 |
| `palette` | `{ink, paper, accent, soft}`. 어두운 장면에서는 `{...palette, ink: paper, paper: ink}`처럼 바꿔 넘긴다 |
| `fonts` | `{display, ui}`. `googleFont()`가 돌려준 font-family 문자열 |
| `size` | 블록의 주 글자 크기(px). 호출자가 짧은 변에서 정한다. 보조 글자는 0.7×(토스트 본문·시간과 말풍선 이니셜은 0.8×)이므로 보조 글자가 있는 블록은 짧은 변의 5% 이상, 헤드라인 블록은 10% 이상 |
| `x`, `y` | px 위치. 없으면 `align`(`left`·`center`·`right`)으로 세이프 영역(좌우 5%) 안에 세로 가운데 놓는다. 로어서드와 티커는 기본이 아래 8% |
| `id` | 모션 프로브 키. 기본 `<블록>-<at>`. 같은 프레임에 같은 블록을 둘 두면 다르게 준다 |

모든 움직임은 `interpolate`·`spring`·`Easing`으로만 만듭니다. 블록마다 `<MotionProbe>` 하나가 움직임을 보고하므로 장면 루트에 `<MotionSound role families />`를 선언하면 효과음이 나옵니다(글자 블록은 `text`, 로어서드와 카드는 `card` 패밀리). 글자 마스크는 템플릿의 `Glyphs` 패턴(위 0.1em, 좌우 0.06em 여유)이라 글자 잘림 검사를 통과하고, 공백은 `' '`로 넣습니다.

`text.tsx`가 내보내는 보조 함수도 쓸 수 있습니다. `blockRise(frame, from, dur, easing?)`은 0..1 이징, `blockSettle(frame, at, dur, fps, settle)`은 스프링, `blockPhase(props, enter, exit)`는 등장·퇴장을 합친 `{p, leave, end, hidden}`, `blockPlace(props, hidden)`는 배치 스타일, `blockMask`는 글자 마스크 스타일입니다.

## 글자 블록 (`text.tsx`)

### GlyphRise

글자가 한 자씩 마스크 밖으로 올라옵니다. 템플릿 `Glyphs`의 일반형. 퇴장은 같은 순서로 내려갑니다.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `text` | | 한 줄 |
| `stagger` | 2 | 글자 사이 프레임 |
| `rise` | 12 | 한 글자가 올라오는 프레임 |
| `color` | `palette.ink` | 글자색 |
| `weight` | 900 | 굵기 |

```tsx
<GlyphRise frame={frame} at={10} size={S * 0.125} palette={palette} fonts={fonts} color={palette.paper} text="하루를 잇는" x={W * 0.05} y={H * 0.33} />
```

### WordCascade

여러 줄의 단어가 아래에서 폭포처럼 들어옵니다. 글자 수가 많은(무거운) 단어일수록 늦게, 천천히 옵니다.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `lines` | | 줄 배열. 공백으로 단어를 나눈다 |
| `stagger` | 4 | 단어 사이 기본 간격 |
| `color`, `weight` | | 위와 같다 |

```tsx
<WordCascade frame={frame} at={92} out={172} size={S * 0.11} palette={palette} fonts={fonts} lines={['가볍게 시작하고', '단단하게 이어집니다']} />
```

### ZoomSwap

단어를 Z축으로 바꿉니다. 나가는 단어는 1→1.2로 커지며 10px까지 흐려지고 사라지고, 가장 흐린 순간에 하드 스왑, 들어오는 단어는 0.75→1로 초점이 맞습니다. 한 프레임에 한 단어만 마운트되므로 둘이 동시에 읽히지 않습니다. 이징은 power-4 in/out 대칭.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `words` | | 차례로 보여 줄 단어 |
| `hold` | 36 | 한 단어가 또렷이 머무는 프레임 |
| `swap` | 16 | 바꾸는 데 쓰는 프레임(나가기 절반, 들어오기 절반) |

```tsx
<ZoomSwap frame={frame} at={176} out={284} align="center" size={S * 0.175} palette={palette} fonts={fonts} words={['출근길에', '점심시간에', '잠들기 전에']} hold={26} swap={14} />
```

### Typewriter

글자가 `speed` 프레임마다 하나씩 나타나고, 블록 캐럿이 `blink` 프레임마다 켜졌다 꺼집니다(프레임 함수, CSS 애니메이션 아님). 퇴장은 거꾸로 지웁니다. 전체 문장을 보이지 않게 깔아 두어 가운데 정렬에서도 글자가 밀리지 않습니다.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `text` | | 문장 |
| `speed` | 2 | 글자당 프레임 |
| `blink` | 15 | 캐럿 점멸 주기 |
| `weight` | 500 | UI 글꼴을 쓴다 |

### HighlightSweep

문장 속 한 단어 뒤로 강조색 띠가 왼쪽에서 쓸고 지나가고, 띠가 다 차면 단어가 종이색으로 바뀝니다.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `before`, `word`, `after` | | 앞 글, 강조 단어, 뒷 글 |
| `delay` | 12 | 문장이 뜬 뒤 띠가 시작하기까지 |
| `sweep` | 14 | 띠가 차는 프레임 |

```tsx
<HighlightSweep frame={frame} at={366} align="center" size={S * 0.11} palette={palette} fonts={fonts} before="작은 기록이 " word="큰 흐름" after="이 됩니다" />
```

### Counter

숫자를 `from`에서 `to`까지 셉니다. cubic ease-out, tabular 숫자라 폭이 흔들리지 않고, 값을 한 번만 반올림해 어느 프레임에서도 자릿수가 같습니다. 천 단위 쉼표. `formatNumber(value, decimals)`도 내보냅니다.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `to` | | 끝 값 |
| `from` | 0 | 시작 값 |
| `decimals` | 0 | 소수 자리 |
| `prefix`, `unit` | '' | 앞·뒤 붙는 글자(단위는 0.5×) |
| `count` | 40 | 세는 프레임 |
| `example` | false | `예시` 태그(0.35×, 그래서 size는 108 이상) |

```tsx
<Counter frame={frame} at={446} align="center" size={S * 0.26} palette={palette} fonts={fonts} color={palette.paper} to={1284} unit="일" example />
```

## 로어서드 (`lower-thirds.tsx`)

### LowerThird

이름과 역할을 세이프 영역 아래 모서리(기본 왼쪽, `side="right"`면 오른쪽)에 놓습니다. `size`는 이름 크기, 역할은 0.7×이므로 짧은 변의 5% 이상을 넘깁니다. 모든 변형이 자기 쪽에서 들어오고(마스크·바·블록이 먼저, 글자가 다음) 퇴장은 같은 길을 되돌아갑니다.

| `variant` | 모양 |
| --- | --- |
| `clean-bar` | 세로 강조 바가 아래에서 자라고 이름·역할이 마스크에서 올라온다 |
| `bold-block` | 잉크 블록이 옆에서 펴지고 안의 종이색 이름이 올라온다. 역할은 강조색 띠 |
| `kicker-name` | 역할이 강조색 키커로 먼저 미끄러져 오고 이름이 아래에서 올라온다 |
| `soft-pill` | soft색 알약이 펴지고 이름이 나타난다. 역할은 아래에서 미끄러진다 |
| `mask-reveal` | 이름과 역할이 clip-path로 옆에서 드러나고 사이에 강조 밑줄이 자란다 |
| `side-rule` | 가로 강조 룰이 위에서 자라고 이름이 올라오고 역할이 룰을 따라 온다 |

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `name`, `role` | | 이름, 역할 |
| `side` | `left` | 들어오는 쪽과 위치 |
| `enter`, `exit` | 16, 12 | 등장·퇴장 프레임 |

```tsx
<LowerThird frame={frame} at={102} out={160} size={S * 0.06} palette={palette} fonts={fonts} variant="clean-bar" name="김온결" role="제품 디자이너 · 가상 인물" />
```

어두운 장면에서는 `palette={{...palette, ink: palette.paper, paper: palette.ink}}`, 강조색 장면에서는 `palette={{...palette, accent: palette.ink}}`로 넘깁니다.

## 카드 (`cards.tsx`)

### StatCard

큰 Counter와 라벨이 든 종이 카드. 템플릿 `Screen`처럼 잉크 오프셋 블록이 뒤에 있고, 스프링으로 아래에서 올라옵니다. `size`는 라벨 크기, 숫자는 2.4×, `예시` 태그(0.7×)는 숫자가 아니라 라벨 옆에 붙어 카드 가장자리와 만나지 않습니다.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `value`, `label` | | 숫자, 라벨 |
| `unit`, `prefix`, `decimals` | | Counter에 그대로 |
| `example` | true | 예시 태그 |
| `width`, `height` | size×10, size×5.2 | 카드 크기 |

```tsx
<StatCard frame={frame} at={504} out={582} x={W * 0.1} y={H * 0.3} size={S * 0.06} palette={palette} fonts={fonts} value={1284} unit="일" label="이어진 날" />
```

### NotificationCard

OS 중립 토스트. 키트 에셋 컴포넌트를 아이콘 자리에 받아(`import {Bell} from '@/assets'`) soft 슬롯 안에 그려 넣고, 제목·본문·시간(0.8×)을 놓습니다. 화면의 60% 폭이 자연스럽습니다(`width={W * 0.6}`). 위 또는 오른쪽에서 미끄러져 들어와 머물다 같은 길로 나갑니다. `duration`으로 머무는 길이를 정합니다.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `icon` | | `(props: ArtProps) => JSX` 키트 컴포넌트 |
| `title`, `body`, `time` | | 글 |
| `from` | `top` | `top` 또는 `right` |
| `width` | size×11 | 카드 폭 |

```tsx
<NotificationCard frame={frame} at={588} duration={54} x={W * 0.05} y={H * 0.12} size={S * 0.052} palette={palette} fonts={fonts} icon={Bell} title="온결" body="오늘의 기록이 저장됐어요" time="지금" />
```

### MessageThread

말풍선이 `step` 프레임마다 차례로 뜨고, 답장 앞에는 점 세 개가 `typing` 프레임 동안 움직입니다(프레임의 sin 함수). 아바타는 이름 첫 글자가 든 원.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `messages` | | `{side: 'left'｜'right', name, text}[]` |
| `step` | 24 | 말풍선 간격 |
| `typing` | 10 | 답장 앞 타이핑 길이 |
| `width` | size×12 | 스레드 폭 |

### Ticker

점으로 구분된 항목이 가로로 `speed` px/프레임씩 흐르는 띠. 항목마다 `cell` px 칸을 쓰므로 DOM을 재지 않고 `(frame × speed) % (cell × 항목 수)`로 끊김 없이 돕니다. 띠에 `data-clip="allow"`가 있어 잘림 검사에서 제외됩니다. 기본 위치는 아래 8%, 가로 전체.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `items` | | 항목 |
| `speed` | 4 | px/프레임 |
| `cell` | size×9 | 칸 폭. 가장 긴 항목보다 넓게 |
| `height` | size×2.2 | 띠 높이 |

### Checklist

항목이 `stagger` 간격으로 올라오고, 각 항목 뒤 체크 패스가 `pathLength`로 `draw` 프레임 동안 그려집니다. 다 그려지면 상자가 강조색으로 찹니다.

| prop | 기본 | 뜻 |
| --- | --- | --- |
| `items` | | 항목 |
| `stagger` | 14 | 항목 간격 |
| `draw` | 12 | 체크를 긋는 프레임 |

### LogoOutro

브랜드 이름이 GlyphRise로 올라오고, 강조 밑줄이 자라고, 태그라인이 떠오른 뒤 멈춥니다. `size`는 이름 크기, 태그라인은 0.4×(그래서 size는 짧은 변의 10% 이상). 마지막 2초 정지 규칙에 맞게 `at + 40` 뒤로는 움직이지 않습니다.

```tsx
<LogoOutro frame={frame} at={804} align="center" size={S * 0.21} palette={palette} fonts={fonts} color={palette.paper} brand="온결" tagline="하루를 잇다 · 가상 브랜드" />
```

## 카탈로그

`TEXT_BLOCKS`, `LOWER_THIRD_BLOCKS`, `CARD_BLOCKS`(`BlockEntry[]`)가 각 파일에서 나가고 `CATALOG`가 모읍니다. 항목은 `{id, title, family, props, when}`이며 스튜디오와 스킬이 같은 목록을 읽습니다. 검사는 `npx tsx --test tests/blocks-text.test.tsx`입니다. 등장 전 숨김, 같은 프레임 두 번 같은 마크업, 정착 뒤 정지, `out` 없이 영구 유지, 카탈로그 id 유일성과 모든 블록의 등재를 봅니다.
