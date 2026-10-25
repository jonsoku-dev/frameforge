# 생성형 배경, 셰이더, 후처리 이펙트, 그린 주석

`frameforge`가 내보내는 `<Generative>`와 아홉 개의 시스템, WebGL 셰이더 `<Shader>`와 프리셋 일곱, DOM 후처리 이펙트 다섯, 그리고 글자 위에 손으로 그린 듯한 `<Highlight>` 같은 주석 컴포넌트다. 둘 다 프레임과 시드의 순수 함수다. 프레임 사이에 누적되는 상태가 없고, 같은 프레임과 시드는 같은 픽셀을 준다.

## 철학 단계

시스템을 고르기 전에 `prompt.md` 맨 위에 짧은 선언을 쓴다. 배경이 무엇을 표현하는지(한 문장), 규칙(시드와 시간의 함수, 네 색, 글자와 겨루지 않음), 거부하는 것(먼지 파티클, 붙여 넣은 아이콘, 스톡 이미지, 마지막 글자를 가리는 이펙트). 선언이 시스템과 인자를 정하고, 인자 중 둘쯤을 작품 변수로 노출한다. 예: `examples/samples/generative-ident/prompt.md`.

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


## `<Shader>`

사진 같은 질감(매크로, 액체, 터널, 그레인)은 스톡 이미지가 아니라 셰이더 프리셋으로 만든다. 프레임마다 화면 전체를 덮는 프래그먼트 셰이더 하나를 WebGL2로 그린다.

```tsx
import {Shader, shaders} from 'frameforge';
<Shader frag={shaders.iris} width={1920} height={1080} palette={{ink, paper, accent, soft}} seed="<slug>" uniforms={{u_dilate: open}} />
```

| prop | 뜻 |
| --- | --- |
| `frag` | GLSL ES 3.00 프래그먼트 소스. `#version` 줄이 없으면 머리말이 붙는다. 기본 유니폼, 소스가 직접 선언하지 않은 사용자 유니폼, `out vec4 fragColor`, 도우미 `hash(cell)`, `vnoise(p)`, `fbm(p)`, `centred()`(짧은 변이 -0.5..0.5) |
| `uniforms` | 숫자는 `float`, 길이 2–4 배열은 `vec2–vec4`, `#rgb`/`#rrggbb` 문자열은 0..1 `vec3` |
| `palette` | `u_ink`, `u_paper`, `u_accent`, `u_soft`(vec3)를 채운다 |
| `seed` | `u_seed`(0..1). 같은 시드는 같은 그림 |
| `width`, `height`, `pixelDensity` | 캔버스 논리 크기와 배율 |

기본 유니폼은 `u_time`(초, `useCurrentFrame() / fps`), `u_frame`, `u_resolution`(그리기 버퍼 px), `u_seed`다. 캔버스는 `preserveDrawingBuffer`로 만들고 `useLayoutEffect` 안에서 그 프레임을 그린 뒤 `gl.finish()`로 끝내므로, 렌더러가 캡처하는 화면은 그 프레임의 그림이다. 첫 프레임은 컨텍스트가 생기고 한 번 그릴 때까지 `delayRender`로 붙잡는다. 컴파일 오류는 `<Shader> fragment shader failed to compile: ERROR: 0:<사용자 소스의 줄>: ...`로 그 프레임을 실패시킨다. 해시는 정수 해시다. `fract(sin(...))` 해시는 GPU마다 결과가 달라 쓰지 않는다.

| 프리셋 | 그림 | 추가 유니폼 |
| --- | --- | --- |
| `iris` | 숨 쉬는 동공 둘레의 방사형 홍채 섬유, 어두운 테두리, 젖은 하이라이트 하나 | `u_dilate` 0..1 |
| `tunnel` | 휘어지는 카메라 터널. 띠 무늬 벽이 다가오고 먼 끝은 ink로 사라진다 | `u_speed`(기본 1) |
| `liquid` | 도메인 왜곡 fbm 마블링과 가는 paper 결 | `u_flow`(기본 1) |
| `grainField` | paper 위 하프톤 점과 프레임마다 바뀌는 필름 그레인 | `u_cell` 점 간격 px(기본 10) |
| `gradientMesh` | 시드 타원을 떠다니는 네 색 점의 메시 그라데이션, 밴딩을 막는 가는 그레인 | 없음 |
| `streaks` | 중심에서 뻗는 광속 줄무늬 세 층, 밝은 머리와 중심 글로우 | `u_speed`(기본 1) |
| `cubeField` | 아이소메트릭 큐브 기둥. 시드 높이가 박마다 중심에서 퍼지는 파동으로 솟는다 | `u_beat` 박 길이 초(기본 0.5), `u_cells`(기본 10) |
| `planet` | 빛을 받는 행성. 바다의 햇빛 반사, 시드 대륙과 극지 얼음, 흐르는 구름, 낮과 밤의 경계와 따뜻한 박명, 밤쪽 도시 불빛(`u_accent`, 없으면 따뜻한 흰색), 대기 테두리와 후광, 별밭. 바다와 땅은 실제 색이다 | `u_spin` 초당 라디안(기본 0.12), `u_light` 해 방향 vec3, `u_zoom` 반지름(짧은 변 비율, 기본 0.36), `u_center` vec2, `u_tilt` 자전축 기울기 추가 |
| `sun` | 항성. 끓는 쌀알 무늬(워리 셀)와 흑점, 주연 감광, 줄기 코로나, 가로 플레어와 고스트. 색은 paper(뜨거움), soft, accent(가장자리)이고 팔레트가 없으면 실제 태양색 | `u_zoom`(기본 0.26), `u_center` vec2, `u_flare` 플레어 세기(기본 1) |
| `sliced` | 레이마칭 SDF 주인공. `u_shape` 0 흉상(두개, 얼굴, 코, 눈두덩, 입술, 귀, 목, 어깨), 1 (2,3) 토러스 매듭, 2 숨 쉬는 덩어리. `u_style` 0 광택(soft 몸, accent 림, paper 반사), 1 주사선(형태를 따라 빛나는 가로 등고선, 안쪽 accent 빛), 2 와이어프레임(등고선과 경선). 팔레트가 필요하다 | `u_orbit` 카메라 수평 각도 라디안(프레임으로 움직인다), `u_mix` 0..1 위에서 아래로 쓸며 광택으로 바뀌고 경계가 빛난다, `u_zoom`(기본 1), `u_slices` 단위당 선 수(기본 15) |
| `orbits` | 구 둘레의 빛 궤도. 기울어진 고리마다 빛 머리가 달리며 accent 꼬리를 남기고, 뒤쪽 절반은 구 뒤로 지나간다. 구는 accent 테두리와 후광. 팔레트가 필요하다 | `u_rings` 1..8(기본 6), `u_speed`(기본 1), `u_zoom`(기본 1) |

모든 프리셋은 `u_time`, `u_seed`, 유니폼의 순수 함수다. 테스트(`tests/generative.test.tsx`)는 헤드리스 Chrome에서 열한 프리셋을 모두 컴파일해 30프레임을 두 번 렌더하고 모든 프레임이 바이트 단위로 같은지 본다.

주인공 프리셋(`planet`, `sun`, `sliced`, `orbits`)은 에셋 없이 빛을 받는 3D 주인공을 그린다. 한 영상의 주인공 하나로 쓰고 장면마다 다시 나오게 한다. `sliced`는 카메라 각도를 프레임에서 받으므로 `u_orbit: frame * 0.01`처럼 돌리고, 주사선 머리가 광택 흉상으로 바뀌는 순간은 `u_mix`를 0에서 1로 보간한다. 1920×1080에서 `sliced` 30프레임 렌더는 약 5초였다(이 Mac의 헤드리스 Chrome, 시작 포함).

## 후처리 이펙트

DOM 장면의 글자나 층을 감싼다. 자식을 한 번만 그리므로(복사본 없음) 감사가 글자를 한 번 읽는다. 움직이는 값은 `frame`으로 받는다.

| 컴포넌트 | 하는 일 |
| --- | --- |
| `<Glow radius intensity color>` | 자식의 모양을 따라 drop-shadow 세 겹(반지름 1×, 2.5×, 6×)으로 번지는 블룸. `intensity` 0..1을 프레임으로 움직이면 맥동한다. `glowFilter`가 필터 문자열을 준다 |
| `<ChromaticShift amount angle>` | SVG 필터로 빨강과 파랑 채널을 `angle` 방향으로 `amount` px씩 반대로 민다(`chromaticOffsets`) |
| `<Scanlines density opacity roll frame>` | `density` px마다 어두운 주사선 하나, 프레임마다 `roll` px 흐른다 |
| `<VhsGlitch seed amount frame>` | 시드 난류 변위로 가로 띠를 옆으로 밀고, 빨강이 번지고, 버스트 동안 잡음 띠가 지난다. 버스트는 세 프레임 단위로 시드가 정하고, 사이에도 약한 흔들림이 남는다(`vhsGlitch`) |
| `<Extrude depth color angle shadow>` | 1px 간격 `text-shadow` 층으로 `depth` px 깊이의 돌출 3D 글자와 부드러운 그림자(`extrudeShadow`) |

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
| `aurora` | `auroraBands → {base, height, edge, tone}[]` | bands 4, amplitude 0.08, scale 1.2, speed 0.06, height 0.2 | 윗선은 sine+noise, 아랫선은 따로 노이즈로 흔들린 띠. 표본마다 세로 조각에 윗선→아랫선 그라데이션을 칠하므로 바래는 선이 두 곡선을 따라가고 직선으로 끊기지 않는다. accent·soft만 쓴다 |

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
