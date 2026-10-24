# Remotion 픽셀 동등성 측정

측정일은 2026-10-20이다. 대상은 당시 저장소에 있던 공개 커뮤니티 예제 여섯 컴포지션이고(2026-10-21에 저장소에서 지웠다), 각 컴포지션의 30프레임과 90프레임을 실제 Remotion 4.0.537과 Frameforge로 각각 렌더해 비교했다. 결론부터 말하면 내용이 있는 프레임 가운데 PSNR 40 dB를 넘는 쌍은 하나도 없다. 차이의 큰 부분은 글리프 래스터화가 아니라 Frameforge 쪽 레이아웃 기본값 세 가지에서 나온다. 컴포지션 요소의 `box-sizing`, `Sequence` 래퍼의 flex 방향, 기본 글꼴이다.

## 방법

Remotion 쪽은 프로젝트 밖의 임시 디렉터리 `<scratch>/parity/remotion-project/`에 `npm init -y` 후 `remotion@4.0.537`, `@remotion/cli@4.0.537`, `react@19.3.0`, `react-dom@19.3.0`을 설치했다. 컴포지션 파일은 `examples/community/compositions/`를 그대로 복사했다. `src/Root.jsx`는 `examples/community/index.jsx`와 같은 id, 1920x1080, 30 fps, 같은 길이로 여섯 개를 등록하고 `src/index.js`가 `registerRoot`를 호출한다. `npm init -y`가 넣은 `"type": "commonjs"`는 Remotion 번들러가 ESM 진입 파일을 거부하게 만들어서 지웠다. `remotion.config.ts`는 필요 없었다. 스틸은 다음 명령으로 만들었다.

```
npx remotion still src/index.js <Id> ../stills/remotion-<Id>-<n>.png --frame <n> --image-format png --scale 1 --overwrite
```

Remotion은 자체 `chrome-headless-shell`(Chromium 157.0.8080.0)로 렌더한다. Frameforge 쪽은 `VIDEO_ENTRY=examples/community/index.jsx npx vite --host 127.0.0.1 --port 4400`(Vite 8.3.4)로 개발 서버를 띄우고, 설치된 Google Chrome 155.0.8059.85를 `--headless=new`로 실행해 CDP로 `window.__FRAMEFORGE__.renderFrame(id, n)`을 호출한 뒤 `Page.captureScreenshot`으로 1920x1080, deviceScaleFactor 1 PNG를 찍었다. 캡처 스크립트는 `<scratch>/parity/shoot.mjs`다. 두 렌더러 모두 Chrome 계열이지만 브라우저 빌드가 다르므로 안티앨리어싱과 그라디언트 디더링은 처음부터 같다고 기대할 수 없다.

Frameforge는 BarChart의 두 프레임에서 `Clipped text: "使用 spring 实现弹性生长" bottom 18.2px` 오류로 렌더를 거부한다. 이 검사는 프레임 페인트가 끝난 뒤에 돌기 때문에, 캡처 스크립트 사본은 이 오류만 기록하고 스크린샷을 그대로 찍는다. 즉 BarChart의 Frameforge 스틸은 실제 Frameforge 렌더 파이프라인이라면 내보내지 않았을 프레임이다. (box-sizing 수정 후에는 잘림이 사라져 가드가 통과한다. 아래 "수정 후 재측정" 절.)

비교는 `<scratch>/parity/compare.py`가 한다. ffmpeg 7.1.1은 `-lavfi "psnr;ssim"`을 그대로 받지 않아서(입력 하나를 두 필터가 나눠 쓸 수 없다) `[0]split[a0][a1];[1]split[b0][b1];[a0][b0]psnr;[a1][b1]ssim`으로 바꿨다. 정확 일치 비율은 numpy로 `np.mean(np.all(a == b, axis=-1))`을 계산했다. 가장자리 집중도는 Remotion 프레임의 휘도에 Sobel을 적용해 크기 40을 넘는 화소를 가장자리로 잡고 2 px 팽창한 뒤, 다른 화소 가운데 그 안에 드는 비율이다. 이 값이 높으면 차이가 글자 윤곽에 몰려 있다는 뜻이고 낮으면 윤곽 밖의 넓은 영역이 다르다는 뜻이다. 차이 이미지는 `blend=all_mode=difference` 결과를 8배 증폭(`lutrgb=val*8`)해서 저장했다.

## 결과

스틸은 `<scratch>/parity/stills/remotion-<Id>-<n>.png`와 `<scratch>/parity/stills/frameforge-<Id>-<n>.png`, 차이 이미지는 `<scratch>/parity/diffs/diff-<Id>-<n>.png`에 있다. 원본 수치는 `<scratch>/parity/results.txt`에 있다.

| 컴포지션 | 프레임 | PSNR (dB) | SSIM | 정확 일치 비율 | 가장자리 집중도 | 판정 |
|---|---|---|---|---|---|---|
| Typewriter | 30 | 25.76 | 0.9813 | 0.9865 | 0.858 | 레이아웃 같음, 글리프 폭 차이로 가운데 정렬 텍스트가 밀림 |
| Typewriter | 90 | 25.56 | 0.9804 | 0.9857 | 0.854 | 위와 같음 |
| FadeInFadeOut | 30 | 19.58 | 0.9724 | 0.9843 | 0.468 | 레이아웃 다름, 제목 가로 위치 |
| FadeInFadeOut | 90 | 무한대 | 1.0000 | 1.0000 | 해당 없음 | 빈 프레임, 두 렌더러 일치 |
| BarChart | 30 | 16.09 | 0.8921 | 0.7174 | 0.106 | 레이아웃 다름, 차트가 아래로 밀리고 캡션 잘림 |
| BarChart | 90 | 13.00 | 0.8293 | 0.6058 | 0.113 | 위와 같음 |
| SpringPhysics | 30 | 18.72 | 0.9408 | 0.9158 | 0.223 | 레이아웃 다름, 내용 전체가 약 100 px 오른쪽 아래로 이동 |
| SpringPhysics | 90 | 16.18 | 0.8924 | 0.8360 | 0.204 | 위와 같음 |
| SlideTransition | 30 | 무한대 (흰 배경 합성 후) | 1.0000 | 1.0000 | 해당 없음 | 빈 프레임, 두 렌더러 일치 |
| SlideTransition | 60 | 26.98 | 0.9846 | 0.9902 | 0.761 | 레이아웃 같음, 기본 글꼴 다름 (보조 측정) |
| SlideTransition | 90 | 무한대 (흰 배경 합성 후) | 1.0000 | 1.0000 | 해당 없음 | 빈 프레임, 두 렌더러 일치 |
| StarrySky | 30 | 24.89 | 0.9675 | 0.5356 | 0.034 | 별 위치 다름, 배경 그라디언트 디더링 다름, 기본 글꼴 다름 |
| StarrySky | 90 | 24.87 | 0.9676 | 0.5351 | 0.035 | 위와 같음 |

SlideTransition 30과 90은 Remotion이 알파 0인 투명 PNG를 내고 Frameforge 캡처는 흰 페이지 배경 위에 합성되므로, 원본 그대로 비교하면 PSNR 0 dB, 일치 0이 나온다. 표의 값은 Remotion 스틸을 흰 배경에 합성한 `remotion-SlideTransitionOnWhite-<n>.png`로 비교한 것이다. 60프레임은 과제의 두 프레임 밖이지만, SlideTransition이 30과 90에서 아무것도 그리지 않아서 내용이 있는 프레임 하나를 더 쟀다.

내용이 있는 프레임은 전부 PSNR 40 dB 미만이다. 가장 높은 SlideTransition 60도 27 dB이다. 레이아웃이 같은 Typewriter와 SlideTransition 60조차 26 dB 안팎인 것은 두 브라우저 빌드의 글리프 래스터화와 글꼴 대체가 다르기 때문이고, 이 조합에서 40 dB는 도달할 수 없는 기준이다. 그래서 판정은 PSNR보다 가장자리 집중도와 차이 이미지의 모양으로 내렸다. 차이 이미지에 글리프 윤곽보다 큰 구조가 보이는 쌍은 FadeInFadeOut 30, BarChart 30과 90, SpringPhysics 30과 90, StarrySky 30과 90이다.

## 컴포지션별 관찰

**StarrySky.** 별 위치는 같지 않고, 같을 수도 없다. 이 컴포지션은 Remotion의 `random()`을 import하지 않고 `Math.random()`을 직접 호출한다. 그래서 Frameforge의 `random`을 Remotion 수열에 맞춘 작업은 이 행에 적용되지 않는다. Remotion끼리도 같은 프레임 30을 두 번 렌더하면 결과가 다르다. 두 번째 렌더 `<scratch>/parity/stills/remotion-StarrySky-30-run2.png`와의 정확 일치 비율은 0.9910이고, 차이 이미지 `<scratch>/parity/diffs/diff-StarrySky-remotion-run1-vs-run2-30.png`에는 별만 보이고 글자와 배경은 그대로다. Frameforge와의 차이 가운데 96%는 채널값 3 이하이고, 차이 이미지에 동심원 무늬로 나타난다. 방사형 그라디언트 배경의 디더링이 두 브라우저에서 다르다는 뜻이다. 제목과 캡션은 Remotion에서 세리프, Frameforge에서 산세리프로 그려진다. Frameforge의 `random()` 동등성은 이 측정으로 검증되지 않았다.

**SlideTransition.** 30과 90이 빈 프레임인 것은 컴포지션 코드 때문이다. 1번 장면은 왼쪽 외삽을 막지 않아서 60프레임 전에는 1920 px 오른쪽 화면 밖에 있다. 2번 장면은 `Sequence` 안에서 이미 지역 프레임인 값에서 90을 다시 빼서 화면에 들어오지 못한다. 두 렌더러가 같은 프레임을 비우는 것은 `Sequence` 지역 프레임 계산이 일치한다는 증거다. Remotion에서 0, 30, 60, 90, 120, 150프레임을 찍어 보면 60만 내용이 있다. 60프레임에서 레이아웃은 같고, 차이는 글자 모양이다. 컴포지션이 `fontFamily`를 지정하지 않는데, Remotion은 브라우저 기본 세리프 글꼴을 쓰고 Frameforge는 `src/studio/style.css`의 `.frame-canvas`가 `Arial, "Apple SD Gothic Neo", sans-serif`를 지정한다.

**SpringPhysics.** 흰색 요소의 경계 상자가 Remotion에서 (370, 301), Frameforge에서 (473, 401)부터 시작한다. 약 (+100, +100) 이동이다. 이 컴포지션은 크기 100%인 `AbsoluteFill`에 `padding: 100`을 준다. Remotion 렌더 페이지에서 계산된 스타일을 찍는 프로브 컴포지션(`<scratch>/parity/remotion-project/src/probe.jsx`, 결과 `<scratch>/parity/probe/probe-crop.png`)으로 확인하면 Remotion에서는 일반 `<p>`까지 모든 요소가 `box-sizing: border-box`다. Frameforge의 `src/studio/style.css`는 `.frame-canvas`와 그 하위를 border-box 규칙에서 빼므로 컴포지션 요소가 content-box가 되고, 상자가 2120x1280으로 커져 가운데 정렬된 내용이 100 px씩 밀린다. 이동량은 측정값이고 원인은 이 두 사실에서 추론한 것이다.

**BarChart.** SpringPhysics와 같은 `padding: 100` 구조이고, 안쪽 차트에 `padding: 40`이 하나 더 있다. 흰색 요소의 시작점은 (397, 177)에서 (465, 237)로, 끝점은 (1521, 788)에서 (1653, 928)로 움직였다. 차트가 아래로 밀리면서 하단 캡션이 프레임 밖으로 18.2 px 나가고, 이것이 Frameforge 클리핑 검사가 렌더를 거부한 이유다. Remotion 스틸에서는 캡션이 잘리지 않는다. 가드가 잘못 울린 것이 아니라 Frameforge의 box-sizing 결함을 정확히 잡은 것이었다(수정 후 통과). 막대 높이도 차이 이미지에서 다르게 보이는데, 차트 상자 크기가 달라진 결과인지 spring 값이 다른지는 이 측정으로 구분하지 못했다.

**FadeInFadeOut.** 30프레임 제목이 Remotion에서는 x 2부터, Frameforge에서는 x 713부터 그려진다. 세로 위치는 같다. 프로브 결과 Remotion의 `Sequence` 래퍼는 `display: flex; flex-direction: row`다. Frameforge의 `Sequence`는 `src/core/index.tsx`의 `AbsoluteFill`(flex-direction column)로 감싼다. column에서는 블록 자식이 전체 폭으로 늘어나 `textAlign: center`가 글자를 가운데로 보내고, row에서는 자식이 내용 폭으로 줄어 왼쪽에 붙는다. 90프레임은 두 렌더러 모두 배경색 한 가지다. 2번과 3번 문구도 지역 프레임에서 `delay`를 한 번 더 빼서 끝내 보이지 않는다.

**Typewriter.** 녹색 제목의 세로 범위는 두 쪽 모두 455부터 527까지로 같고, 가로 범위는 Remotion 638부터 1302, Frameforge 672부터 1267이다. 같은 `Courier New, monospace`를 지정했는데도 글자열 폭이 664 px과 595 px으로 다르다. CJK 글리프의 대체 글꼴이 두 브라우저에서 다르게 고른 결과로 추정한다. 차이의 86%가 글자 윤곽 근처에 있어서 레이아웃 차이는 아니다.

## 수정 후 재측정 (2026-10-20, 같은 날)

위 측정이 드러낸 Frameforge 결함 셋을 고치고 Frameforge 스틸만 다시 찍어 같은 Remotion 스틸과 비교했다. 고친 것은 `src/studio/style.css`(컴포지션 루트와 그 아래 모든 요소를 `box-sizing: border-box`로, 기본 글꼴을 브라우저 기본으로)와 `src/core/index.tsx`(`Sequence`의 `absolute-fill` 래퍼를 `AbsoluteFill` 열 대신 Remotion 관측값과 같은 flex row `div`로)다. 세 가지 모두 Remotion 소스가 아니라 위의 프로브 컴포지션이 출력한 계산된 스타일에서 얻은 사실이다.

| 컴포지션 | 프레임 | PSNR dB (전 → 후) | SSIM (후) | 정확 일치 비율 (후) | 비고 |
| --- | --- | --- | --- | --- | --- |
| Typewriter | 30 | 25.76 → 25.76 | 0.9813 | 0.9865 | 변화 없음. 글리프 래스터 차이만 남음 |
| FadeInFadeOut | 30 | 19.58 → 78.64 | 1.0000 | 0.9991 | 레이아웃 차이 해소. 남은 차이 1843픽셀, 모두 글자 가장자리 |
| BarChart | 30 | 16.09 → 35.66 | 0.9949 | 0.9764 | 레이아웃 차이 해소. 캡션 잘림도 사라져 가드가 통과 |
| BarChart | 90 | 13.00 → 35.65 | 0.9947 | 0.9502 | 같음 |
| SpringPhysics | 30 | 18.72 → 24.53 | 0.9799 | 0.9543 | 큰 이동은 해소. 파란 원이 약 4px 오른쪽·아래에 남아 있고 원인은 못 찾음 |
| SpringPhysics | 90 | 16.18 → 23.22 | 0.9660 | 0.9171 | 같음 |
| SlideTransition | 60 | 26.98 → 26.98 | 0.9846 | 0.9902 | 변화 없음. 두 브라우저의 기본 세리프 래스터 차이 |
| StarrySky | 30 | 24.89 → 24.93 | 0.9679 | 0.5359 | 변화 없음. 컴포지션이 `Math.random()`을 써서 일치가 불가능 |

40 dB를 넘는 쌍은 FadeInFadeOut 30 하나다. 나머지는 모두 두 브라우저 빌드(Remotion의 Chromium 157 헤드리스 셸, 시스템 Chrome 155)의 글자 래스터 차이가 상한을 만든다. 같은 글자를 같은 자리에 그려도 약 26 dB에서 멈춘다. 레이아웃 차이는 SpringPhysics의 4px 하나만 남았다.

## 한계

각 컴포지션에서 두 프레임(SlideTransition은 세 프레임)만 쟀다. 이 프레임 사이의 애니메이션 타이밍과 이징은 확인하지 않았다. 투명도는 비교하지 않았다. Frameforge 캡처는 흰 페이지 위에 합성되므로 Remotion의 알파 출력과 직접 맞출 수 없다. BarChart의 Frameforge 스틸은 클리핑 검사를 우회해 찍었다. StarrySky는 `Math.random()` 때문에 Remotion 자신과도 재현되지 않으므로, `random()` 동등성은 시드를 쓰는 컴포지션으로 따로 확인해야 한다. 원인 분석에 쓴 Remotion 쪽 근거는 실행 결과와 계산된 스타일뿐이고 Remotion 구현 소스는 열지 않았다.

Remotion 실행은 개인 사용자에 대한 Remotion Free License를 전제로 했다. 직원이 세 명을 넘는 조직이 Remotion을 실행하려면 Company License가 필요하다. Remotion 패키지는 프로젝트 밖 임시 디렉터리에만 설치했고 프로젝트의 `package.json`에는 추가하지 않았다.
