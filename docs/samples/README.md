# 샘플 작품

지금 규칙(`rules.md`)을 따르는 작품 아홉 편과 시작 템플릿입니다. 브랜드는 전부 가상이고 숫자는 예시로 표기했습니다. 음악과 효과음은 작품마다 `audio.json` 사양에서 생성합니다(`docs/audio-score.md`). 새 작품은 `examples/samples/_template/`을 복사해서 시작합니다.

## 작품

| slug | 컴포지션 | 형식 | 무엇을 보여 주나 |
| --- | --- | --- | --- |
| [cafe-morning](../../examples/samples/cafe-morning/) | `CafeMorning` | 1920×1080, 20초 | 동네 카페 스팟. 음악 한 곡과 효과음 셋, 움직임에서 받는 효과음 |
| [kit-launch](../../examples/samples/kit-launch/) | `KitLaunch` | 1920×1080, 20초 | 음성 조명 출시 스팟. 그림은 모두 모티프 키트(`@/assets`) |
| [light-festival](../../examples/samples/light-festival/) | `LightFestival` | 1920×1080, 60초 | 가상 빛 축제 스팟. 직접 그린 에셋(`assets.tsx`) |
| [transitions-reel](../../examples/samples/transitions-reel/) | `TransitionsReel` | 1920×1080, 20초 | 네 도시 릴. 컷마다 다른 `TransitionSeries` 전환 |
| [shape-noise](../../examples/samples/shape-noise/) | `ShapeNoise` | 1920×1080, 20초 | 별에서 자라는 육각형, 노이즈 장, 경로 모핑, `Trail` 모션 블러 |
| [caption-explainer](../../examples/samples/caption-explainer/) | `CaptionExplainer` | 1920×1080, 25초 | 자막만으로 말하는 앱 설명. SRT 파싱, 짧은 묶음 자막, `fitText` |
| [video-collage](../../examples/samples/video-collage/) | `VideoCollage` | 1920×1080, 20초 | 동호회 시즌 리캡. `Video` 두 클립과 `AnimatedImage` GIF |
| [route-story](../../examples/samples/route-story/) | `RouteStory` | 1920×1080, 20초 | 주문 한 건의 길. 경로 위 점과 접선, `interpolateColors` |
| [three-spin](../../examples/samples/three-spin/) | `ThreeSpin` | 1920×1080, 10초 | 아이덴트. `ThreeCanvas`가 렌더러에서 결정적으로 도는지 확인 |

[_template](../../examples/samples/_template/)은 `SIZES` 표, `span`, `pop`, `push`, `Glyphs`, `Screen`, `Callout`과 장면표 양식을 담은 시작점입니다. 샘플 묶음에는 등록하지 않습니다.

## 결과표

2026-10-20에 전체 렌더한 기록입니다(`renders/samples/results.json`, 렌더 결과는 커밋하지 않습니다). 렌더는 모두 bt709 태그, 30 fps, AAC 48 kHz 스테레오입니다. 플래시는 1초 창의 최악 전환 수(허용 6), 프레임 검사의 thin은 헤드라인급 요소가 없는 프레임 비율(기준 0.08 미만), huddled는 가운데 몰린 프레임 비율(기준 0.25 미만)입니다.

| slug | 작성 모델 | 플래시 | 통합 음량 LKFS / TP dBTP | 프레임 검사 | 렌더 |
| --- | --- | --- | --- | --- | --- |
| cafe-morning | claude haiku | 1/6 통과 | -24.83 / -12 | 실패 (thin 0.07, huddled 0.07) | 51s |
| kit-launch | claude haiku | 2/6 통과 | -24.69 / -12.66 | 통과 (thin 0.01, huddled 0.05) | 102s |
| light-festival | claude haiku | 2/6 통과 | -25.01 / -11.28 | 통과 (thin 0.04, huddled 0.12) | 144s |
| transitions-reel | claude haiku | 1/6 통과 | -25.01 / -12.57 | 통과 (thin 0.06, huddled 0.16) | 74s |
| shape-noise | claude haiku | 1/6 통과 | -25.23 / -13.17 | 통과 (thin 0.06, huddled 0.04) | 54s |
| caption-explainer | claude haiku | 1/6 통과 | -24.83 / -12.45 | 통과 (thin 0.01, huddled 0.02) | 60s |
| video-collage | claude haiku | 2/6 통과 | -25.8 / -12.66 | 통과 (thin 0.04, huddled 0.07) | 123s |
| route-story | claude haiku | 1/6 통과 | -24.77 / -13.68 | 통과 (thin 0.03, huddled 0.02) | 53s |
| three-spin | 기록 없음 | 기록 없음 | 기록 없음 | 기록 없음 | 기록 없음 |

기록이 있는 여덟 편은 글자 잘림 가드를 전 프레임 통과했고(실패하면 인코딩이 안 됩니다), 플래시 검사를 통과했고, 통합 음량이 −24 ±2 LKFS 안입니다. cafe-morning은 컵 선 하나로 시작하는 4초 훅이 thin으로 잡혀 프레임 검사에서 실패합니다. 기준은 바닥이지 품질 판정이 아닙니다. three-spin은 전체 렌더 기록이 없습니다.

## 지금 규칙에서 벗어난 곳

- light-festival은 효과음 여덟 개를 `<Sequence><Audio>`로 손으로 놓았습니다. 규칙은 움직임에서 받는 효과음(`MotionProbe`, `MotionSound`)이고, 손으로 놓는 것은 움직임이 없는 사건뿐입니다.
- 변수를 선언하거나 `process.json`을 가진 작품이 없어서 스튜디오의 조정 탭과 과정 탭은 비어 있습니다.

## 스튜디오에서 보기

```sh
npm run dev
```

기본 진입점 `examples/samples/index.tsx`가 위 아홉 편을 등록합니다. 재생 버튼으로 소리와 함께 미리 볼 수 있습니다. 작품 하나만 보려면 `VIDEO_ENTRY=examples/samples/<slug>/entry.tsx npm run dev`를 씁니다.

## 한계

- 에이전트는 소리를 듣지 못합니다. 음악은 작품별 사양에서 합성하며 수치(음량, LRA, 연속성, 편곡 점프)로만 검사합니다(`docs/audio-score.md`).
- 플래시 검사는 Ofcom 지침의 근사이지 Harding 인증이 아닙니다.
- 글꼴은 Google Fonts에서 런타임에 받습니다. 오프라인이면 폴백 글꼴로 렌더되고 가드 결과도 달라질 수 있습니다.
