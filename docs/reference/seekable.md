# 시킹 어댑터 (`Seekable`, `useSeekable`)

이미 있는 애니메이션 코드나 라이브러리를 프레임에 맞춰 결정적으로 돌릴 때만 씁니다. 새 움직임은 지금처럼 `useCurrentFrame()`에서 계산하는 React 프레임 함수로 만듭니다. 어댑터는 남의 시계를 멈추고 프레임마다 정해진 시각으로 옮길 뿐이라, 프레임 함수보다 읽기 어렵고 스튜디오 변수와도 연결되지 않습니다.

## 쓰는 법

```tsx
import {Seekable} from 'frameforge';

const keyframes = [{transform: 'translateX(0px)', opacity: 0}, {transform: 'translateX(200px)', opacity: 1}];

<Seekable animate={el => el.animate(keyframes, {duration: 1000, fill: 'both'})} style={{width: 60, height: 60}} />
```

- `<Seekable animate loop? style? children?>`는 div 하나를 그리고, 마운트 때 `animate(div)`를 한 번 부릅니다. 돌려받은 Web Animations 애니메이션은 멈춘 채 `currentTime = frame / fps * 1000`(ms)으로 옮겨집니다. 끝을 넘으면 마지막 상태에 머물고, `loop`이면 처음으로 돌아갑니다. `fill: 'both'`를 주어야 0 이전과 끝 이후에도 키프레임 값이 보입니다.
- `useSeekable(ref, factory, deps = [], loop = false)`는 같은 일을 아무 요소에나 합니다. `factory(element)`는 Web Animations 애니메이션이나 어댑터 `{duration, seek(frame), destroy?(), ready?}`를 돌려줍니다. 어댑터의 `duration`은 작품 프레임 단위이고, `seek`은 [0, duration] 안의 연속 프레임 값을 받습니다(`loop`이면 duration으로 나눈 나머지). 요소마다 한 번(그리고 `deps`가 바뀔 때) 만들고, 매 프레임 layout effect에서 그림이 칠해지기 전에 동기로 시킹합니다. 언마운트 때 어댑터는 `destroy()`, 애니메이션은 `cancel()`합니다.
- 렌더 모드에서는 첫 `ready`(Web Animations의 `animation.ready`, 어댑터는 있으면 그 Promise)가 끝날 때까지 `delayRender`로 프레임을 잡습니다. 실패해도 프레임은 풀립니다.
- 순수 함수: `seekableFrame(frame, fps, durationMs, loop)`는 프레임을 ms로 바꾸고, `seekTarget(source, frame, fps, loop)`는 어댑터에 줄 프레임이나 애니메이션의 `currentTime`을 돌려줍니다. `applySeek`이 그 값을 적용합니다. `tests/seekable.test.tsx`가 계산, 서버 마크업, 가짜 어댑터 시킹, 린트 픽스처를 검사합니다.

## 린트

`npm run lint:video`는 지금처럼 CSS `animation:`, `transition:`, `@keyframes`를 오류로 잡습니다. `el.animate(...)`로 넘기는 키프레임은 브라우저 시계가 아니라 프레임으로 움직이므로 잡지 않습니다(`tests/fixtures/seekable/`이 깨끗하게 통과).

2026-10-24 실행 결과. `tests/fixtures/seekable` 320×180 시트(프레임 0, 15, 30, 45)에서 사각형은 0에서 투명, 15에서 반쯤 이동하고 반투명, 30과 45에서 끝 위치에 불투명으로 머뭅니다.
