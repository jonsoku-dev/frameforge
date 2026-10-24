# 생성형 배경과 그린 주석

`frameforge`가 내보내는 `<Generative>`와 아홉 개의 시스템, 그리고 글자 위에 손으로 그린 듯한 `<Highlight>` 같은 주석 컴포넌트다. 둘 다 프레임과 시드의 순수 함수다. 프레임 사이에 누적되는 상태가 없고, 같은 프레임과 시드는 같은 픽셀을 준다.

## 철학 단계

시스템을 고르기 전에 `prompt.md` 맨 위에 짧은 선언을 쓴다. 배경이 무엇을 표현하는지(한 문장), 규칙(시드와 시간의 함수, 네 색, 글자와 겨루지 않음), 거부하는 것(글로우, 먼지 파티클, 두 번째 그라데이션, 붙여 넣은 아이콘). 선언이 시스템과 인자를 정하고, 인자 중 둘쯤을 작품 변수로 노출한다. 예: `examples/samples/generative-ident/prompt.md`.

## `<Generative>`

```tsx
<Generative system="aurora" seed="mulgyeol" width={1920} height={1080} fit="fill" palette={{ink, paper, accent, soft}} params={{bands: 4, speed: 0.06}} effects={[...]} />
```

| prop | 뜻 |
| --- | --- |
| `system` | 시스템 id 문자열 또는 시스템 객체 |
| `seed` | 문자열이나 숫자. 같은 시드는 같은 그림 |
| `width`, `height` | 캔버스 논리 크기(px). `pixelDensity`로 배율 |
| `palette` | 작품의 네 색 `{ink, paper, accent, soft}`. 필수이며 기본 색은 없다. `#rgb`나 `#rrggbb`로 적는다. 그라데이션의 알파와 voronoi의 셀 색은 16진 색만 읽고, 다른 표기는 알파 없이 그려지거나 검게 나온다 |
| `params` | 시스템 스키마의 숫자 인자. 빠진 값은 기본값, 범위 밖 값은 잘린다 |
| `fit` | 단위 정사각형을 캔버스에 놓는 법. `cover`(기본, 긴 변의 정사각형), `contain`(짧은 변), `fill`(사각형 전체로 늘림) |
| `effects` | 그린 뒤 적용할 효과 체인(`docs/reference/effects.md`) |

시간 `t`는 `useCurrentFrame() / fps` 초다. `<Sequence from>` 안에 두면 그 장면의 0초부터 시작한다. 캔버스는 `Solid`와 같은 방식(`useLayoutEffect` 안의 `paintCanvas`)으로 그리므로 헤드리스 Chrome 캡처와 맞고 브라우저 시계를 쓰지 않는다.

## 시스템

모든 시스템은 `GENERATIVE_SYSTEMS`에 들어 있고 `{id, title, schema, geometry, paint}` 모양이다. `schema`의 각 항목은 스튜디오 조정 탭의 변수 모양(`{key, label, type: 'number', default, min, max, step}`)이라 그대로 `variables`에 펼칠 수 있다. `geometry(seed, params, t)`는 캔버스 없이 단위 좌표(0..1)의 도형을 돌려주고, `paint`가 그린다. `clampParams(system, params)`, `getGenerativeSystem(id)`, `fitBox(fit, w, h)`, `paintGenerative(ctx, system, {...})`를 내보낸다.

| id | 기하 함수 | 인자(기본) | 그림 |
| --- | --- | --- | --- |
| `flowField` | `flowFieldLines(seed, params, t) → number[][]` | lines 140, steps 90, stepLength 0.006, scale 2.4, grow 4 s, strokeWidth 0.0025 | `noise2D`가 방향을 정하는 유선. 전체 선은 시드마다 한 번 계산해 메모하고, `t/grow`만큼의 앞부분을 그린다 |
| `particles` | `particleDiscs → {x, y, r, alpha}[]` | count 24, size 0.045, orbit 0.12, speed 0.6, pulse 0.4 | 시드로 정한 중심을 도는 닫힌 궤도의 큰 원. 먼지가 아니라 도형이다(기본 반지름 4.5 %) |
| `starfield` | `starfieldDiscs` | layers 3, density 60, speed 0.03, size 0.006, twinkle 0.8 | 층마다 속도가 다른 시차 이동, `noise3D` 반짝임. 작은 점이 많으므로 글자 없는 장면에만 |
| `meshGradient` | `meshGradientBlobs → {x, y, r, tone}[]` | blobs 4(3–5), radius 0.55, drift 0.12, speed 0.05 | ink 위에 accent·soft·paper 방사형 덩어리가 천천히 떠다닌다. 작품의 유일한 그라데이션 자리 |
| `halftone` | `halftoneDots → {x, y, r}[]` | cell 0.04, scale 2.5, speed 0.25, maxRadius 0.5 | 격자 점의 반지름을 `noise3D(x, y, t)`가 정한다 |
| `ripples` | `rippleRings → {x, y, r, alpha}[]` | sources 3, rings 8, spacing 0.06, speed 0.08, strokeWidth 0.003 | 시드 원점에서 퍼지는 동심원. 겹치는 곳은 알파가 더해져 간섭무늬가 된다 |
| `voronoi` | `voronoiSites → {x, y, tone}[]` | cells 18, drift 0.04, speed 0.05, resolution 0.2 | 천천히 떠다니는 자리의 보로노이 셀. `resolution` 배율의 작은 캔버스에서 픽셀마다 O(cells)로 계산한 뒤 확대 |
| `noiseLines` | `noiseLinePaths → number[][]` | lines 28, amplitude 0.05, scale 1.8, speed 0.2, radial 0/1, strokeWidth 0.002 | 가로(또는 방사형) 선을 `noise3D`가 밀어낸다 |
| `aurora` | `auroraBands → {base, height, edge, tone}[]` | bands 4, amplitude 0.08, scale 1.2, speed 0.06, height 0.2 | sine+noise 윗선을 가진 띠를 세로 그라데이션으로 채운다. accent·soft만 쓴다 |

단위: 길이 인자는 `fit` 상자의 긴 변 비율이다(1920×1080 `fill`이면 1920 px 기준). 속도는 초당 회전이나 노이즈 이동이다.

## 작품 변수로 노출하기

```tsx
export const variables = [
  {key: 'auroraSeed', type: 'string', label: '오로라 시드', default: 'mulgyeol', maxLength: 24, group: '배경'},
  ...aurora.schema.filter(e => e.key === 'bands' || e.key === 'speed').map(e => ({...e, key: `aurora${e.key[0].toUpperCase()}${e.key.slice(1)}`, group: '배경'})),
];
// entry.tsx: <Composition ... variables={variables} />; Spot은 props로 받는다.
```

## 결정성 규칙

- 기하는 `(seed, t)`의 닫힌 함수다. 적분이 꼭 필요한 시스템(flowField)은 시드마다 전체를 한 번 계산해 메모하고 프레임에 맞는 앞부분만 쓴다. `requestAnimationFrame`, 누적 변수, 프레임별 난수 시드는 쓰지 않는다.
- 시간에 따라 바뀌는 노이즈는 `noise3D(seed, x, y, t)`처럼 시드를 고정하고 `t`를 좌표로 넣는다. 프레임마다 다른 시드 문자열은 순열표를 끝없이 쌓는다.
- `tests/generative.test.tsx`가 모든 시스템의 기하가 `(seed, t)`에 결정적이고, 다른 시드와 다른 `t`에서 달라지며, 레지스트리 id가 유일하고, 인자가 스키마로 잘리는지 잰다.

## 그린 주석

`<Highlight>`, `<Encircle>`(`Circle`은 도형 컴포넌트라 이름이 다르다), `<Underline>`, `<StrikeThrough>`, `<Box>`, `<Bracket side>`. 모두 같은 props를 받는다.

| prop | 뜻 |
| --- | --- |
| `progress` | 0..1. 선이 그려진 비율. 0이면 SVG를 그리지 않는다 |
| `color` | 선 색(기본 `currentColor`) |
| `strokeWidth` | 화면 픽셀(비스케일 선). `Highlight`만 상자 높이의 %(기본 85) |
| `seed` | 거칠기 오프셋의 시드 |
| `roughness` | 0..1. 0이면 곧은 선, 1이면 점마다 상자의 6 %까지 흔들린다 |
| `padding` | 글자 상자 밖으로 나가는 픽셀(기본 6; `Highlight`는 0) |

DOM을 재지 않는다. 자식을 `inline-block` span으로 감싸고 그 위에 `viewBox="0 0 100 100"` `preserveAspectRatio="none"` SVG를 절대 배치하므로 경로는 퍼센트 좌표다. 선은 `pathLength={1}`과 `strokeDasharray`로 `progress`만큼 그려진다. `Highlight`는 `z-index: -1`로 글자 뒤에, 나머지는 위에 그린다(감싸는 span이 `isolation: isolate`라 장면 배경 뒤로 가지 않는다). 경로 함수 `annotationPath(kind, seed, roughness)`를 내보내므로 테스트는 마크업 없이 경로를 검사한다.

```tsx
<Highlight progress={span(frame, 192, 22)} color={accent} seed="form" strokeWidth={70}><Glyphs text="형태" ... /></Highlight>
<Encircle progress={span(frame, 280, 26)} color={accent} seed="big" roughness={0.7} strokeWidth={10} padding={26}>큰 물결로</Encircle>
```

주석 진행도를 `<MotionProbe family="text" axis="progress">`로 보고하면 `MotionSound role="appear"`가 펜 소리를 붙인다.
