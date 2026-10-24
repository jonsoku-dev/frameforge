# 이음새(Seams)

장면마다 따로 움직인 영상은 컷마다 눈의 관성이 끊겨 슬라이드처럼 보인다. 이음새는 컷을 두 장면이 나눠 갖는 하나의 움직임으로 다루는 라이브러리와 검사다. 규칙 전체(벡터 법칙, 흐름, 블러, 이동량)는 `skills/frameforge-best-practices/references/seams.md`에 있고, 이 문서는 API와 검사 명령을 적는다.

## 라이브러리 `src/packages/seams.tsx`

`import {Seam, cutTheCurve, zoomThrough, inverseZoom, waterfallCut, rackFocus, waterfallEntry, nudge} from 'frameforge'`. 모두 프레임의 순수 함수다.

- 타입: `SeamAxis = 'x' | 'y' | 'z'`, `SeamVector = {axis, direction: 1 | -1}`, `SeamSide = {transform, opacity, filter, value}`(`value`는 x·y는 px 오프셋, z는 scale), `SeamStyles = SeamVector & {cut, exit, entry}`.
- 공통 옵션 `SeamOptions`: `frame`, `at`(이음새 시작 프레임), `duration`(전체 길이, 컷은 `at + duration / 2`), `axis`(기본 `'x'`), `direction`(기본 `-1`, 왼쪽), `travel`(기본 프레임 변의 12 %, z는 0.12), `subject`(`'text'` 블러 10 px, `'surface'` 18 px, 기본 surface), `width`/`height`(기본 1920×1080).
- `cutTheCurve(o)`: 나가는 래퍼는 power-4 ease-in으로 `travel`만큼 밀리고, 들어오는 래퍼는 반대편에서 같은 방향으로 power-4 ease-out으로 도착한다. 컷 프레임의 마지막 걸음과 첫 걸음이 같다.
- `zoomThrough(o)`: z, 두 쪽 다 커진다(나가는 쪽 1→1.12, 들어오는 쪽 0.88→1). `inverseZoom(o)`: 두 쪽 다 작아진다. 컷에서 불투명도 바닥 0.35로 무대 색이 비친다.
- `waterfallCut({..., words, stagger = 2})`: 단어별 `SeamStyles[]`. 단어 i는 `stagger`프레임씩 늦게 나가고 새 단어도 같은 순서로 들어온다. 한쪽 길이 `duration / 2 - (words - 1) * stagger`가 0 이하이면 오류.
- `rackFocus(o)`: 같은 축으로 3 % 드리프트 + 컷에서 최대 블러.
- `waterfallEntry({frame, at, index, weight = 1, stagger = 3, height = 1080})` → `{progress, y, opacity, transform}`: 아래에서 높이의 12 %를 올라오고, 뒤 항목과 무거운 항목이 느리다(길이 `14 + 2·index + 6·(weight − 1)`).
- `nudge({frame, at, duration, from, to})` → number: 시간 10/65/25, 거리 6/79/15의 느림-빠름-느림 세 구간, 속도가 끊기지 않는다.
- `<Seam at duration technique axis direction travel subject id from to>`: 컷 전에는 `from`, 컷부터 `to`를 하나의 absolute 래퍼 안에 그리고(블러는 래퍼에만), 래퍼의 값을 `family="camera"` 프로브(`<id>-out`, `<id>-in`, 축 `x`|`y`|`scale`)로 보고한다. `technique`는 `cutTheCurve`(기본) | `zoomThrough` | `inverseZoom` | `rackFocus`. 래퍼가 움직이는 동안만 `data-clip="allow"`가 붙어 세이프 영역 감사가 쉬고, 정지 상태에서는 글자 검사가 그대로 적용된다. `to`에 다음 `<Seam>`을 넣어 이어 붙인다.

## 검사 `scripts/seam-check.mjs`

```sh
npm run seam-check -- renders/samples/<slug>.mp4.motion.json --prompt examples/samples/<slug>/prompt.md
npm run seam-check -- renders/x.mp4.motion.json --scenes 90,240,390 [--window 12] [--width 1920] [--height 1080] [--json]
```

- 입력은 렌더가 MP4 옆에 쓰는 `<output>.motion.json`(`{composition, fps, from, to, samples, sounds}`). `--frames` 콘택트 시트는 쓰지 않는다.
- 경계(컷 프레임): `--scenes`가 있으면 그 값, `--prompt`가 있으면 장면표에서 각 표 행의 첫 `a-b` 범위를 읽어 첫 행을 뺀 나머지 행의 시작 프레임, 둘 다 없으면 프로브 키 집합이 둘 이상 바뀌는 프레임을 추정한다. 마지막 정지 구간은 마지막 장면 행에 넣는다(따로 두면 아무것도 움직이지 않는 경계가 된다).
- 경계마다 나가는 벡터(컷 앞 `window`프레임, 기본 12)와 들어오는 벡터(컷부터 `window`프레임)를 잰다. 값은 프레임 비율로 정규화(x/width, y/height, scale 그대로), 차이는 프로브 키별로 계산하고, 축은 |Δ| 합이 가장 큰 축, 방향은 그 축의 Δ 합 부호, 속도는 그 축의 프레임당 평균 |Δ|. 창 안에 `camera` 가족 프로브가 하나라도 있으면 그것만 본다.
- 경계는 양쪽 창에 모두 `camera` 가족 프로브(`<Seam>`이 보고하는 것)가 있을 때만 측정하고 오류를 낸다. 한쪽이라도 없으면 다른 가족 프로브가 보여 준 벡터를 적은 경고 `seam_unmeasured`만 낸다. `<Seam>`을 쓰지 않는 작품(와이프, 하드컷)은 경고만 받고 실패하지 않으며 종료 코드 0, `PASS with n warning(s)`를 찍는다.
- 코드와 기준: `seam_axis_swap`(축 다름), `seam_mirrored_vector`(같은 축, 반대 부호; z는 push↔pull), `seam_dead_beat`(어느 한쪽이라도 속도 0.0015/프레임 미만: 컷 전에 멈추거나 컷 뒤에 정지에서 출발), `seam_speed_mismatch`(양쪽 다 움직이는데 들어오는 속도/나가는 속도가 0.5–2 밖; 완벽한 거울도 나가는 쪽의 마지막 걸음(컷 프레임으로 가는 걸음)이 표본에 없어 약 1.4로 읽힌다), `seam_pingpong`(측정된 연속한 두 이음새가 같은 축 반대 방향), `seam_no_motion_data`(한쪽에 프로브가 전혀 없음, 경고).
- 렌더 범위 밖 경계는 건너뛰고 목록에 적는다(`--frame-range` 부분 렌더는 그 안의 이음새만 검사). 오류가 있으면 종료 코드 1, `--json`은 `{boundaries, skipped, current, vectors, findings}`를 찍고 finding마다 `fix` 문장이 있다.
- 테스트용 픽스처 `tests/fixtures/seams/clean.motion.json`(통과), `mirrored.motion.json`(`seam_mirrored_vector`). 순수 함수 `seamVector`, `checkSeams`, `parseScenes`, `inferBoundaries`는 `scripts/seam-check.d.mts`로 타입이 있어 테스트가 직접 부른다.

## 샘플

`examples/samples/seam-reel`(가상 브랜드 물길, 30초): 컷 90·240·390·540·690에 cutTheCurve, zoomThrough, waterfallCut, inverseZoom, rackFocus를 하나씩 쓰고, 카드 행에 `nudge`, 제목에 `waterfallEntry`, 첫 이음새를 건너는 동전, 이름 앞의 정지가 있다. `prompt.md`의 장면표가 검사의 경계다.
