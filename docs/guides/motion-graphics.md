# 모션 그래픽 스팟 작성법

이 문서는 Frameforge 엔진으로 15–30초 스팟 한 편을 만드는 전체 과정이다. 근거는 `docs/samples/rules.md`, 샘플 `examples/samples/cafe-morning/`와 `examples/samples/_template/`, 샘플 교차 리뷰(`docs/samples/README.md`), 그리고 실제 코드다. 파일에서 읽은 사실은 그대로 적었다. 추정은 "추정"이라고 표시했다. 에셋(소리, 아이콘, 글꼴, 화면 캡처, 색)은 `docs/guides/assets.md`에 따로 있다.

## 1. 목적 한 문장과 다섯 구간

기획은 한 문장에서 시작한다. 영상이 끝났을 때 보는 사람이 무엇을 기억해야 하는지 적는다. cafe-morning의 목적은 20초가 끝났을 때 보는 사람이 "아침은 가까운 곳에서"를 기억하게 하는 것이다(`examples/samples/cafe-morning/prompt.md`의 Purpose). 이 문장에 기여하지 않는 장면은 뺀다.

구조는 훅, 약속, 변화, 증거, 브랜드의 다섯 구간이다. 15초 열이 기준이다. 20초와 30초 열은 훅을 2–2.5초로 두고 나머지 구간을 늘려 이 가이드가 잡은 값이다. 30fps 기준이다.

| 구간 | 할 일 | 15초 | 20초 | 30초 |
| --- | --- | --- | --- | --- |
| 훅 | 첫 사건. 글자나 큰 형태가 바로 보인다 | 0–60 | 0–60 | 0–75 |
| 약속 | 무엇을 주는지 한 줄 | 60–150 | 60–180 | 75–240 |
| 변화 | 전과 후. 한 물체가 다른 물체가 된다 | 150–270 | 180–360 | 240–540 |
| 증거 | 기능, 숫자(예시 표기), 화면 | 270–390 | 360–480 | 540–780 |
| 브랜드 | 이름과 한 줄. 마지막 60프레임은 정지 | 390–450 | 480–600 | 780–900 |

훅은 2초 안에 끝난다. 교차 리뷰에서 훅이 늦은 샘플이 여럿 나왔다. 3.8초 동안 글자가 없던 초안은 재작업 판정을 받았다.

cafe-morning 20초는 이 표와 조금 다르게 나뉜다. 훅 0–150, 카드 150–375, 약속 350–480, 이름 480–600이고, 540–599는 정지다(`examples/samples/cafe-morning/prompt.md`의 장면표). 겹치는 프레임은 다음 장면이 와이프로 들어오는 시간이다. 구간 경계는 이야기에 맞춰 옮겨도 된다. 다섯 가지 일이 모두 있고 훅과 정지가 제자리에 있으면 된다.

## 2. 기획서는 코드보다 먼저 쓴다

기획서는 두 파일이다. `prompt.md`는 의도와 규칙을, `shots.md`는 장면표를 담는다. 샘플은 둘을 `examples/samples/<slug>/prompt.md` 한 파일에 합쳤다. 샘플보다 긴 작업은 작품 폴더에서 `prompt.md`, `shots.md`, `assets.md` 세 파일로 나눠도 된다. 저장소에는 아직 그렇게 나눈 예가 없다.

`prompt.md`에 들어가는 항목은 다음과 같다(`docs/samples/rules.md`, `examples/samples/_template/prompt.md`).

1. 목적 한 문장.
2. 형식. 크기, fps, 길이, 총 프레임, 장면 ID, 그림 파일 경로, 소리 유무.
3. 화면. 색 3–4개와 hex 값, 글꼴 2가족과 굵기, 헤드라인 최소 크기, 세이프 영역 픽셀.
4. 모션 언어. 쓰는 가족 셋과 카메라 푸시 위치, 플래시 위치.
5. 이야기. 초 단위로 무엇이 무엇이 되는지.
6. 참고 레퍼런스와 이유.
7. 소리. 음악 구간, 타격 시점, 효과음 프레임, 음량.
8. 금지 목록.
9. 검사 프레임 6장 이상.

`shots.md`의 장면표는 절대 프레임으로 쓴다. 열은 신, 시간, 프레임, 화면, 움직임, 글자다. "판 진입 66/72/78프레임, rotateY 20→0, 스프링 14프레임"처럼 코드에 그대로 옮길 수 있는 숫자로 적는다. 상대 시간("훅 다음 1초 뒤")은 쓰지 않는다. 리뷰어가 프레임 번호로 결함을 지적하고, 수정자가 같은 번호로 고치기 때문이다. 교차 리뷰는 장면표와 `Spot.tsx`에서 프레임을 읽어 지적했다.

참고 레퍼런스는 이유와 함께 적는다. "참고했다"로 끝내지 않는다. cafe-morning의 `prompt.md`는 "References and why" 절에 레퍼런스마다 무엇을 가져왔는지 한 줄씩 적었다. 예를 들어 `examples/samples/explainer-patterns/Spot.tsx`에서는 `pop`, `push`, `span` 헬퍼와 `SIZES` 최솟값을 가져왔다. 레퍼런스를 먼저 분석하고, 무엇을 왜 가져오는지 보고한 뒤 타임라인 시트를 만든다.

## 3. 화면

**색.** 3–4개로 정한다. 배경 둘, 강조 하나, 글자 하나가 상한이다(`docs/samples/rules.md`). cafe-morning은 잉크 `#1C1917`, 종이 `#FAF7F2`, 강조 `#D97706`, 연한 노랑 `#FDE68A` 네 개다. 깊이가 필요하면 같은 색의 투명도만 쓴다. 그라데이션은 배경 한 곳까지만 허용된다. cafe-morning 브리프는 그라데이션을 아예 금지했다.

**글꼴.** Google Fonts에서 두 가족까지 쓴다. 디스플레이 하나, UI 하나다. 화면에 한글이 있으면 두 가족 모두 한글 글리프가 있어야 한다. 샘플 네 편이 한글 없는 글꼴(Manrope, Roboto Mono, DM Serif Display, DM Sans)을 썼다가 시스템 글꼴로 폴백했다(`docs/samples/README.md`). 샘플에서 쓴 한글 가능 가족은 아래와 같다. 여섯 가족 모두 2026-10-20에 Google Fonts CSS에 한글 `unicode-range`가 있는 것을 확인했다(검사 방법은 `docs/guides/assets.md` 3절).

| 가족 | 성격 | 쓴 곳 |
| --- | --- | --- |
| Noto Sans KR | UI 기본. 400–900 | 대부분의 샘플 UI |
| Black Han Sans | 굵은 디스플레이 | cafe-morning, light-festival |
| Do Hyeon | 둥근 디스플레이 | kit-launch, shape-noise, three-spin |
| Jua | 부드러운 디스플레이 | route-story, video-collage |
| Gowun Batang | 명조 디스플레이 | transitions-reel |
| IBM Plex Sans KR | 숫자와 데이터 | kit-launch, shape-noise, three-spin |

**세이프 영역.** 글자는 가로 5%, 세로 5% 안에 둔다. 1920×1080에서 좌우 96px, 상하 54px다.

**크기 최소치.** 이 가이드의 기준은 짧은 변 대비 아래 값이다. `docs/samples/rules.md`는 헤드라인 8%, 아이콘 4%로 더 느슨하다. 리뷰가 "웹 페이지 크기" 결함을 반복해서 찾았기 때문에 이 가이드는 기준을 올렸다. 리뷰가 쓴 보조 텍스트 하한 2.5%는 17px 행 글자(1.6%)를 잡아낸 최저선이다. 그 아래는 TV에서 읽히지 않는다.

| 요소 | 짧은 변 대비 | 1080 기준 |
| --- | --- | --- |
| 헤드라인 | 10% | 108px |
| 라벨, 보조 텍스트 | 3.5% | 38px |
| 아이콘 | 6% | 65px |
| 장면 주인공 형태(원, 판, 실드) | 35% | 378px |

cafe-morning의 헤드라인은 120–360px, 카드 제목은 52px, 훅의 컵은 약 560px, 카드는 520×640px다(`examples/samples/cafe-morning/prompt.md`).

## 4. 모션 언어

**세 가족.** 한 편에 쓰는 모션은 세 가족까지다(`docs/samples/rules.md`).

1. 스프링 판. 면, 막대, 원이 `spring({durationInFrames})`로 들어와 짧게 앉는다. cafe-morning의 카드는 `pop(frame, 150 + i * 6, 16, true)`로 300px 아래에서 올라와 넘침 없이 앉는다.
2. 와이프. `clip-path`의 circle이나 inset, 또는 `scaleX`/`scaleY`로 색이 색을 덮는다. 투명도 페이드로 등장시키지 않는다.
3. 글자 올리기. 글자 하나씩 마스크 아래에서 올라온다. 6절의 `Glyphs`가 이 일을 한다.

**카메라 푸시.** 카메라는 가족이 아니라 강조다. 한 편에 두 번까지 쓴다. 충돌, 핵심 기능, 이름 등장처럼 이야기의 정점에만 둔다. 크기는 1.04–1.06이고 사인 곡선으로 밀었다가 돌아온다. cafe-morning은 180–210프레임에 카드 묶음만 1.05로 한 번 민다. kit-launch는 150–190프레임에 1.04로 한 번 민다(`examples/samples/cafe-morning/Spot.tsx`, `examples/samples/kit-launch/Spot.tsx`). 푸시 중 요소가 프레임 밖으로 나가면 안 된다. 잘리면 화면 전체 대신 카드만 민다. light-festival은 1320프레임에 머리 카드 하나만 1.06으로 민다(`examples/samples/light-festival/Spot.tsx`).

**연속성.** 장면은 직전 장면의 물체에서 태어난다. 원이 커져 배경이 되고, 선이 밑줄이 된다. 샘플에서 두 가지 예를 든다.

1. cafe-morning, 컵에서 바탕으로. 96–150프레임에 연한 노랑 원이 훅의 컵 자리(960, 400)에서 `clipPath: circle()`로 반지름 1600px까지 커져 화면을 덮는다. 그 노랑이 카드 장면의 바탕이다. 350–372프레임에는 강조색이 `inset` 와이프로 왼쪽에서 들어오고, 390–420프레임에 그 위로 종이색 컵이 다시 그려진다(`examples/samples/cafe-morning/Spot.tsx`).
2. kit-launch, 전구에서 바탕으로. 90–130프레임에 연한 색 원이 훅의 전구 중심(960, 370)에서 `clipPath: circle()`로 반지름 1400px까지 커져 화면을 덮는다. 그 색이 다음 장면의 바탕이다(`examples/samples/kit-launch/Spot.tsx`).

연속성이 깨지는 전형은 빈 화면이다. 초안 모두에 30–66프레임의 거의 빈 구간이 있었다. 원인은 직전 물체가 사라진 뒤 다음 글자가 늦게 시작하는 것이었다. 직전 장면의 마지막 물체가 사라지기 전에 다음 글자를 시작한다.

**하드컷 리듬.** 컷의 위치와 빈도는 사건·음악·읽기 시간에 맞춘다. 박자에 맞추거나 의도적으로 벗어날 수 있으며, 밝기 변화는 실제 저장 영상의 플래시 검사로 확인한다. 샘플의 특정 배경색 순서를 모든 작품에 강제하지 않는다.

**방송 플래시 기준.** 풀프레임 플래시는 2프레임, 한 편에 두 번까지다. 렌더 뒤 `node scripts/flash-check.mjs <video.mp4> [fps]`로 검사한다. 이 스크립트는 화면의 25% 이상에서 밝기가 전체 범위의 10% 이상 바뀌면 전환 하나로 센다. 반대 방향 전환 두 개가 플래시 하나다. 어느 1초 창에서든 플래시가 셋을 넘으면 실패한다. Ofcom 지침의 근사이며 Harding 인증이 아니다.

**읽기와 끝 정지.** 정지와 보조 움직임은 장면의 목적에 맞춘다. 진단을 통과하려고 드리프트를 추가하지 않는다. 기본 frame-check가 마지막 1초를 제외해 측정하는 것은 도구의 기준이며, 작품의 정지 시간을 제한하는 연출 규칙이 아니다. 실제 검사 결과와 의도된 홀드의 충돌은 그대로 보고하고, 필요한 읽기 시간을 저장 영상에서 확인한다.

## 5. 결정성과 금지 목록

모든 값은 프레임 번호의 함수다. 같은 프레임을 두 번 그리면 같은 화면이 나와야 한다. 렌더러는 프레임을 하나씩 따로 캡처하기 때문이다(`scripts/render.mjs`). 아래는 금지 항목과 이유다.

| 금지 | 이유 |
| --- | --- |
| `Math.random` | 렌더마다 값이 다르다. `random('seed')`를 쓴다 |
| `Date`, `performance.now` | 벽시계 시간은 프레임과 무관하다 |
| React state, effect | 재생 기록에 의존한다. 프레임을 건너뛰어 캡처하면 값이 틀린다 |
| CSS transition, animation | 브라우저 시계로 움직여 캡처 시점마다 다르다 |
| 아이콘 웹폰트·아이콘 라이브러리 | 로드 시점이 비결정이거나 그려 둔 주인공과 선이 맞지 않는다. 모티프 키트(`@/assets`)나 `assets.json`을 `npm run art`로 해결해 `<Art>`로 그린 SVG, 또는 직접 그린 인라인 SVG를 쓴다. 예외는 실제 화면 설명 영상의 콜아웃 표식으로 쓰는 `lucide-react`뿐이다 |
| 글로우, 먼지 파티클, 렌즈 플레어 | "AI처럼 보이는" 기본값 목록(`docs/samples/rules.md`) |
| 프레임 테두리, 가짜 휴대폰 베젤, 얼굴, 보석 | 같은 이유. `rules.md` 금지 항목 |
| 모든 요소의 바운스 | 오버슈트는 헤드라인 글자 올리기에만 작게 허용 |
| 페이드만으로 등장 | 연속성 규칙 위반. 와이프나 스프링을 쓴다 |
| 실제 회사, 제품, 로고, 수치 | 샘플 브랜드는 가상이다. 숫자에는 "예시"나 "샘플 데이터"를 붙인다 |

실제 제품을 보여 주는 설명 영상은 예외다. 실제 화면을 일부러 쓴다. 그 대신 "캡처한 화면에 있는 것만 보여 주고 아무것도 만들어 내지 않는다"가 규칙이다(`docs/guides/product-explainer.md`, `assets.md` 4절).

## 6. 글자 마스크와 잘림 가드

**Gothic A1이 잘린 이유.** Gothic A1 900의 잉크는 기준선 위 0.87em까지 올라간다. `lineHeight: 1`인 줄 상자는 위로 0.8em만 담는다. 그래서 `overflow: hidden` 마스크가 글자 윗부분을 잘랐다(`examples/samples/explainer-patterns/Spot.tsx`의 `Glyphs` 주석).

**여유를 둔 마스크.** 마스크를 키우되 글자 위치는 그대로 둔다. 안쪽 여백을 늘리고 같은 크기의 음수 바깥 여백으로 되돌린다. Gothic A1은 위 0.1em, 좌우 0.06em이다.

```tsx
<span style={{display: 'inline-block', overflow: 'hidden', height: '1.15em',
  paddingTop: '0.1em', marginTop: '-0.1em', paddingInline: '0.06em', marginInline: '-0.06em'}}>
```

글꼴마다 잉크 높이가 달라 여유도 다르다. 샘플 코드에서 읽은 값이다.

| 글꼴 | 마스크 높이 | 위 | 아래 | 좌우 | 파일 |
| --- | --- | --- | --- | --- | --- |
| Gothic A1 900 | 1.15em | 0.1em | 0 | 0.06em | `examples/samples/explainer-patterns/Spot.tsx` |
| Black Han Sans | 1.3em | 0.15em | 0 | 0.08em | `examples/samples/cafe-morning/Spot.tsx` |
| Do Hyeon | 1.3em | 0.15em | 0 | 0.08em | `examples/samples/kit-launch/Spot.tsx` |
| Jua | 1.4em | 0.3em | 0 | 0.12em | `examples/samples/route-story/Spot.tsx` |
| Gowun Batang | 1.3em | 0.15em | 0 | 0.08em | `examples/samples/transitions-reel/Spot.tsx` |
| Black Han Sans | 1.2em | 0.1em | 0.1em | 0.06em | `examples/samples/light-festival/Spot.tsx` |

Noto Sans KR의 괄호는 1.15em 상자 아래로 내려간다. 괄호가 잘리면 아래에도 0.1em을 둔다.

**가드가 하는 일.** `src/studio/textGuard.ts`의 `findClippedText`가 검사한다. 순서는 다음과 같다.

1. 모든 텍스트 노드에서 가장 가까운 잘림 조상을 찾는다. `overflow`가 visible이 아니거나 `clip-path`가 있는 요소, 또는 컴포지션 루트다.
2. 캔버스 `measureText`로 그 글자의 실제 잉크 범위를 잰다.
3. 잉크가 조상 상자를 0.5px 넘게 벗어나면 위, 아래, 왼쪽, 오른쪽 중 어느 쪽인지와 픽셀 수를 보고한다.

글자와 마스크 사이의 이동(translate)은 등장 애니메이션으로 보고 빼고 계산한다. 즉 글자가 쉬는 위치에서 검사한다. 확대와 회전은 그대로 검사한다.

**보고 방식.** 렌더는 프레임마다 검사하고 하나라도 걸리면 `Clipped text: "퍼즐" top 8.3px` 오류로 그 프레임을 실패시킨다(`src/studio/runtime.tsx`). 한 프레임이라도 실패하면 인코딩 없이 멈춘다. 스튜디오는 잘린 글자에 3px 빨간 테두리를 그리고 아래 막대에 `글자 잘림 N곳`을 띄운다. 웹폰트가 바뀌면 잉크 치수도 바뀌므로 `document.fonts.ready` 뒤에 한 번 더 검사한다.

**`data-clip="allow"`.** 일부러 프레임 밖으로 흐르는 띠에만 붙인다. 지금 저장소의 샘플 중 이 속성을 쓰는 편은 없다. 가드는 이 속성 안쪽의 텍스트를 건너뛴다. 가드가 잡은 일반 글자에 이 속성을 붙여 오류를 끄지 않는다. 마스크 여유를 늘려 고친다(샘플 첫 라운드의 공통 브리프 규칙이다. 그 파일은 로컬 `.scratch/`에만 있고 저장소에는 없다).

## 7. 코드 패턴

모든 패턴은 `examples/samples/explainer-patterns/Spot.tsx`에 있고 cafe-morning, kit-launch 같은 샘플이 같은 모양으로 복사해 쓴다. 헬퍼를 공용 모듈로 빼지 않은 것은 각 작품이 파일 하나로 읽히게 하려는 선택이다(추정. 샘플 브리프가 "참조 영화의 헬퍼 밖의 추상화 금지"라고 적었다).

**`useCurrentFrame()`은 루트에서 한 번.** 장면 컴포넌트는 `frame`을 props로 받는다. 모든 장면이 같은 프레임 값을 보고, 장면을 겹쳐 그릴 때 시간 기준이 어긋나지 않는다.

```tsx
export function CafeMorning() {
  const frame = useCurrentFrame();
  ...
  {frame >= 480 ? <Name frame={frame} /> : null}
```

**`span`.** `from`부터 `dur`프레임 동안 0에서 1로 가는 ease-out 값이다. 와이프, 접힘, 이동에 쓴다.

```tsx
function span(frame: number, from: number, dur: number): number {
  return interpolate(frame, [from, from + dur], [0, 1], {...clamp, easing: ease});
}
```

**`pop`.** `at`에서 시작하는 스프링이다. `settle`이 true면 오버슈트 없이 앉는다. 판과 원은 `settle`을 켜고, 헤드라인 착지는 끈다.

```tsx
function pop(frame: number, at: number, dur: number, settle = false): number {
  return spring({frame, fps: 30, delay: at, durationInFrames: dur, config: {overshootClamping: settle}});
}
```

**`push`.** 카메라 푸시 하나다. 중간에 `1 + amount`까지 갔다가 돌아온다. 두 번 쓰려면 `_template`처럼 곱한다.

```tsx
function push(frame: number, at: number, dur: number, amount: number): number {
  const t = interpolate(frame, [at, at + dur], [0, 1], clamp);
  return 1 + amount * Math.sin(t * Math.PI);
}
const camera = push(frame, AT.beat2 + 36, 30, 0.04) * push(frame, AT.name, 30, 0.04);
<AbsoluteFill style={{transform: `scale(${camera})`}}>...장면들...</AbsoluteFill>
```

화면 캡처를 미는 카메라는 확대 중심도 움직여야 한다. 대상 중심으로 옮기는 계산과 가장자리 틈을 막는 중심 자르기는 `docs/guides/product-explainer.md` 5절에 있다.

**`Glyphs`.** 글자마다 `span`으로 0에서 1이 되는 값 `rise`를 구한다. 안쪽 span을 `translateY((1 - rise) * 120%)`로 올린다. `rise`가 0인 동안은 `visibility: hidden`이다. 바깥 span이 6절의 마스크다. `stagger`가 글자 간격(프레임)이다. 퇴장이 필요하면 `out` 프레임에서 `rise`를 다시 빼면 된다.

**`Sequence`와 `Audio`.** 음악은 루트에 `Audio` 하나다. 효과음은 움직임에서 나온다. 움직이는 요소에 `<MotionProbe>`를 달고 루트에서 `<MotionSound>`로 소리 파일을 매핑하면 엔진이 움직임의 시작·착지·등장 프레임에 소리를 놓는다(`examples/samples/explainer-patterns/Spot.tsx`). 움직임이 없는 사건만 사건과 같은 프레임의 `Sequence` 안에 `Audio`를 손으로 둔다. `layout="none"`이라 화면 배치에 영향이 없다. 렌더러는 0.5초보다 가깝거나 4초 안에 3개를 넘는 효과음을 거부한다. 아래는 카운트가 끝나는 프레임에 손으로 놓는 형태다.

```tsx
<Audio src="/audio/generated/<slug>/music.wav" volume={0.9} />
<Sequence from={COUNT_END} durationInFrames={30} layout="none">
  <Audio src="/audio/generated/<slug>/ding.wav" volume={0.6} />
</Sequence>
```

장면은 조건부 렌더로 겹친다. `{frame >= 480 ? <Name frame={frame} /> : null}`처럼 다음 장면이 직전 장면 위에 와이프로 들어온다. 그래서 투명도 크로스페이드가 필요 없다. `entry.tsx`는 `registerRoot`로 컴포지션 하나만 등록한다(`examples/samples/cafe-morning/entry.tsx`).

## 8. 자기 검사 루프

전체 렌더 전에 정지 화면으로 고친다. 순서는 이렇다. 비트마다 한 장을 보고, 가장 나쁜 세 문제를 프레임 번호와 함께 적고, 그 구간만 고친다.

1. **키프레임 캡처.** 자기 포트의 개발 서버를 띄우고 CDP 스크립트로 장면마다 한 장 이상, 최소 6장을 찍는다. 샘플 라운드에서는 로컬 `.scratch/samples/shoot.mjs`(`.scratch/`는 gitignore라 저장소에 없다)를 썼다. 저장소만 받았다면 아래 2번의 `--frames` 컨택트 시트가 같은 일을 한다. 개발 서버의 기본 포트는 4317이고, 렌더러는 자기 Vite를 기본 포트 4318에 띄운다. 여럿이 동시에 렌더할 때는 `FRAMEFORGE_PORT`로 포트를 나눈다.

```sh
VIDEO_ENTRY=examples/samples/<slug>/entry.tsx npx vite --host 127.0.0.1 --port <PORT>
```

2. **컨택트 시트.** 렌더러에 `--frames`를 주면 그 프레임만 그려 PNG 한 장으로 타일한다(열 4개, 칸 폭 480px). 글자 잘림 가드도 이때 같이 돈다.

```sh
npm run render -- examples/samples/cafe-morning/entry.tsx CafeMorning renders/samples/cafe-morning-sheet.png --frames 20,60,120,180,240,300,360,420,480,540,599
```

글자 올리기 중간 프레임은 시트에서 "작은 글자 하나가 아래에 걸린 모양"으로 찍혀 결함처럼 보인다. 검사 프레임은 글자 올리기가 끝난 시점을 고른다.

3. **15프레임 스트립.** 인코딩한 MP4에서 15프레임마다 한 장을 뽑아 한 장으로 붙인다. 샘플은 `renders/samples/<slug>-strip.png`로 남겼다. 이 저장소에 스트립 전용 스크립트는 없다. 아래 명령은 600프레임 작품에서 40칸 스트립을 만든다.

```sh
ffmpeg -i renders/samples/<slug>.mp4 -vf "select='not(mod(n\,15))',scale=320:-1,tile=8x5" -frames:v 1 renders/samples/<slug>-strip.png
```

스트립은 시트가 놓친 빈 구간과 긴 정지를 보여 준다. `node scripts/frame-check.mjs <video.mp4>`는 같은 것을 숫자로 잰다. 거의 빈 프레임, 45프레임 넘게 멈춘 구간, 가운데로 몰린 구도를 찾는다.

4. **교차 리뷰.** 작성하지 않은 모델이 시트와 코드를 보고 심사한다. 기준은 여섯이다(`docs/samples/README.md`).

| 기준 | 보는 것 |
| --- | --- |
| 훅 | 2초 안에 글자나 핵심 사건이 있는가 |
| TV 가독성 | 보조 텍스트까지 3절의 최소치를 넘는가 |
| 연속성 | 장면이 직전 물체에서 태어나는가 |
| 완급과 빈 화면 | 30프레임 넘게 거의 빈 구간이 있는가 |
| 가상 브랜드 준수 | 실제 이름, 로고, 수치가 없고 예시 표기가 있는가 |
| 세이프 영역 | 글자가 5% 여백 안에 있는가 |

리뷰는 판정(fix 또는 rework)과 프레임 번호가 달린 수정 순위 다섯 개를 낸다. 수정은 원 작성 모델의 새 에이전트가 목록 전체를 적용한다.

**샘플에서 반복된 결함.** 교차 리뷰와 `docs/samples/README.md`에서 모았다.

| 결함 | 예 | 고친 방법 |
| --- | --- | --- |
| 보조 텍스트가 웹 크기 | 행 17.6px, 독 라벨 16px, 부제 실효 16.5px | 행 34px, 독 배율 0.27→0.42, 부제 29px. 축소 블록 안의 글자는 축소 뒤 크기로 잰다 |
| 빈 구간 | 122–188에 48px 점 하나, 258–350, 458–540 | 다음 글자 시작을 당기고 전환을 겹친다. 기호 간격 10→5프레임 |
| 한글 없는 글꼴 | Manrope, Roboto Mono, DM Serif Display, DM Sans | Noto Sans KR, Gowun Batang, IBM Plex Sans KR로 교체 |
| 늦은 훅 | 첫 글자 3.8초, 이름 4.7초 완성 | 첫 글자 시작을 당기고 stagger를 줄인다. 인용 1줄 114→48 |
| 요소가 프레임에 비해 작음 | 목록 폭 1/3, 파형 폭 50% | 주인공 형태를 35% 이상으로, 목록을 프레임 끝까지 |
| 마지막 2초 움직임(옛 규칙) | 정지 1.4초 | 지금 규칙은 끝 정지 1초 이하, 그 앞은 보조 움직임 |

남은 예외도 기록한다. 처음 2초가 선 하나인 경우나 검정 위 글자 하나만 2초 보이는 경우가 그렇다.

## 9. 체크리스트

각 항목은 예 또는 아니오로 답한다. 하나라도 아니오면 고친다.

**기획**
- [ ] `prompt.md`에 목적 한 문장이 있다.
- [ ] 장면표가 절대 프레임으로 적혀 있다.
- [ ] 레퍼런스마다 가져온 것과 이유가 한 줄씩 있다.
- [ ] 검사 프레임이 6개 이상 적혀 있다.

**화면**
- [ ] 색이 4개 이하이고 hex로 적혀 있다.
- [ ] 글꼴이 2가족 이하이고 한글 문자열의 글꼴에 한글 글리프가 있다.
- [ ] 헤드라인이 짧은 변의 10% 이상이다.
- [ ] 라벨과 보조 텍스트가 축소 뒤에도 3.5% 이상이다.
- [ ] 아이콘이 6% 이상, 장면 주인공 형태가 35% 이상이다. 둘 다 직접 그렸고 선 굵기와 모서리가 같다.
- [ ] 모든 글자가 세이프 영역(5%) 안에 있다.

**모션**
- [ ] 모션 가족이 셋 이하다.
- [ ] 카메라 푸시가 두 번 이하이고 푸시 중 잘리는 요소가 없다.
- [ ] 모든 장면이 직전 물체에서 태어난다. 페이드만으로 등장하는 요소가 없다.
- [ ] 30프레임 넘게 거의 빈 구간이 없다.
- [ ] 첫 60프레임 안에 글자나 핵심 사건이 있다.
- [ ] 헤드라인이 다음 큰 전환 전에 36프레임 이상 읽힌다.
- [ ] 하드컷 간격이 30프레임 이상이고 검정과 흰색이 바로 붙지 않는다.
- [ ] 풀프레임 플래시가 2프레임씩 두 번 이하다.
- [ ] 마지막 60프레임에 글자가 움직이지 않는다.

**코드**
- [ ] `useCurrentFrame()`이 루트에 한 번만 있다.
- [ ] `Math.random`, `Date`, state, effect, CSS 애니메이션이 없다.
- [ ] `data-clip="allow"`는 일부러 흐르는 띠에만 있다.
- [ ] 효과음은 모션 프로브와 `MotionSound`에서 나온다. 손으로 놓은 것은 움직임 없는 사건뿐이고, 렌더 로그 `motionSounds`의 프레임이 화면 사건과 맞는다.

**검사**
- [ ] `--frames` 컨택트 시트가 가드 오류 없이 나왔고 모든 칸을 봤다.
- [ ] 15프레임 스트립을 봤다.
- [ ] `node scripts/flash-check.mjs`가 통과했다.
- [ ] 통합 음량이 −24 ±2 LKFS 안이다.
- [ ] `npm run build`와 `npm test`가 통과했다.
- [ ] 작성하지 않은 모델이 여섯 기준으로 리뷰했고 목록을 모두 적용했다.
