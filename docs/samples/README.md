# 샘플 작품

지금 규칙(`rules.md`)을 따르는 작품 열일곱 편과 시작 템플릿입니다. 브랜드는 전부 가상이고 숫자는 예시로 표기했습니다. 음악과 효과음은 작품마다 `audio.json` 사양에서 생성합니다(`docs/audio-score.md`). 새 작품은 `examples/samples/_template/`을 복사해서 시작합니다.

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
| [blocks-reel](../../examples/samples/blocks-reel/) | `BlocksReel` | 1920×1080, 30초 | 블록 카탈로그 1: 글자 6, 로어서드 6변형, 카드 6을 한 릴에 |
| [data-reel](../../examples/samples/data-reel/) | `DataReel` | 1920×1080, 30초 | 블록 카탈로그 2: 차트 6, 코드 블록 4모드, 다이어그램 4 |
| [seam-reel](../../examples/samples/seam-reel/) | `SeamReel` | 1920×1080, 30초 | 이음새 다섯 기법과 캐리어, 너지, `seam-check` 통과 |
| [narrated-explainer](../../examples/samples/narrated-explainer/) | `NarratedExplainer` | 1920×1080, 29초 | 나레이션 먼저: `say` 음성 7줄, 측정 시간으로 장면, rail·embed 자막, KaTeX 수식 |
| [turntable-spot](../../examples/samples/turntable-spot/) | `TurntableSpot` | 1920×1080, 24초 | 헤드리스 Blender 턴테이블·돌리 샷(`ImageSequence`), Poly Haven 모델(`Model`) |
| [generative-ident](../../examples/samples/generative-ident/) | `GenerativeIdent` | 1920×1080, 18초 | 오로라·플로우 필드 배경, 라이트 리크 이음새, 그레인·비네트, 손그림 주석, 스튜디오 변수 |
| [map-story](../../examples/samples/map-story/) | `MapStory` | 1920×1080, 20초 | 지도 블록: 세계 윤곽, 한국 확대, 서울→부산→제주 경로, 예시 마커 |
| [showcase-spot](../../examples/samples/showcase-spot/) | `ShowcaseSpot` | 1920×1080, 24초 | 위 레버 전부를 한 편에: 나레이션, 블록, 이음새 6곳, Blender 히어로, 생성 배경·효과 |

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


### 2026-10-24 추가 작품

2026-10-24에 전체 렌더하고 `node bin/frameforge.mjs check <mp4> --film <slug>`로 검사한 기록입니다. 렌더 로그의 `audit`(세이프 영역, 겹침, 대비, 크기) 줄은 모두 비어 있습니다. seam은 `<Seam>`이 보고한 카메라 벡터가 있는 컷만 재고, 없는 작품은 경고만 내고 통과합니다.

| slug | 프레임 | 프레임 검사 | 플래시(최악 1초) | seam-check | narration-check | 렌더 |
| --- | --- | --- | --- | --- | --- | --- |
| blocks-reel | 900 | 통과(thin 0.04, huddled 0.09) | 1 | 통과(측정 0) | 해당 없음 | 51s |
| data-reel | 900 | 통과(thin 0, huddled 0.00) | 0 | 통과(측정 0) | 해당 없음 | 54s |
| seam-reel | 900 | 통과 | 0 | 통과(5곳, 흐름 x−) | 해당 없음 | 51s |
| narrated-explainer | 870 | 통과 | 0 | 통과(측정 0) | 통과(7줄) | 65s |
| turntable-spot | 720 | 통과 | 0 | 통과(측정 0) | 해당 없음 | 101s |
| generative-ident | 540 | 통과 | 0 | 통과(측정 0) | 해당 없음 | 112s |
| map-story | 600 | 통과 | 0 | 통과(측정 0) | 해당 없음 | 40s |
| showcase-spot | 720 | 통과 | 0 | 통과(6곳, 흐름 x−) | 통과(7줄) | 72s |

첫 전체 렌더에서는 일곱 편 중 다섯 편이 떨어졌습니다(정지 구간 124프레임, 글자 잘림, thin 0.093, 세이프 영역, 겹침). 콘택트 시트와 150프레임 부분 렌더만으로는 보이지 않던 것이라, 작품마다 전체 렌더와 `frameforge check`가 필수입니다.

검사 통과 뒤 다른 모델(sonnet)이 일곱 편의 시트를 교차 리뷰해 30여 건을 지적했습니다(기본 프리미티브 3D 히어로, 팔레트 밖 색, 작은 요소와 빈 화면, 자막 판 불일치, 글자 겹침, 이음새의 무대색 테두리). 지적은 전부 반영했고(3D 피사체 팔레트 색과 접지 그림자, `lightLeakEffect`의 `colors`, 오로라 팔레트 고정, 자막 판 통일과 accent 밑줄 강조, `<Seam>`의 배경 bleed, 블록 크기 기본값) 위 표는 반영 뒤 다시 렌더한 결과입니다. 두 번째 교차 리뷰(sonnet)는 blocks-reel과 narrated-explainer를 그대로 합격으로, data-reel과 seam-reel을 중간 수정 뒤 합격으로 판정했고, turntable-spot·showcase-spot·generative-ident의 남은 지적(기본 도형 히어로, 훅 대비, 라이트 리크, 오로라 경계)을 반영해 다시 렌더했습니다. 세 번째 리뷰는 돌리지 않았습니다.

## 지금 규칙에서 벗어난 곳

- light-festival은 효과음 여덟 개를 `<Sequence><Audio>`로 손으로 놓았습니다. 규칙은 움직임에서 받는 효과음(`MotionProbe`, `MotionSound`)이고, 손으로 놓는 것은 움직임이 없는 사건뿐입니다.
- `process.json`을 가진 작품이 없어서 스튜디오의 과정 탭은 비어 있습니다. 변수는 generative-ident만 선언합니다.

## 스튜디오에서 보기

```sh
npm run dev
```

기본 진입점 `examples/samples/index.tsx`가 위 열일곱 편을 등록합니다. 재생 버튼으로 소리와 함께 미리 볼 수 있습니다. 작품 하나만 보려면 `VIDEO_ENTRY=examples/samples/<slug>/entry.tsx npm run dev`를 씁니다.

## 한계

- 에이전트는 소리를 듣지 못합니다. 음악은 작품별 사양에서 합성하며 수치(음량, LRA, 연속성, 편곡 점프)로만 검사합니다(`docs/audio-score.md`).
- 플래시 검사는 Ofcom 지침의 근사이지 Harding 인증이 아닙니다.
- 글꼴은 Google Fonts에서 런타임에 받습니다. 오프라인이면 폴백 글꼴로 렌더되고 가드 결과도 달라질 수 있습니다.
