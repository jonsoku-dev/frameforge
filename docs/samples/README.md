# 샘플 영상 (2026-10-20)

같은 엔진, 같은 규칙(`rules.md`), 다른 모델, 다른 프롬프트. 브랜드는 전부 가상이고 숫자는 예시로 표기했다. 계획은 `plan.md`, 오디오는 작품마다 `audio.json` 스펙으로 생성한다(`docs/audio-score.md`).

## 제작 과정

1. 에이전트 10개가 병렬로 작성(opus 4, sonnet 3, haiku 2, fable 1). 각자 자기 포트의 개발 서버에서 키프레임을 찍어 자체 검사.
2. 렌더러로 컨택트 시트를 만들며 글자 잘림 가드 통과 확인.
3. 교차 리뷰. 작성하지 않은 모델이 심사(sonnet이 opus·haiku·fable 작품 7편, opus가 sonnet 작품 3편). 여섯 기준: 훅, TV 가독성, 연속성, 완급과 빈 화면, 가상 브랜드 준수, 세이프 영역.
4. 수정 라운드. 원 작성 모델의 새 에이전트가 리뷰 목록을 전부 적용(podcast-promo는 rework 판정이라 opus가 다시 짬).
5. 순차 렌더. 가드·방송 플래시 검사·라우드니스 측정.

에이전트 수: 작성 10, 리뷰 2, 수정 10, 오디오 라이브러리 1. 전체 렌더 시간 약 8분.

## 결과표

렌더는 모두 bt709 태그, 30 fps, aac 48 kHz 스테레오. 프레임 검사(`npm run frame-check`)의 thin은 내용이 거의 없는 프레임 비율(기준 0.08 미만), huddled는 내용이 한구석에 몰린 프레임 비율(기준 0.25 미만)이다.

| slug | 모델 | 형식 | 소리 | 플래시(최악 1초 전환) | 통합 음량 LKFS / TP dBTP | 프레임 검사 | 렌더 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| saas-launch | opus | 1920×1080, 30s | aac | 1/6 통과 | -25 / -11.88 | 통과 (thin 0.04, huddled 0.07) | 77s |
| kinetic-typo | fable | 1080×1920, 15s | aac | 1/6 통과 | -24.9 / -10.11 | 통과 (thin 0.00, huddled 0.01) | 38s |
| data-story | opus | 1920×1080, 20s | aac | 0/6 통과 | -24.85 / -11.12 | 통과 (thin 0.00, huddled 0.00) | 58s |
| event-teaser | sonnet | 1920×1080, 15s | aac | 0/6 통과 | -24.9 / -10.47 | 실패 (thin 0.14, huddled 0.03) | 40s |
| app-onboarding | sonnet | 1080×1920, 20s | aac | 1/6 통과 | -24.79 / -13.06 | 통과 (thin 0.01, huddled 0.00) | 58s |
| logo-reveal | haiku | 1920×1080, 10s | aac | 2/6 통과 | -24.87 / -10.72 | 실패 (thin 0.23, huddled 0.40) | 26s |
| podcast-promo | haiku+opus | 1920×1080, 15s | aac | 0/6 통과 | -24.73 / -11.13 | 통과 (thin 0.00, huddled 0.00) | 41s |
| education-explainer | opus | 1920×1080, 25s | aac | 1/6 통과 | -24.77 / -12.24 | 통과 (thin 0.04, huddled 0.07) | 67s |
| countdown-hype | sonnet | 1920×1080, 10s | aac | 1/6 통과 | -24.81 / -10.78 | 통과 (thin 0.00, huddled 0.00) | 27s |
| product-feature | opus | 1920×1080, 20s | aac | 1/6 통과 | -24.93 / -11.64 | 통과 (thin 0.04, huddled 0.08) | 51s |
| recipe-steps | codex gpt-6-luna | 1080×1920, 20s | aac | 0/6 통과 | -24.83 / -11.32 | 통과 (thin 0.00, huddled 0.00) | 54s |
| fitness-timer | codex gpt-6-luna (high) | 1080×1920, 10s | aac | 1/6 통과 | -24.84 / -11.8 | 통과 (thin 0.03, huddled 0.00) | 27s |
| travel-poster | codex gpt-5.6-terra | 1920×1080, 15s | aac | 1/6 통과 | -24.78 / -10.37 | 실패 (thin 0.24, huddled 0.01) | 36s |
| weather-brief | codex gpt-5.6-luna | 1920×1080, 15s | aac | 0/6 통과 | -24.77 / -11.63 | 실패 (thin 0.11, huddled 0.03) | 35s |
| cafe-morning | claude haiku (오디오 v3 테스트) | 1920×1080, 20s | aac | 1/6 통과 | -24.83 / -12 | 실패 (thin 0.07, huddled 0.07) | 51s |
| light-festival | claude haiku (60초, 에셋 직접 그림) | 1920×1080, 60s | aac | 2/6 통과 | -25.01 / -11.28 | 통과 (thin 0.04, huddled 0.12) | 144s |
| transitions-reel | claude haiku (전환 패키지) | 1920×1080, 20s | aac | 1/6 통과 | -25.01 / -12.57 | 통과 (thin 0.06, huddled 0.16) | 74s |
| shape-noise | claude haiku (도형·노이즈·모션 블러) | 1920×1080, 20s | aac | 1/6 통과 | -25.23 / -13.17 | 통과 (thin 0.06, huddled 0.04) | 54s |
| caption-explainer | claude haiku (자막) | 1920×1080, 25s | aac | 1/6 통과 | -24.83 / -12.45 | 통과 (thin 0.01, huddled 0.02) | 60s |
| video-collage | claude haiku (비디오·GIF) | 1920×1080, 20s | aac | 2/6 통과 | -25.8 / -12.66 | 통과 (thin 0.04, huddled 0.07) | 123s |
| route-story | claude haiku (경로·색 보간) | 1920×1080, 20s | aac | 1/6 통과 | -24.77 / -13.68 | 통과 (thin 0.03, huddled 0.02) | 53s |
| three-spin | ? | 렌더 없음 | | | | | | |
| kit-launch | claude haiku (키트만 사용) | 1920×1080, 20s | aac | 2/6 통과 | -24.69 / -12.66 | 통과 (thin 0.01, huddled 0.05) | 102s |
| plugin-smoke-claude | claude haiku via plugin skill (종단 테스트) | 1920×1080, 10s | aac | 1/6 통과 | -24.45 / -13.3 | 통과 (thin 0.06, huddled 0.21) | 33s |
| plugin-smoke-codex | codex gpt-5.6-terra via plugin skill (종단 테스트) | 1920×1080, 10s | aac | 1/6 통과 | -24.69 / -12.77 | 실패 (thin 0.12, huddled 0.14) | 27s |

모든 영상이 글자 잘림 가드를 전 프레임 통과했고(실패하면 인코딩이 안 된다), 플래시 검사를 통과했고, 통합 음량이 −24 ±2 LKFS 안이다. 프레임 검사에서 실패한 넷(event-teaser, logo-reveal, travel-poster, weather-brief)은 의도된 빈 훅이나 로고 단독 장면이 thin으로 잡힌 것이고, cafe-morning은 컵 선 하나로 시작하는 4초 훅이 잡혔다. 기준은 바닥이지 품질 판정이 아니다.

cafe-morning, light-festival(60초), 새 기능 테스트 다섯 편(transitions-reel, shape-noise, caption-explainer, video-collage, route-story; 모두 haiku), three-spin(ThreeCanvas), kit-launch(haiku, 모티프 키트만 사용), 플러그인 종단 테스트 두 편(plugin-smoke-claude: haiku, plugin-smoke-codex: gpt-5.6-terra; 각 호스트의 새 세션이 frameforge-create 스킬로 제작), Codex 네 편(recipe-steps, fitness-timer, travel-poster, weather-brief)은 처음 열 편 뒤에 추가됐다. Codex 네 편은 교차 리뷰 없이 단독 모델 결과 그대로다. 같은 브리프를 아홉 모델에 준 비교 실험 9편은 `compare.md`에 따로 있다. 실제 화면을 쓴 작품은 캡처를 다시 배포할 수 없어 저장소에 넣지 않았다.

## 교차 리뷰가 반복해서 찾은 것

- 보조 텍스트가 웹 페이지 크기로 들어감(프레임 높이의 1.5–2%). TV 기준 2.5% 이상으로 올렸다.
- 모든 샘플의 초안에 30–66프레임의 거의 빈 구간이 있었다. 등장 시점을 당기거나 전환을 겹쳐 줄였다. 남은 예외는 기록에 적었다. event-teaser는 처음 2초가 선 하나, logo-reveal은 플래시 뒤 8프레임 숨, product-feature 282와 education-explainer 474는 한 프레임짜리 성긴 화면.
- 한글이 없는 글꼴(Manrope, Roboto Mono, DM Serif Display, DM Sans)이 한글 라벨에 쓰여 시스템 글꼴로 폴백했다. Noto Sans KR·Gowun Batang으로 바꿨다.
- 훅이 늦은 샘플 셋(saas-launch, event-teaser, app-onboarding)의 헤드라인 등장을 앞당겼다. event-teaser의 이름은 여전히 72프레임(2.4초)에 시작한다.

## 샘플별 기록

### saas-launch

모델 opus. 가상 작업관리 SaaS "Solotack" 런치. 문제 공감 → 핀 하나 → 기능 카드 셋이 서로에게서 자라남 → 약속 → 이름.

리뷰가 찾은 것: 할 일 행 글자 17.6px(1.6%)로 TV에서 읽히지 않음, 첫 2초에 행 1–2개뿐, 668 빈 주황 화면, 포커스 카드 푸시가 프레임 밖.

고친 것: 행 텍스트 34px·9행 스크롤, 8행이 41프레임 안에 도착, 헤드라인 662 시작, 카드 자체만 1.06 푸시.

파일 `examples/samples/saas-launch/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/saas-launch.mp4`, 시트 `renders/samples/saas-launch-sheet.png`.

### kinetic-typo

모델 fable. 문장 "오늘 할 일은 오늘". 오늘이 도장처럼 찍히고, 할 일 목록이 길어지다, 두 번째 오늘이 잘라내고 한 줄로 모임.

리뷰가 찾은 것: 목록이 폭의 1/3, 마지막 한 줄 140px로 85% 빈 화면, 56–104 빈 노랑, 도장 링이 글자와 겹침.

고친 것: 8행 170px 피치로 프레임 바닥까지, 마지막 3줄 260px, 헤드라인 66 시작, 링 반지름 340.

파일 `examples/samples/kinetic-typo/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/kinetic-typo.mp4`, 시트 `renders/samples/kinetic-typo-sheet.png`.

### data-story

모델 opus. 가상 도시 솔내시의 자전거 통행 12개월(샘플 데이터). 숫자 → 12 막대 → 선 → 9월 피크 인사이트.

리뷰가 찾은 것: 모노스페이스 쉼표가 숫자를 벌림, 도킹 라벨 16px, 120–150 빈 구간, 카운트업이 처음 20프레임에 몰림.

고친 것: 숫자를 Plex Sans KR tabular-nums로, 도킹 0.42 스케일(라벨 39px), 헤드라인 124·막대 128 시작, 카운트 10–70 ease-out.

파일 `examples/samples/data-story/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/data-story.mp4`, 시트 `renders/samples/data-story-sheet.png`.

### event-teaser

모델 sonnet. 가상 컨퍼런스 KERFWORKS 2027 티저. 선이 판으로, 이름, 트랙 셋, 날짜 카드.

리뷰가 찾은 것: 부제 16.5px, 트랙 03 노출 0.9s, 카드가 바에서 태어나지 않고 빈 종이 15프레임, 훅 느림, Manrope 한글 폴백.

고친 것: 부제 29px, 바 간격 22프레임, 바 2가 카드로 성장, 이름 72 시작, UI 글꼴 Noto Sans KR.

파일 `examples/samples/event-teaser/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/event-teaser.mp4`, 시트 `renders/samples/event-teaser-sheet.png`.

### app-onboarding

모델 sonnet. 가상 습관 앱 Pinora 온보딩 3단계. 카드가 쌓이고, 원 7개가 차고, 흐름 선이 됨.

리뷰가 찾은 것: 카드가 y 400–1500에 갇혀 상하 빈 공간, 라벨 36px, 80프레임 옵션이 라벨과 겹침, 마지막 하단 32% 빈 파랑.

고친 것: 카드 y 260–1660, 라벨 52/48px·헤드라인 124px, 예시 라벨 96 이후 등장, 로크업을 그래프 아래로.

파일 `examples/samples/app-onboarding/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/app-onboarding.mp4`, 시트 `renders/samples/app-onboarding-sheet.png`.

### logo-reveal

모델 haiku. 가상 스튜디오 ildra 로고. 원호 8조각이 링으로 잠기고 점이 되어 i의 점이 됨.

리뷰가 찾은 것: 122–188에 48px 점만 있는 2.2초, 회전 구간이 거의 정지, 라벨 30px, 플래시 타이밍 어긋남, 훅 느림.

고친 것: 빈 구간 압축(점 이동 140–164, 워드마크 176), 회전 56–96, 라벨 40px, 플래시 112–113, 조각 도착 30프레임.

파일 `examples/samples/logo-reveal/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/logo-reveal.mp4`, 시트 `renders/samples/logo-reveal-sheet.png`.

### podcast-promo

모델 haiku → opus 재작업. 가상 팟캐스트 느린 대화 에피소드 프로모. 파형이 갈라져 인용 세 줄, 파형이 밑줄이 되어 제목.

리뷰가 찾은 것: 요소가 프레임 대비 작음, 258–350 거의 빈 화면과 점선 잔상, 텍스트가 3.8초에야 등장.

고친 것: 재작업. 막대 30×80–460px, 인용 80px가 1.6초부터, 퇴장은 클립 와이프, 막대가 블록→밑줄로 두 단계 수렴, 제목 140px.

파일 `examples/samples/podcast-promo/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/podcast-promo.mp4`, 시트 `renders/samples/podcast-promo-sheet.png`.

### education-explainer

모델 opus. 복리 설명. 원 두 개 → 단리/복리 기둥 → 두 곡선과 그 사이 면적 → 공식 A=P(1+r)^n → 한 줄 정리.

리뷰가 찾은 것: 458–540 공식 빌드가 빈 파랑, 복리 라벨이 예시 태그에 붙음, 첫 장면 원이 작음, 헤드라인 뒤 공백, 점이 겹침.

고친 것: 기호 5프레임 간격, 곡선 끝 y 321·라벨 재배치, 첫 원 300px·헤드라인 190px, 제목 108 시작, 점 20px로 축소.

파일 `examples/samples/education-explainer/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/education-explainer.mp4`, 시트 `renders/samples/education-explainer-sheet.png`.

### countdown-hype

모델 sonnet. 가상 마켓 ZAPLOOM 세일 카운트다운. 숫자가 서로를 밀어내고 8초에 이름 슬램.

리뷰가 찾은 것: 마지막 2초에 글자 이동, 숫자가 작아져 70% 빈 화면, 24/30프레임 박자 불일치, Roboto Mono 한글 폴백, 라벨 32px.

고친 것: 이름 228–239 진입 후 240–299 정지(바이트 동일), 숫자 860→937px 성장, 배경 컷 48프레임 주기, Noto Sans KR, 라벨 42/52px.

파일 `examples/samples/countdown-hype/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/countdown-hype.mp4`, 시트 `renders/samples/countdown-hype-sheet.png`.

### product-feature

모델 opus. 가상 이어폰 Ossle 특징 셋. 원→실드→배터리→두 점이 같은 120점 윤곽으로 변신.

리뷰가 찾은 것: DM Serif Display 한글 없음(붓글씨 폴백, 30시간이 두 서체), 아이콘과 헤드라인 충돌, 270–300 빈 와이프, 예시 44px.

고친 것: Gowun Batang 700 + Noto Sans KR 500, 아이콘 중심 y 400, 첫 원 반지름 150·헤드라인 24 시작, 30시간 284 시작, 예시 56px 검정.

파일 `examples/samples/product-feature/` (prompt.md, Spot.tsx, entry.tsx). 영상 `renders/samples/product-feature.mp4`, 시트 `renders/samples/product-feature-sheet.png`.

## 스튜디오에서 보기

```sh
VIDEO_ENTRY=examples/samples/index.tsx npm run dev
```

`examples/samples/index.tsx`에 등록된 34편(위 표의 스물다섯 편, 비교 실험 9편)이 장면 목록에 나오고 재생 버튼으로 소리와 함께 미리 볼 수 있다. 교차 리뷰 원문은 `reviews/review-sonnet.md`, `reviews/review-opus.md`.

## 한계

- 에이전트는 소리를 듣지 못한다. 음악은 작품별 스펙에서 합성하며 수치(음량, LRA, 연속성, 편곡 점프)로만 검사한다(`docs/audio-score.md`). 처음 들어 본 사용자의 판정은 "이것저것 잘라 붙인 소리"였다. 원인은 효과음 과다(cmp-motion-opus는 13초에 12개)와 마디 중간에서 바뀌는 편성이었고, 효과음 밀도 규칙과 렌더러 가드, 마디선에 맞춘 편곡(생성기 v3)으로 고쳤다. cafe-morning이 그 첫 결과이고, 같은 날 효과음 경로를 의도 문장 기반 소스 해결(텍스트 생성 → CC0 녹음 → 합성)과 사이드체인 더킹으로 바꿔 cafe-morning에 먼저 적용했다(`docs/research/sfx-reference-study.md`). 기존 샘플의 음악은 그대로 두었다(사이드카 이관).
- 리뷰와 수정은 작성자가 고른 키프레임의 컨택트 시트 기준이다. 마지막에 인코딩된 MP4에서 15프레임 간격으로 뽑은 스트립(`renders/samples/<slug>-strip.png`) 열 장을 모두 봤다. 깨진 프레임, 크기 오류, 검은 프레임은 없었다. 눈에 띈 것: event-teaser 0–60은 검정 위 선 하나, kinetic-typo 225–285는 검정 위 "오늘"만 2초, saas-launch의 리뷰 카드와 podcast-promo의 제목 카드는 3–5초 정지. 재생 속도에서의 모션 질감은 보지 않았다.
- 플래시 검사는 Ofcom 지침의 근사이지 Harding 인증이 아니다.
- 글꼴은 Google Fonts에서 런타임에 받는다. 오프라인이면 폴백 글꼴로 렌더되고 가드 결과도 달라질 수 있다.
