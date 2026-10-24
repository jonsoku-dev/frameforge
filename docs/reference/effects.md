# 색 보정과 필름 효과

캔버스 효과 체인(`effects` 배열)에 넣는 효과들이다. 모두 `frameforge`에서 가져오고, 2D `ImageData` 위에서 동작한다. 같은 프레임과 같은 인자는 같은 픽셀을 준다.

## 효과를 받는 컴포넌트

`effects?: EffectsProp`를 받는 컴포넌트는 넷이다.

| 컴포넌트 | 무엇을 그리는가 |
| --- | --- |
| `<Solid width height color?>` | 한 색의 캔버스. `color`를 빼면 투명 캔버스가 되어 오버레이용이 된다 |
| `<CanvasImage src>` | 정지 이미지 |
| `<AnimatedImage src>` | GIF, APNG, WebP 애니메이션 |
| `<HtmlInCanvas width height>` | 자식 HTML을 캔버스로 |
| `<Generative system seed>` | 생성형 배경(`docs/reference/generative.md`) |

`<Video>`는 효과를 받지 않는다. 효과는 배열 순서대로 적용되고, `{disabled: true}`를 준 항목은 건너뛴다.

글자나 DOM 위에 효과를 얹으려면 투명 `Solid`를 맨 위에 둔다. 비네트와 그레인은 알파가 0인 픽셀에도 알파를 써 넣으므로 오버레이로 동작한다.

```tsx
<Solid width={1920} height={1080} effects={[vignetteEffect({amount: 0.55, softness: 0.6}), grainEffect({seed: 'card', frame: Math.min(frame, HOLD), amount: 0.1, size: 2})]} style={{position: 'absolute', left: 0, top: 0}} />
```

## colorCorrectionEffect(params)

기본값은 모두 항등이다. 노출과 색온도는 선형 광량에서, 나머지는 표시값(0..1)에서 계산한다.

| 인자 | 범위 | 기본 | 뜻 |
| --- | --- | --- | --- |
| `exposure` | -5..5 | 0 | 스톱. +1이면 선형 광량이 두 배 |
| `temperature` | -1..1 | 0 | 음수 차갑게, 양수 따뜻하게(R 올리고 B 내림, 최대 25 %) |
| `tint` | -1..1 | 0 | 음수 초록, 양수 마젠타 |
| `contrast` | 0..4 | 1 | `pivot` 둘레의 배율 |
| `pivot` | 0..1 | 0.5 | 대비의 중심 |
| `saturation` | 0..4 | 1 | 채도 배율 |
| `vibrance` | -1..1 | 0 | 채도가 낮은 색을 더 많이 올린다 |
| `blacks`, `shadows`, `highlights`, `whites` | -1..1 | 0 | 네 명도 영역의 들어올림. 한 단위가 최대 1/4 |

순수 함수 `correctPixel(r, g, b, params)`(바이트 입력, 바이트 출력), `applyCorrection(pixels, params)`, `validateCorrection(params)`, `srgbToLinear`, `linearToSrgb`, `NEUTRAL_CORRECTION`을 내보낸다.

## parseCubeLut(text), lutEffect({lut, intensity})

3D `.cube` 파일을 읽는다. `TITLE`, `LUT_3D_SIZE`, `DOMAIN_MIN`, `DOMAIN_MAX`, `#` 주석, 그리고 `size³` 줄(빨강이 가장 빨리 바뀜)을 받는다. 1D LUT와 줄 수가 맞지 않는 파일은 오류다. 결과 `CubeLut`는 `{title, size, domainMin, domainMax, data: Float32Array, key}`이며 `key`는 효과 키에 쓰는 안정된 식별자다.

`lutEffect({lut, intensity = 1})`는 삼선형 보간으로 찾고 `intensity`(0..1)만큼 섞는다. `sampleLut(lut, r, g, b)`(0..1 입력)와 `applyLut(pixels, {lut, intensity})`를 내보낸다. `.cube` 텍스트는 문자열 상수로 두거나 번들러의 raw 가져오기로 읽어 모듈 상단에서 한 번만 파싱한다. 프레임마다 `fetch`하거나 파싱하지 않는다.

## lightLeakEffect({seed, progress, hueShift, intensity, colors})

절차적 빛샘. `seed`로 2–4개의 따뜻한(색상 8–48도 + `hueShift`) 방사형 그라데이션을 정하고, `progress` 0..1 동안 가로질러 쓸고 지나가며 `sin(π·progress)` 포락선으로 나타났다 사라진다. `progress` 0과 1에서는 아무것도 그리지 않는다. 소스 위에 `screen`으로 섞으므로 투명 `Solid`에 얹으면 알파 있는 빛 덩어리만 남아 장면 이음새에 쓸 수 있다. `colors`에 `#rgb`/`#rrggbb` 색 목록을 주면 따뜻한 색상 대신 그 색을 덩어리마다 돌려 쓰므로 작품의 네 색 안에 머문다(`colors: [accent, soft]`). 다른 표기는 오류다. 빛샘은 짧게(한 장면 이음새 20프레임 안팎) 쓴다. 길면 금지된 글로우처럼 읽힌다. 기하는 `lightLeakBlobs(params) → {x, y, r, hue, alpha, color?}[]`(단위 좌표)로 따로 내보낸다.

## vignetteEffect({amount, softness, roundness})

가장자리를 어둡게 한다. `amount` 0..1(모서리의 어둡기, 기본 0.5), `softness` 0..1(0이면 날카로운 테두리, 1이면 중앙부터 시작, 기본 0.5), `roundness` 0..1(1 원형, 0 사각형, 기본 1). 불투명 픽셀은 어두워지고, 투명 픽셀에는 검정과 알파를 써 넣는다. `vignetteAlpha(nx, ny, params)`(−1..1 정규 좌표)와 `applyVignette(pixels, params)`를 내보낸다.

## grainEffect({seed, frame, amount, size})

단색 필름 그레인. `(seed, frame)`마다 `random`으로 256×256 타일을 새로 만들어 캔버스에 반복하므로 같은 `(seed, frame)`은 같은 그레인, 다른 프레임은 다른 그레인이다. `amount` 0..1(기본 0.2), `size` 1 이상 픽셀(기본 1). 정지 구간에서는 `frame: Math.min(frame, HOLD)`로 고정해 마지막 2초가 바뀌지 않게 한다. `grainTile(seed, frame)`, `applyGrain(pixels, params)`, `GRAIN_TILE`을 내보낸다.

## 순수 함수와 테스트

픽셀 함수는 `{data: Uint8ClampedArray, width, height}`(`Pixels`) 위에서 동작하므로 캔버스 없이 node에서 검사한다. `tests/effects.test.tsx`가 항등, 노출 두 배, 2점 LUT(`tests/fixtures/effects/identity-2.cube`), 빛샘 끝점, 비네트 모서리, 그레인 결정성을 잰다.

## 성능

모든 효과는 픽셀마다 JavaScript로 돈다. 1920×1080에서 색 보정 한 번이 수십 ms이므로, 효과는 장면당 하나의 캔버스에 두세 개까지 쓰고 글자 위에는 투명 `Solid` 하나로 묶는다.
