# API 지원 범위

이 문서는 README에서 옮긴 API 레퍼런스입니다. 내용은 2026-10-20 기준입니다. 설치는 [../install.md](../install.md), 렌더는 [rendering.md](rendering.md), 검사는 [quality-checks.md](quality-checks.md)에 있습니다.

독립 구현한 개인·사내용 React 영상 엔진입니다. 컴포지션은 `import {Composition, Sequence, useCurrentFrame} from 'frameforge'`로 코어(`src/core/`)를 쓰고, 그 이름은 Vite/TypeScript alias입니다. 외부 영상 라이브러리는 제품 의존성에 없습니다. API 형태의 참조 범위와 라이선스 검토는 아래 검증 기록과 `docs/legal/`에 있습니다.

## 지원 범위

- 장면 등록: `registerRoot`, `Composition`, `Folder`
- 타임라인: `useCurrentFrame`, `useVideoConfig`, `Sequence`, `Series`, `Loop`, `Freeze`
- 레이아웃/이미지: `AbsoluteFill`, `Img`, `staticFile`
- 글꼴: `googleFont('Family Name', {weights})`가 Google Fonts의 어떤 패밀리든 필요한 굵기만 불러옵니다. 없는 패밀리는 대체 글꼴로 남고, 렌더는 글꼴 로드가 끝난 뒤에 프레임을 캡처합니다.
- 수학: `interpolate`, `spring`(`durationInFrames`, `durationRestThreshold`, `reverse`, `delay`, `overshootClamping` 포함), `measureSpring`, 주요 `Easing`, `random`(기준 엔진 4.0.537과 같은 값)
- 시퀀스 타이밍: `Sequence`의 `playbackRate`, `trimBefore`, `freeze`. `premountFor`/`postmountFor`는 받아들이지만 아무 일도 하지 않습니다. 이 엔진에는 미리 올려 둘 미디어가 없고 프레임 출력은 같기 때문입니다.
- 렌더 대기: `delayRender`, `continueRender`, `cancelRender`, `useDelayRender`. 렌더 모드에서 프레임 캡처가 열린 핸들이 모두 닫힐 때까지 기다립니다. 기본 제한 30초, `timeoutInMilliseconds`로 조정. `retries`는 받기만 합니다. 제한 시간을 넘기거나 `cancelRender`가 호출되면 그 프레임만 실패하고 다음 프레임은 다시 시도합니다.
- 레이아웃 기본값은 기준 엔진 관측값과 같습니다. 모든 요소 `box-sizing: border-box`, 컴포지션 기본 글꼴은 브라우저 기본(세리프), `Sequence`의 `absolute-fill` 래퍼는 flex row. 실제 기준 엔진 4.0.537 렌더와의 픽셀 비교는 `docs/research/`의 패리티 기록.
- 환경: `getFrameforgeEnvironment`, `useFrameforgeEnvironment`(`isRendering`은 `?render` 쿼리로 결정). `Still`은 fps 1, 1프레임짜리 `Composition`입니다.
- 입력값: `getInputProps`; 장면 탐색 전에 입력값을 주입하고 최종 메타데이터로 렌더링
- 오디오: `<Audio src="/audio/music.wav" volume={0.8} />`는 `public/` 아래 파일을 렌더 MP4에 섞고(AAC 48kHz 스테레오) 스튜디오 재생에서도 들려줍니다. 예제 작품의 오디오는 저장소에 없고 사양에서 생성됩니다(`docs/audio-score.md`). 오디오는 놓인 `Sequence`가 시작하는 프레임부터 나오고, `trimBefore`/`trimAfter`(오디오 파일 기준 프레임)로 앞뒤를 자르며, `volume`은 0~1 상수입니다. `src`는 `/`로 시작해야 합니다. `loop`, `playbackRate`, `muted`, `startFrom`, `endAt`, 함수형 `volume`, 1이 아닌 `playbackRate`의 `Sequence` 안, `Freeze` 안에서는 지원하지 않는다는 오류를 냅니다. `--frames` 콘택트 시트에는 소리가 없습니다.
- `interpolateColors(input, inputRange, outputRange, {easing, posterize})`: hex(3/4/6/8자리), `rgb()`/`rgba()`, `hsl()`/`hsla()`, CSS 색 이름, `transparent`, `oklch()`/`oklab()`/`lab()`/`lch()`/`hwb()`를 받아 항상 양끝을 고정(clamp)하고 `rgba(r, g, b, a)` 문자열을 돌려줍니다. 색 하나짜리 범위도 됩니다.
- `interpolate` 옵션 `posterize`(입력을 그 간격으로 내림)와 구간별 `easing` 배열(길이 `inputRange.length - 1`)
- `assertValidInterpolateEasingOption(easing, inputRangeLength)`: `easing`이 함수도 아니고 구간 수만큼의 함수 배열도 아니면 오류를 냅니다.
- `assertValidInterpolatePosterizeOption(posterize)`: `posterize`가 양의 유한수가 아니면 오류를 냅니다(없으면 통과).
- `getStaticFiles()`: `public/` 아래 파일 목록 `{name, src, sizeInBytes, lastModified}`. 스튜디오와 렌더 모두 시작할 때 Vite의 `/__frameforge/static-files`에서 한 번 읽습니다(최대 10000개).
- `watchStaticFile(name, onChange)`: 스튜디오에서 2초마다 목록을 다시 읽어 파일이 바뀌면 그 파일을, 지워지면 `null`을 넘깁니다. 렌더 중에는 아무것도 하지 않고 `{cancel}`만 돌려줍니다.
- `prefetch(src, {method, contentType, credentials, onProgress})`: 스튜디오에서 바로 내려받아 `waitUntilDone()`이 `blob:`(또는 `method: 'base64'`이면 `data:`) URL을 줍니다. `free()`는 중단하고 URL을 해제합니다. 렌더 중에는 내려받지 않고 `src`를 그대로 줍니다. 이미 쓰는 `<Img src>`를 내려받은 URL로 바꿔 주지는 않습니다.
- `useCurrentScale()`: 스튜디오 무대 확대율(100%에서 1), 렌더에서는 1. 컴포지션 밖에서 부르면 오류이고 `{dontThrowIfOutsideOfFrameforge: true}`(또는 기준 엔진의 옵션 이름)를 주면 1을 돌려줍니다.
- `usePixelDensity()`: 스튜디오에서 `window.devicePixelRatio`, 렌더에서는 1(렌더러가 배율 1로 캡처). 컴포지션 밖 규칙은 `useCurrentScale`과 같습니다.
- `useBufferState().delayPlayback()`: 돌려받은 핸들을 모두 `unblock()`할 때까지 스튜디오 재생을 멈춥니다. 렌더에서는 아무 일도 하지 않습니다. 오디오 요소는 멈추지 않습니다.
- `useIsInsideNonPremountFreeze()`: `<Freeze>`나 `<Sequence freeze>` 안이면 true. 미리 올리기(premount)가 없어 모든 정지가 해당합니다.
- `VERSION`: Frameforge 버전 문자열(`package.json`과 같음)
- `Config`: 비어 있는 고정 객체. 렌더 설정은 `npm run render` 인자로 줍니다.
- `FolderContext`: 감싼 `<Folder>`의 `{folderName, parentName}`, 폴더 밖에서는 둘 다 `null`
- `Html5Audio`, `Html5Video`: `Audio`, `Video`의 별칭
- `IFrame`: `<iframe>`을 그리고 `load`가 올 때까지 `delayRender`로 프레임 캡처를 붙잡습니다. 로드 실패는 `onError`가 없으면 `cancelRender`입니다.
- `MediaPlaybackError`: `new MediaPlaybackError({message, src})`, `Error`의 하위 클래스
- `absoluteFillSchema`: `AbsoluteFill`이 쓰는 기본 스타일 객체(고정). 기준 엔진의 같은 이름은 스튜디오 조작용 스키마라 모양이 다릅니다.
- `Experimental.Null`: 이 프레임은 캡처하지 않고 검은 빈 프레임으로 씁니다. `Experimental.Clipper x y width height`: 그 사각형만 캡처합니다. 한 렌더의 모든 프레임이 같은 크기여야 하며, 크기가 섞이면 렌더가 오류로 멈춥니다. `Experimental.useIsPlayer()`는 항상 false입니다.
- `Series.Sequence`의 `playbackRate`: 자식의 속도를 바꾸고 다음 항목은 `durationInFrames / playbackRate` 프레임 뒤에 시작합니다. 이 값은 정수여야 합니다.
- 메타데이터: `calculateMetadata`가 입력값으로 `width`, `height`, `fps`, `durationInFrames`, `props`를 바꿀 수 있습니다. 반환한 `props`는 기본값과 합치지 않고 그 객체 그대로 장면에 전달됩니다. `defaultCodec` 같은 렌더러 힌트는 프레임에 영향이 없어 무시합니다.

지원하지 않는 옵션은 명시적으로 오류를 냅니다. 전환(`@/packages/transitions`)과 플레이어(`@/packages/player`)는 아래 "전환과 플레이어" 절대로 제공하고, 렌더러 옵션은 `frameRange`, `concurrency`까지 있습니다([rendering.md](rendering.md)의 "결정성 린트와 병렬 렌더" 절). CSS 시간 기반 애니메이션, 비결정적 부작용, Suspense/비동기 delayRender 로딩은 프레임 결정성을 보장하지 않습니다.

`random`, `spring`, `interpolateColors`는 실제 기준 엔진 4.0.537 패키지를 Node에서 실행해 기록한 1554개 입력·출력(`compatibility-benchmark.json`)과 절대 오차 `1e-6` 이내로 일치합니다. `overshootClamping`은 4.0.537이 `from`/`to`가 0/1이 아닐 때 보이는 동작(정규화된 진행값을 `to`로 자름)을 그대로 따릅니다. 벤치마크는 `npm run benchmark`로 다시 돌릴 수 있으며 기준 엔진을 설치하지 않습니다.

글자 잘림 검사는 [quality-checks.md](quality-checks.md)로 옮겼습니다.

### 전환과 플레이어

`src/packages/transitions.tsx`(가져오기 `@/packages/transitions`):

- `<TransitionSeries>` 안에 `TransitionSeries.Sequence`(`durationInFrames`, `offset`, `Sequence`의 나머지 속성), `TransitionSeries.Transition`(`timing`, `presentation`, 생략하면 `slide()`), `TransitionSeries.Overlay`(`durationInFrames`, `offset`, 장면 경계 가운데에 겹쳐 그리고 길이는 바꾸지 않음)를 넣습니다. 전환 동안 두 장면이 함께 그려지므로 전체 길이는 전환 길이만큼 줄어듭니다(40 + 60 + 90 − 30 − 45 = 115). 맨 앞이나 맨 뒤의 전환은 장면의 등장·퇴장만 만듭니다. 전환이 앞뒤 장면보다 길거나, 전환·오버레이가 붙어 있거나, 다른 자식이 오면 오류입니다.
- 타이밍: `linearTiming({durationInFrames, easing})`(0~1로 고정), `springTiming({config, durationInFrames, durationRestThreshold, reverse})`(길이는 `measureSpring`, 진행값은 넘침을 그대로 둠). `{getDurationInFrames, getProgress}` 객체를 직접 만들어도 됩니다.
- 프레젠테이션: `fade({enterStyle, exitStyle, shouldFadeOutExitingScene})`, `slide({direction})`, `wipe({direction})`(8방향), `flip({direction, perspective})`, `clockWipe({width, height})`, `iris({width, height})`, `none()`. 각자의 `enterStyle`/`exitStyle` 또는 `outer…`/`inner…Style`을 받습니다. 직접 만든 프레젠테이션은 `{component, props}`를 돌려주고, 컴포넌트는 `presentationProgress`, `presentationDirection`, `presentationDurationInFrames`, `passedProps`, `bothEnteringAndExiting`, `children`을 받습니다.
- `useTransitionProgress()`: 전환 중인 장면 안에서 `{entering, exiting, isInTransitionSeries}`.
- 기준 패키지 4.0.537을 Node에서 실행해 기록한 장면 마크업 253건(오류 8건 포함)과 타이밍 148건(`compatibility/transitions.json`)과 비교합니다. 마크업은 구조가 같고 숫자(불투명도, 변환, clip-path 좌표)가 `1e-6` 안에서 같아야 합니다. 다른 점: 장면 길이는 정수여야 하고(기준은 소수를 받음), `<Sequence>`의 `class`/`style` 속성 순서가 다릅니다.

`src/packages/player.tsx`(가져오기 `@/packages/player`):

- `<Player component inputProps durationInFrames fps compositionWidth compositionHeight />`: 웹 페이지에서 컴포넌트를 재생합니다. `controls`(재생·음소거 단추, 시간, 탐색 막대), `loop`, `autoPlay`, `initialFrame`, `playbackRate`(−10~10, 0 제외, 음수는 거꾸로 재생하고 소리는 끔), `moveToBeginningWhenEnded`(기본 true), `clickToPlay`, `spaceKeyToPlayOrPause`, `allowFullscreen`, `initiallyMuted`, `style`, `className`, `renderLoading`, `errorFallback`, `lazyComponent`. 컴포지션은 제 크기로 그린 뒤 `style`로 정한 상자에 비율을 지켜 맞춥니다.
- 재생은 `requestAnimationFrame`의 시각을 재생 시작 시각과 비교해 프레임을 정하므로 화면 갱신이 밀려도 영상이 느려지지 않습니다. `<Audio>`는 스튜디오와 같은 방식으로 `<audio>` 요소를 프레임에 맞춥니다.
- ref: `play`, `pause`, `toggle`, `seekTo`, `getCurrentFrame`, `isPlaying`, `pauseAndReturnToPlayStart`, `mute`, `unmute`, `isMuted`, `setVolume`(0~1이 아니면 오류), `getVolume`, `requestFullscreen`, `exitFullscreen`, `isFullscreen`, `getContainerNode`, `getScale`, `addEventListener`/`removeEventListener`. 이벤트는 `play`, `pause`, `ended`, `seeked`, `frameupdate`, `timeupdate`(250ms에 한 번), `ratechange`, `volumechange`, `mutechange`, `scalechange`, `fullscreenchange`, `error`이며 콜백은 `{detail}`을 받습니다.
- `<Thumbnail frameToDisplay … />`: 한 프레임만 그립니다. ref는 `getContainerNode`, `getScale`, `error` 이벤트.
- 아직 없는 것: `inFrame`/`outFrame`, 포스터(`renderPoster` 계열), 단추 바꾸기(`renderPlayPauseButton` 등), 재생 속도 메뉴, 음량 막대, 버퍼링 상태(`waiting`/`resume`), 플레이어 안에서 `useIsPlayer()`가 true가 되는 것.

### 미디어와 캔버스

`src/core/media.tsx`, `src/core/effects.tsx`(가져오기 `frameforge`):

- `<Video src trimBefore trimAfter volume muted style className onError delayRenderTimeoutInMilliseconds delayRenderRetries />`와 같은 구현인 `OffthreadVideo`(`playbackRate`도 받음): 로컬 프레임 f에 파일의 `(trimBefore + f × playbackRate) / fps`초 화면을 보여 줍니다. 스튜디오에서는 음소거한 `<video>`에 `playbackRate`를 걸고 그 시각보다 100µs 뒤로 탐색하고(Chrome이 시각을 마이크로초로 잘라 앞 프레임을 보이는 것을 피함) `seeked`까지 `delayRender`로 기다립니다. 렌더에서는 Vite 미들웨어 `/__frameforge/video-frame?src&frame&fps`가 ffmpeg로 뽑은 파일 프레임 `floor(trimBefore + f × playbackRate)`의 PNG(`.cache/video-frames/<sha>/`, 한 번에 2초씩)를 `<Img>`로 그립니다. 각 프레임에는 그 시각을 덮는 원본 화면이 나오고(24/30/60fps 원본을 30fps에서 원본 프레임과 바이트 단위로 비교), 파일이 끝나면 마지막 화면이 남습니다. 소리는 같은 레지스트리의 `<Audio>` 클립으로 섞이고, 1이 아닌 `playbackRate`는 렌더러가 ffmpeg `atempo` 단계를 이어 적용합니다. 렌더에서는 `ffprobe`로 소리 트랙이 있는 파일만 클립을 겁니다. `src`는 `public/` 경로(`/`로 시작)나 https URL입니다. https 파일은 개발 서버가 한 번 내려받아 `.cache/remote/<sha256>`에 두고 거기서 프레임과 메타데이터를 읽습니다. http 등 다른 스킴, 0.25~4 밖의 `playbackRate`, 1이 아닌 `playbackRate`의 `Sequence` 안, `loop`, `startFrom`/`endAt`, 함수형 `volume`은 오류입니다. `Freeze` 안의 영상은 화면만 멈추고 소리를 내지 않습니다. 렌더 브리지 `window.__FRAMEFORGE__.video()`는 렌더된 영상 목록(`src`, `startFrame`, `trimBefore`, `trimAfter`, `playbackRate`, `volume`, `muted`)을 줍니다.
- `<AnimatedImage src width height fit playbackRate loopBehavior requestInit effects onError />`: Chrome `ImageDecoder`로 GIF/APNG/WebP/AVIF를 src마다 한 번 풀고(`src`는 `public/` 경로나 https URL, https는 위와 같이 내려받아 씀), 현재 시각을 덮는 프레임을 캔버스(기본 크기는 컴포지션)에 그립니다. `loopBehavior`는 `loop`, `pause-after-finish`, `clear-after-finish`. `ImageDecoder`가 없는 브라우저에서는 오류입니다.
- `<Solid width height color pixelDensity effects />`, `<CanvasImage src width height fit crossOrigin maxRetries effects onError />`: 캔버스에 단색이나 정지 이미지를 그리고 `effects`를 차례로 적용합니다. 자르기 `cropLeft/Right/Top/Bottom`(0~1)은 `clip-path`가 됩니다.
- `createEffect({type, label, documentationLink, backend, calculateKey, setup, apply, cleanup, validateParams})`: 효과 팩토리를 만듭니다. `{disabled: true}`인 효과는 건너뜁니다. 실행되는 것은 `backend: '2d'`뿐이며 WebGL2/WebGPU 효과는 오류입니다. 내장 효과 두 개: `blurEffect({radius})`(캔버스 `filter`), `colorMatrixEffect({matrix})`(feColorMatrix와 같은 4×5 행렬, 픽셀 반복).
- `<HtmlInCanvas width height onPaint pixelDensity effects>`: 자식을 캔버스 안에 배치하고 `drawElementImage`로 그린 뒤 `onPaint`나 `effects`를 적용합니다. 렌더러는 Chrome을 `--enable-blink-features=CanvasDrawElement`로 띄우므로 렌더에서 동작합니다(Chrome 155에서 스타일을 준 div가 그려진 것을 확인). 일반 Chrome 탭의 스튜디오에는 이 기능이 꺼져 있어 `HTML_IN_CANVAS_UNSUPPORTED_MESSAGE`로 오류를 내고, 미리보기하려면 chrome://flags/#canvas-draw-element를 켭니다. `isHtmlInCanvasSupported()`, `getHtmlInCanvasUnsupportedMessage()`, `HtmlInCanvas.isSupported()`.
- `<Artifact filename content />`: 렌더 중 그 프레임에 파일 하나를 등록합니다(`Uint8Array`는 base64로 브리지를 건넘). 렌더러가 `scripts/artifacts.mjs`의 `writeArtifacts`로 출력 파일 옆에 씁니다. 같은 이름이 두 번 나오거나 이미 있으면 덮어쓰지 않고 오류입니다. 스튜디오에서는 아무것도 하지 않습니다. `Artifact.Thumbnail`은 지원하지 않는다는 오류를 냅니다.
- `<Track name>`: DOM을 더하지 않고 시간 속성(`from`, `durationInFrames`, `freeze`, `width`, `height`, `hidden`)만 자식에 적용합니다. `Interactive.Div`/`Span`/`Svg` 등 35개 요소와 `Interactive.create({Component})`: 시간·자르기 속성을 받아 일반 요소로 그립니다. 스튜디오의 직접 조작과 `Interactive.*Schema` 조각은 아직 없습니다.

### 레이아웃·미디어·자막 유틸

`src/packages/*`(가져오기 `frameforge`). 순수 함수는 기준 패키지 4.0.537을 Node에서 실행해 기록한 `compatibility/{captions,media-utils,layout-utils,zod-types}.json`과 일치합니다(`tests/packages-utils.test.tsx`).

- 자막: `parseSrt({input, strict})`, `parseVtt({input})`, `serializeSrt({lines})`, `createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds, breakOnSilenceAfterMilliseconds})`, `Caption` 타입. 느슨한 SRT 파싱의 공백 처리와 엄격 모드의 오류 문구(`SRT cue 2, line 6: ...`)까지 SRT 100개(두 모드), 페이지 나누기 120건, 직렬화 40건이 기준과 같습니다.
- 레이아웃: `measureText`, `fitText`, `fitTextOnNLines`, `fillTextBox`. 브라우저에서는 숨긴 `<span>`(`white-space: pre`)으로 재므로 `letterSpacing`, `textTransform`, `fontVariantNumeric`, `additionalStyles`가 화면과 똑같이 반영됩니다. Node에서는 각 함수의 마지막 인자로 측정 함수 `(word) => {width, height}`를 넘깁니다. `fitText`는 100px에서 한 번 재고 비례로 키웁니다. `validateFontIsLoaded: true`는 글꼴을 빼고 다시 재서 같으면 "글꼴이 아직 안 불러와졌다"는 오류를 냅니다.
- 오디오·영상: `getAudioData(src, {sampleRate, requestInit})`(AudioContext 디코딩, 기본 48000Hz), `useAudioData`(`delayRender`로 프레임을 붙잡음), `useWindowedAudioData`, `getAudioDurationInSeconds`/`getAudioDuration`, `getImageDimensions`, `getVideoMetadata`(Vite `/__frameforge/media-metadata?src=`가 `ffprobe`로 읽음, `public/` 경로나 https URL만(https는 `.cache/remote/`에 한 번 내려받음), `public/` 밖은 거부), `visualizeAudio`(주파수 막대, `numberOfSamples`는 2의 거듭제곱), `visualizeAudioWaveform`, `getWaveformPortion`, `createSmoothSvgPath`, `audioBufferToDataUrl`(32비트 float WAV). 막대 값은 기준과 1e-9 안에서 같습니다. `useWindowedAudioData`는 범위 요청 대신 파일 전체를 한 번 디코딩해 창만 잘라 주고, 고른 채널 하나만 담습니다. `audioBufferToDataUrl`은 채널이 셋 이상이면 기준과 달리 모든 채널을 씁니다(기준은 첫 채널만 써서 깨진 WAV를 만듦).
- 글꼴: `loadFont({family, url, format, weight, style, display, unicodeRange, ...})`가 파일을 받아 `FontFace`로 등록하고 그동안 렌더를 붙잡습니다. 확장자로 형식을 모르면 `format`을 넘기라는 오류입니다.
- 스키마: zod는 의존성에 없으므로 `zColor(z)`, `zTextarea(z)`, `zMatrix(z)`처럼 프로젝트의 `z`를 인자로 받습니다(기준은 인자 없음). 설명 문자열은 `__frameforge-color` 등입니다. `parseColor(color)`는 `interpolateColors`가 받는 모든 색을 `{a, r, g, b}` 바이트로 돌려줍니다.
- 미리 불러오기: `preloadImage`/`preloadFont`는 `<link rel="preload">`, `preloadAudio`/`preloadVideo`는 Firefox에서 링크, 그 밖에서는 숨긴 `<audio|video preload="auto">`를 붙이고 되돌리는 함수를 줍니다. `resolveRedirect(src)`는 최종 URL을 줍니다. Node에서는 아무것도 하지 않습니다.
- 3D: `<ThreeCanvas width height ...Canvas props>`는 `@react-three/fiber`의 `<Canvas frameloop="demand">`를 그리고 프레임마다 `advance()`를 한 번 부른 뒤 렌더를 풀어 줍니다. 안에서는 `useFrame` 대신 `useCurrentFrame()`을 씁니다. `three`와 `@react-three/fiber`는 선택 패키지라 없으면 `npm install three @react-three/fiber`를 안내하는 오류가 납니다(Vite에서는 없는 패키지를 오류 모듈로 바꿔 스튜디오가 깨지지 않음). 이 저장소는 두 패키지를 devDependencies로 설치해 둡니다. 안쪽 `<Sequence>`는 캔버스의 현재 프레임에서 새 시간축을 시작합니다. 회전하는 상자 60프레임을 두 번 렌더하면 60프레임이 모두 같고(`scripts/snapshot-diff.mjs`), 샘플 `examples/samples/three-spin/`이 있습니다.

### 경로·도형·노이즈·모션 유틸

`src/packages/{paths,shapes,noise,motion-blur,animation-utils}`(가져오기 `frameforge`). 기준 패키지 4.0.537을 Node에서 실행해 기록한 `compatibility/{paths,shapes,noise,motion-blur,animation-utils}.json` 1만 3천여 건과 일치합니다(`tests/packages-math.test.tsx`).

- 경로: `parsePath`, `serializeInstructions`, `normalizePath`, `reduceInstructions`(호·S·T·Q·H·V를 M/L/C/Z로), `getLength`, `getPointAtLength`, `getTangentAtLength`, `getInstructionIndexAtLength`, `getBoundingBox`, `getSubpaths`, `evolvePath`, `cutPath`, `interpolatePath`, `interpolatePaths`, `translatePath`, `scalePath`, `centerPath`, `resetPath`, `reversePath`, `warpPath`, `extendViewBox`, `debugPath`. 1582건 중 경계 상자 계열 37건만 상대 1e-9 안(삼차곡선 극값 계산 순서 차이)이고 나머지는 비트 단위로 같습니다. 길이는 기준처럼 삼차곡선 20점 가우스-르장드르, 호는 300개 현으로 근사하고, 길이로 위치를 찾을 때 0.1% 오차에서 멈추므로 곡선 위 점이 참 호길이 위치와 최대 0.1 단위 다를 수 있습니다. `evolvePath(0)`이 길이의 1.5배를 주는 등 기준의 관측 동작을 따릅니다. 문서에서 v4에 없어졌다는 `getParts`는 없습니다.
- 도형: `makeRect`, `makeCircle`, `makeEllipse`, `makeTriangle`, `makeStar`, `makePie`, `makePolygon`, `makeHeart`, `makeArrow`, `makeCallout`, `makeSpark`와 같은 이름의 컴포넌트(`<Rect>` 등, 남는 속성은 `<path>`로). `path` 문자열 2446건이 같습니다(다각형·별·삼각형 일부는 1e-9 안). 모서리 둥글기 0인 다각형과 별에서 기준의 `width`/`height`는 실제 윤곽보다 크게 나오는데, 여기서는 실제 경계를 돌려줍니다. 컴포넌트의 타임라인 속성(`from`, `durationInFrames` 등)과 `effects`는 받기만 합니다.
- 노이즈: `noise2D(seed, x, y)`, `noise3D`, `noise4D`. Gustavson 심플렉스 노이즈에 `random(seed)`로 섞은 순열표를 씁니다. 712건이 1e-9 안(실측 최대 1.4e-15)입니다. 좌표가 ±2^31을 넘으면 기준처럼 0입니다.
- 모션 블러: `<Trail layers lagInFrames trailOpacity>`는 `lagInFrames`씩 앞선 프레임 사본 `layers`개를 점점 투명하게 깔고, `<CameraMotionBlur shutterAngle samples>`는 셔터 구간의 사본을 `plus-lighter`로 평균합니다. `MotionBlur`는 `blurOpacity` 이름을 받는 옛 별칭입니다. 1174건의 마크업이 같습니다. `Sequence` 안에서는 사본 프레임을 컴포지션 끝이 아닌 그 `Sequence` 끝에서 자릅니다. `HtmlInCanvasMotionBlur`는 제공하지 않습니다.
- 변형·스타일 보간: `makeTransform([...])`과 `translate`, `translateX/Y/Z`, `translate3d`, `scale`, `scaleX/Y/Z`, `scale3d`, `rotate`, `rotateX/Y/Z`, `rotate3d`, `skew`, `skewX/Y`, `perspective`, `matrix`, `matrix3d`(숫자+단위, 단위 문자열 모두), `interpolateStyles(input, inputRange, styles, {easing, extrapolateLeft, extrapolateRight, posterize})`(숫자, 단위, 색, 여러 값과 함수가 섞인 문자열). 7194건이 같습니다. `skew(x, unit, y, unit)`은 문서대로 받습니다(기준은 오류). `output`/`outputType` 옵션, 중첩 함수, 쉼표로 이은 여러 그림자는 지원하지 않습니다.

## 블록 카탈로그 `@/blocks`

`src/blocks/`의 프레임 함수 컴포넌트입니다. 공통 prop은 `frame`, `at`, `out`/`duration`, `fps`, `palette {ink, paper, accent, soft}`, `fonts {display, ui}`, `size`, `x`/`y`(또는 `align`), `id`이고, 등장 전에는 숨겨지며 퇴장은 등장 축을 거꾸로 탑니다. 모든 블록이 `<MotionProbe>`를 보고합니다. 목록은 `CATALOG`(`BlockEntry[]`)로 런타임에도 읽습니다.

- 글자: `GlyphRise`, `WordCascade`, `ZoomSwap`, `Typewriter`, `HighlightSweep`, `Counter`
- 로어서드: `LowerThird`(`clean-bar`, `bold-block`, `kicker-name`, `soft-pill`, `mask-reveal`, `side-rule`)
- 카드: `StatCard`, `NotificationCard`, `MessageThread`, `Ticker`, `Checklist`, `LogoOutro`
- 차트: `BarChart`, `LineChart`, `BarChartRace`, `Donut`, `Heatmap`, `Sparkline`
- 코드: `CodeBlock`(`typing`, `highlight`, `diff`, `scroll`), `tokenize`
- 다이어그램: `Flowchart`, `ProcessSteps`, `Timeline`, `Compare`

- 지도: `MapOutline`, `RouteMap`, `Markers`, `project`, `fitBounds`, `geoPath`. 데이터는 `npm run geo -- geo.json`.

자세한 prop은 [blocks-text.md](blocks-text.md), [blocks-data.md](blocks-data.md), [blocks-maps.md](blocks-maps.md), 샘플은 `blocks-reel`, `data-reel`, `map-story`.

## 이음새, 박자, 나레이션, 3D, 생성 배경

- 이음새(`frameforge`): `cutTheCurve`, `zoomThrough`, `inverseZoom`, `rackFocus`, `waterfallCut`, `waterfallEntry`, `nudge`, `<Seam at duration technique axis direction from to>`. 검사는 `npm run seam-check -- <out>.motion.json --prompt prompt.md`. [seams.md](seams.md).
- 박자: `beatGrid({bpm, fps})`, `beatsFromSpec(audioSpec, fps)`, `loadBeats(beatsJson, fps)`가 `beatAt`, `barAt`, `phase`, `pulse`, `onBeat`, `bars`를 돌려줍니다. 외부 음원은 `npm run beats -- <audio>`. [tooling.md](tooling.md).
- 나레이션: `narrationFrames`, `useNarration(timing)`, `<Voiceover src>`, `<Subtitles timing style="rail"|"embed">`, `<SubtitleLine>`, `captionsFromTiming`, `<Formula tex draw highlight>`. 생성은 `npm run voice -- narration.json`, 검사는 `npm run narration-check -- <film>`. [voice.md](voice.md).
- 3D: `<ImageSequence src frames fps loop pad startFrame fit>`, `sequenceIndex(frame, fps, seqFps, frames, loop?, startFrame?)`, `sequenceFile(src, index, pad?)`, `<Model src scale position rotation color>`(색을 주면 질감 맵 대신 팔레트 색), `loadModel(src)`, `<Turntable speed phase>`, `<StudioLights intensity color>`(키 라이트가 그림자를 드리움). 렌더는 `npm run blender -- 3d.json`, 모델은 `npm run models -- models.json`. [three-d.md](three-d.md).
- 생성 배경과 주석: `<Generative system seed width height palette params>`, `GENERATIVE_SYSTEMS`(flowField, particles, starfield, meshGradient, halftone, ripples, voronoi, noiseLines, aurora), `Highlight`, `Encircle`, `Underline`, `StrikeThrough`, `Box`, `Bracket`. [generative.md](generative.md).
- 보조 움직임: `drift(frame, {x, y, scale, period})`는 카메라나 층에 줄 CSS transform 문자열(`translate(..px, ..px) scale(..)`)을 돌려줍니다. x는 사인, y와 scale은 4분의 1, 2분의 1 주기 늦게 움직여 어느 축이든 늘 움직입니다. 기본 `period` 240프레임, 진폭 기본 0. `breathe(frame, period = 60, amount = 0.03)`은 1 ± amount를 오가는 배율(크기, 불투명도, 글로우 반경). 둘 다 프레임의 순수 함수이고 `period`가 0 이하면 오류입니다. frame-check는 0.5초 전 프레임과 비교하므로 헤드라인이 있는 화면에서 1 px/s의 드리프트도 움직임으로 잡습니다. `src/packages/ambient.ts`, `tests/ambient.test.tsx`.
- 흐름: `<Stream from={[x, y]} to={[x, y]} progress width color wobble frame>`는 원천에서 목표로 가는 채운 띠(붓는 줄기, 데이터 흐름)를 부모 px 좌표의 SVG로 그립니다. 곡선은 원천에서 수평으로 나와 목표로 떨어지는 2차 곡선이고, 폭은 원천에서 `width`, 목표에서 40%로 가늘어집니다. `progress`가 숫자면 머리 위치(0..1), `[tail, head]`면 꼬리가 원천을 떠나 떨어지고 끝이 뾰족해집니다. `wobble`은 원천에서 0, 목표 쪽으로 커지는 옆 흔들림(px), `frame`은 흔들림을 줄기 아래로 흘립니다. 아무것도 그릴 게 없으면 `null`. 경로만 필요하면 `streamPath(options)`. `src/packages/stream.tsx`.
- 외부 애니메이션: `<Seekable animate>`, `useSeekable(ref, factory, deps)`, `seekableFrame`. [seekable.md](seekable.md).
- 효과(`effects` prop): `blurEffect`, `colorMatrixEffect`, `colorCorrectionEffect`, `lutEffect`+`parseCubeLut`, `lightLeakEffect`, `vignetteEffect`, `grainEffect`. [effects.md](effects.md).

## 움직임에서 나오는 소리

`useMotionSound(key, value, {family, axis})`(루프 안에서는 `<MotionProbe>`)로 움직이는 값을 보고하고 `<MotionSound src role families quiet />`로 역할별 파일을 선언하면, 엔진이 모든 프레임을 본 뒤 시작(`move`)·착지(`land`, 오버슈트면 처음 닿는 순간)·등장(`appear`) 사건을 찾아 세기와 팬을 붙여 믹스에 넣습니다. 반 초에 하나, 4초에 셋, 음악 타격 근처는 비웁니다. 렌더 로그의 `motionSounds`에 결과가 찍히고 스튜디오도 같은 소리를 재생합니다. `docs/audio-score.md` 움직임에서 나오는 소리.

## 효과음 소스

사양의 `sfx[]`는 `intent` 한 문장으로 소리를 정하고, 생성기가 Openverse CC0 녹음 → 합성 프리셋 순으로 소스를 해결해 `public/audio/generated/<slug>/sfx.json`에 고정합니다. 렌더러는 효과음 아래서 음악을 사이드체인으로 낮춥니다. 자세한 내용은 `docs/audio-score.md`, 조사 근거는 `docs/research/sfx-reference-study.md`.

## 에셋 해결과 Lottie

- `npm run art -- examples/samples/<slug>/assets.json`(`scripts/assets/art.py`): 작품의 `assets.json`(`{slug, palette: {ink, accent, soft, paper}, assets: [{name, intent, source, recolor, file}]}`)을 소스 순서 `host`(호스트 에이전트가 둔 SVG/PNG/WebP) → `image-command`(`FRAMEFORGE_IMAGE_COMMAND`, vtracer로 SVG 추적) → `library`(Openverse CC0 SVG) → `kit`(아래 모티프 키트, 파일 없음)로 해결합니다. SVG는 스크립트·외부 참조·이벤트 속성을 지우고 viewBox를 붙이며 `recolor`이면 팔레트로 색을 바꿉니다. 결과는 `public/assets/generated/<slug>/`에 쓰이고 매니페스트 `assets.json`이 선택을 해시로 고정합니다. 표기가 필요한 출처가 있으면 `CREDITS.md`가 생깁니다. 스튜디오는 없는 SVG를 요청받으면 그때 해결하고, `npm run render`는 진입 폴더에 `assets.json`이 있으면 Vite를 띄우기 전에 해결합니다. 자세한 내용은 `docs/guides/assets.md`.
- `<Art src size draw ink accent soft paper style />`(가져오기 `frameforge`): 해결된 SVG를 src마다 한 번 받아 인라인으로 그립니다. `draw`(0–1)로 선을 그려 넣고 색 속성을 주면 팔레트를 바꿉니다.
- `<Lottie src frame loop playbackRate style />`(가져오기 `frameforge`, lottie-web SVG 렌더러): 파일의 fps를 컴포지션 fps에 맞춘 프레임을 `goToAndStop`으로 보여 주므로 결정적입니다. 애니메이션 파일의 라이선스는 따로 확인합니다.

## 모티프 키트

전체 46종: Badge, Bag, BarChart, Bell, Book, Bottle, Bridge, Calendar, Camera, Card, Clock, Cloud, Coin, CoinStack, Cup, Door, Envelope, Flag, Gift, Glass, Headphones, Heart, Key, Laptop, Leaf, Lightbulb, LineChart, Lock, Mic, Moon, Mountain, Mug, Phone, Pin, PlayButton, Rocket, Scooter, SpeechBubble, Star, Sun, Tag, Ticket, Tower, Trophy, Wave, Window.

`src/assets/`는 직접 그린 파라미터 벡터 에셋입니다. 모든 에셋이 400 viewBox, 8px 그리드, 정면 시점, 같은 선 굵기(`stroke`, 기본 `size × 0.045`)와 모서리(`radius`, 기본 `size × 0.04`)를 씁니다. 색은 `ink`(선)와 `accent`·`soft`·`paper`(면)만 받습니다. `draw`(0–1)는 선을 그려 넣고, `parts`(0–N)는 `meta.parts` 순서대로 조립 단계를 드러냅니다.

```tsx
import {Cup} from '@/assets';
<Cup size={320} accent="#ff6b4a" draw={progress} parts={3} />
```

`src/assets/catalog.ts`의 `CATALOG`는 에셋마다 `{name, parts, tags}`를 담고, `tags`는 의도 매칭용 한국어·영어 낱말입니다. 정지 상태 컨택트 시트는 `npm run render -- .scratch/asset-kit/entry.tsx AssetSheet .scratch/asset-kit/sheet-0.png '{"page":0}' --frames 0`으로 그립니다(한 쪽에 24개).

에셋(1차 22개): Cup, Mug, Card, Phone, Laptop, Window, Pin, Clock, Calendar, Bell, Heart, Star, Coin, CoinStack, BarChart, LineChart, Door, SpeechBubble, Envelope, PlayButton, Badge, Trophy.
