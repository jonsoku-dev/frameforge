# 샘플 10편 계획 (2026-10-20)

같은 엔진, 같은 규칙(`rules.md`), 다른 모델, 다른 프롬프트. 브랜드는 전부 가상이다.

| # | slug | 모델 | 형식 | 길이 | 프롬프트 요지 | 트랙 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | saas-launch | opus | 1920×1080 | 30s | 가상 작업관리 SaaS "Pindeck" 런치. 문제 공감 → 기능 셋 → 이름. 텍스트와 추상 UI 카드 교차, 핵심 기능에 줌인 | upbeat-30 |
| 2 | kinetic-typo | fable | 1080×1920 | 15s | 세로 키네틱 타이포. 문장 "오늘 할 일은 오늘". 글자가 뜻을 연기한다 | minimal-15 |
| 3 | data-story | opus | 1920×1080 | 20s | 샘플 데이터로 한 도시의 자전거 통행량 이야기. 막대·선 차트가 자라고 한 숫자로 수렴 | calm-20 |
| 4 | event-teaser | sonnet | 1920×1080 | 15s | 가상 컨퍼런스 "FRAME CONF 2027" 티저. 날짜·장소·세 트랙 | dramatic-15 |
| 5 | app-onboarding | sonnet | 1080×1920 | 20s | 가상 습관 앱 "Dayloop" 온보딩 3단계. 카드가 쌓이고 넘어간다 | calm-20 |
| 6 | logo-reveal | haiku | 1920×1080 | 10s | 가상 스튜디오 "Octant" 로고 리빌. 기하 도형 여덟 조각이 모인다 | tech-10 |
| 7 | podcast-promo | haiku | 1920×1080 | 15s | 가상 팟캐스트 "느린 대화" 에피소드 프로모. 막대 파형과 인용문 | minimal-15 |
| 8 | education-explainer | opus | 1920×1080 | 25s | 복리 개념 설명. 원이 쌓이고 곡선이 휘는 과정, 수식 하나 | calm-25 |
| 9 | countdown-hype | sonnet | 1920×1080 | 10s | 가상 마켓 "NOVA" 10초 카운트다운. 숫자가 화면을 밀고 들어온다 | tech-10 |
| 10 | product-feature | opus | 1920×1080 | 20s | 가상 이어폰 "Hush One" 특징 셋. 추상 아이콘이 다음 장면의 재료가 된다 | upbeat-20 |

이 표는 처음 계획이다. 이름과 트랙은 만드는 동안 바뀌었고 실제 결과는 `README.md`가 기록이다. 트랙 열은 공용 음원 시절의 이름이며, 지금은 작품마다 `audio.json`에서 소리를 생성한다.

렌더는 전부 끝난 뒤 한 번에 `renders/samples/<slug>.mp4`와 `<slug>-sheet.png`로 만들고, 플래시 검사와 라우드니스를 기록한다.
