# 지도 블록

`src/blocks/maps.tsx`의 블록 레퍼런스입니다. `import {MapOutline, RouteMap, Markers} from '@/blocks'`로 가져오는 순수 프레임 함수 컴포넌트이고, 지도 데이터는 `npm run geo`가 받아 둔 Natural Earth GeoJSON입니다. 배경 지도 이미지(타일, 위성 사진)는 쓰지 않고 팔레트 색의 선과 면으로만 그립니다. 쓰는 예는 `examples/samples/map-story/Spot.tsx`(컴포지션 `MapStory`)입니다.

## 지도 데이터 받기

작품 폴더에 `geo.json`을 둡니다.

```json
{
  "slug": "map-story",
  "items": [
    {"name": "world", "source": "natural-earth", "layer": "countries", "scale": "50m", "simplify": 0.03},
    {"name": "korea", "source": "natural-earth", "layer": "countries", "scale": "50m", "filter": {"iso_a3": ["KOR"]}, "simplify": 0.01}
  ]
}
```

| 필드 | 뜻 |
| --- | --- |
| `name` | 출력 파일 이름. 소문자, 숫자, `-` |
| `source` | `natural-earth`만 |
| `layer` | `countries`, `land`, `coastline`, `lakes` |
| `scale` | `110m`(가벼움, 세계 전체용) 또는 `50m`(나라 하나를 화면 가득 채울 때) |
| `filter` | 선택. `{"<속성>": [값...]}`. 속성 이름은 대소문자를 가리지 않는다. 프랑스·노르웨이 등 몇 나라는 `iso_a3`가 `-99`이므로 `adm0_a3`로 거른다 |
| `simplify` | 선택. Douglas–Peucker 허용 오차(도). 50m 세계는 0.03이면 1 MB 안팎이다 |

```sh
npm run geo -- examples/samples/<slug>/geo.json          # 받기. 잠금이 맞고 파일이 있으면 건너뜀
npm run geo -- examples/samples/<slug>/geo.json --force  # 다시 받기
python3 scripts/assets/geo.py --self-check               # 로컬 HTTP 서버로 자체 검사
```

결과는 `public/assets/generated/<slug>/geo/<name>.geojson`(gitignore 대상)에 쓰고, 같은 폴더의 `geo.lock.json`에 URL, 받은 파일의 sha256, 라이선스(public domain, Natural Earth), 지형 수를 고정합니다. 속성은 `name`, `name_long`, `name_ko`, `iso_a3`, `adm0_a3`, `iso_a2`, `continent`, `subregion`, `featurecla`, `scalerank`와 `filter`에 쓴 키만 소문자로 남습니다. 네트워크가 없으면 `cannot reach ...`로, 없는 레이어나 축척은 검증 오류로 끝나며 종료 코드는 1입니다. 원본은 https://github.com/nvkelso/natural-earth-vector 의 `geojson/ne_<scale>_<layer>.geojson`입니다(`NATURAL_EARTH_BASE`로 바꿀 수 있음).

## 공통 계약

블록 공통 계약(`frame`, `at`, `out`, `duration`, `fps`, `palette`, `fonts`, `size`, `stroke`, `radius`, `x`, `y`, `width`, `height`, `id`)에 지도용 prop이 더해집니다.

| prop | 뜻 |
| --- | --- |
| `src` | GeoJSON 경로(`/assets/generated/<slug>/geo/<name>.geojson`). 처음 한 번 받고 그동안 렌더를 붙잡는다(`delayRender`). 파일이 없으면 `npm run geo`를 하라는 오류를 낸다 |
| `data` | 선택. FeatureCollection을 직접 준다. 주면 `src`를 받지 않는다. 빈 컬렉션을 주면 바탕 지도 없이 경로나 핀만 그린다 |
| `projection` | `equirectangular`(기본) 또는 `mercator`(위도 ±85°에서 자름) |
| `fit` | `'bounds'`(기본, 데이터 전체를 상자에 맞춤) 또는 `{center: [경도, 위도], zoom}`(zoom 1이면 경도 360°가 상자 너비). 프레임마다 바꿔도 되므로 카메라 이동은 이 값을 움직인다 |
| `highlight` | 선택. 강조할 지형의 속성 값 목록 |
| `highlightKey` | 기본 `iso_a3` |
| `size` | 라벨 판 글자 크기. 기본 38(짧은 변 3.5% 하한) |
| `stroke` | 국경선 굵기. 기본 `size × 0.12` |
| `width`, `height` | 지도 상자. 기본 `size × 40`, `size × 22` |

색은 팔레트에서만 나옵니다. 땅은 `soft` 30%, 국경선은 `soft`, 강조와 경로와 핀은 `accent`, 라벨 판은 `ink` 바탕에 `paper` 글자입니다. 어두운 바다 위에 둘 때는 `{...palette, ink: palette.paper, paper: palette.ink}`를 넘깁니다. 지도 선은 `<svg>`가 스스로 자르고, 라벨은 그 옆의 HTML이라 글자 잘림 검사에 걸리지 않습니다. `at` 전과 `out` 뒤에는 `null`이고, `out` 직전 8프레임 동안 투명해집니다.

순수 함수도 내보냅니다. `project([lon, lat], projection)`, `bounds(data)`, `fitBounds(box, W, H, projection, pad)`, `fitCenter(center, zoom, W, H, projection)`, `toPixel(p, view)`, `geoPath(geometry, view)`, `greatCircle(route)`. 경도가 180°를 넘게 튀는 고리(110m의 피지)는 새 하위 경로로 시작해 화면을 가로지르는 선을 막습니다.

## MapOutline

국경선이 길이를 따라 그려지고(`duration × 0.7`) 땅이 함께 채워지며, `highlight` 지형은 선이 내려앉은 뒤(`at + duration × 0.6`부터) `accent`로 채워집니다. `MotionProbe` family `shape`, axis `progress`.

| prop | 뜻 |
| --- | --- |
| `duration` | 기본 60 |
| `draw` | 선택. 0..1. 주면 그리기와 채우기를 이 값으로 고정한다 |

```tsx
<MapOutline frame={frame} at={0} duration={80} palette={night} fonts={fonts} src="/assets/generated/map-story/geo/world.geojson"
  projection="mercator" fit={{center: [12, 14], zoom: 1}} width={1920} height={1080} x={0} y={0} stroke={2.5} />
```

강조를 줌이 끝난 뒤에 주려면 강조할 나라만 거른 둘째 항목(같은 축척과 단순화)을 같은 `fit`으로 늦게 겹칩니다. 기하가 같아서 선이 그대로 다시 그려집니다.

## RouteMap

바탕 지도가 `lead`(기본 20) 프레임 동안 그려진 뒤, 점이 대권 경로를 따라 `duration`(기본 90) 동안 이동하고 선이 그 뒤를 따라 그려집니다. 경유지는 점이 지날 때 원과 라벨 판이 튀어나옵니다. `MotionProbe` family `shape`, axis `x`.

| prop | 뜻 |
| --- | --- |
| `route` | `[경도, 위도][]`. 구간마다 약 2°씩 대권 위의 점으로 나눈다 |
| `stops` | 선택. `{at: [경도, 위도], label}[]` |
| `lead` | 기본 20 |
| `duration` | 기본 90 |

```tsx
<RouteMap frame={frame} at={240} out={364} lead={10} duration={95} palette={night} fonts={fonts} size={48} data={{type: 'FeatureCollection', features: []}}
  projection="mercator" fit={fit} width={1920} height={1080} x={0} y={0}
  route={[[126.98, 37.57], [129.08, 35.18], [126.53, 33.5]]} stops={[{at: [126.98, 37.57], label: '서울 · 09:00'}, {at: [129.08, 35.18], label: '부산 · 13:00'}]} />
```

## Markers

바탕이 그려진 뒤 핀이 8프레임 시차로 튀어나오고, `value`가 있는 점은 값의 면적에 비례하는 `accent` 거품이 자라며 라벨 판에 값이 세어 올라갑니다. `MotionProbe` family `card`, axis `scale`.

| prop | 뜻 |
| --- | --- |
| `points` | `{at: [경도, 위도], label, value?}[]` |
| `unit` | 선택. 값 뒤 단위(`건`) |
| `lead` | 기본 20 |

```tsx
<Markers frame={frame} at={360} lead={6} palette={night} fonts={fonts} size={48} unit="건" data={{type: 'FeatureCollection', features: []}}
  projection="mercator" fit={fit} width={1920} height={1080} x={0} y={0}
  points={[{at: [126.98, 37.57], label: '서울', value: 1240}, {at: [129.08, 35.18], label: '부산', value: 860}]} />
```

라벨 판은 점의 오른쪽에 놓입니다. 같은 위도에 가까운 두 점은 판이 겹치므로 점 사이를 판 너비 이상 띄우거나 하나를 뺍니다.

## 겹쳐 쓰기

`examples/samples/map-story`는 카메라 함수 하나가 돌려준 `fit`을 모든 지도 블록에 넘깁니다. 세계 레이어 하나가 처음부터 끝까지 남고, 그 위에 강조 레이어, 경로, 핀이 같은 `fit`과 빈 `data`로 겹쳐서 늘 맞물립니다. 줌은 로그 척도로 보간하고 중심을 먼저 옮겨 목표가 화면 밖으로 흔들리지 않게 합니다. 한 작품 안에서 투영법은 하나만 씁니다.

## 검사

블록 단위 테스트는 `npx tsx --test tests/blocks-maps.test.tsx`(투영, 맞춤, 경로 문자열, 대권, 블록의 등장·정착·결정성, 카탈로그, `geo.py --self-check`)입니다. 작품 검사는 다른 블록과 같습니다(콘택트 시트, `npx tsc --noEmit`, `npm run lint:video`, 전체 렌더, `node bin/frameforge.mjs check`).
