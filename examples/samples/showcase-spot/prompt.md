# 하루결 · 쇼케이스 스팟 (ShowcaseSpot)

목적: Frameforge의 새 레버가 한 편 안에서 어떻게 맞물리는지 보여 주는 24초 제품 스팟. 가상 브랜드 "하루결"(일정·메모·할 일을 한 결로 모으는 앱). 숫자는 모두 예시.

- 형식: 1920×1080, 30fps, 720프레임. 마지막 2.3초 정지.
- 색: ink `#121A2B`, paper `#F4F1EA`, accent `#2F5BFF`, soft `#CFD6E6`.
- 글꼴: Gothic A1 900(디스플레이), Noto Sans KR 500/600(UI).
- 나레이션: `narration.json` 7줄, macOS `say` Yuna. 장면은 `narration.timing.json`의 줄 시작에서만 바뀐다(`useNarration`).
- 소리: `audio.json` 120bpm(2초 마디), 음악은 음성 아래로 내려간다(렌더러 덕킹). 효과음은 움직임에서(`MotionSound` move/land).

## 레버

| 레버 | 어디서 |
| --- | --- |
| 블록 카탈로그 | `GlyphRise`(모든 제목), `LowerThird mask-reveal`(이름), `NotificationCard`×3(제품), `Donut`+`StatCard`(데이터), `ProcessSteps`(단계), `LogoOutro`(마무리) |
| 이음새 | 한 방향(왼쪽) `cutTheCurve` 3곳, 이름으로 들어가는 `zoomThrough`, 약속이 크게 오는 `inverseZoom`, 마지막 `rackFocus` |
| 나레이션 | `Voiceover`, rail `Subtitles`, embed 한 단어(하루결) |
| 3D | `3d.json`의 토러스 턴테이블 150프레임(EEVEE, 투명)을 `ImageSequence`로 이름·제품 장면에 |
| 생성 배경·효과 | 훅의 `aurora`, 약속의 `flowField`, cta 이음새의 `lightLeakEffect`, 마지막 카드의 `vignetteEffect`+`grainEffect` |
| 주석 | 훅의 `Encircle`, 약속의 `Highlight` |

## 장면표 (절대 프레임, 나레이션 타이밍에서 파생)

| 프레임 | 줄 | 화면을 채우는 것 |
| --- | --- | --- |
| 0–132 | hook | 오로라 위 두 줄 제목, 둘째 줄에 원 주석 |
| 133–174 | name | 토러스 히어로(가로 62%)와 embed "하루결", 로어서드 |
| 175–274 | product | 제목 + 토스트 카드 셋이 오른쪽에서 들어오고, 히어로가 오른쪽에 남는다 |
| 275–403 | data | 도넛 80%와 스탯 카드 8명 |
| 404–524 | steps | 세 단계 프로세스 |
| 525–589 | promise | 플로우 필드 위 두 줄, 둘째 줄 하이라이트 |
| 590–720 | cta | 로고 아웃트로, 비네트와 그레인, 정지 |

## 검사 프레임

30, 100, 150, 200, 250, 320, 380, 450, 500, 560, 620, 700

## 확인하지 못한 것

prompt.md를 쓰는 시점에 전체 렌더 전. 결과는 `docs/samples/README.md`와 `verification.json`에 적는다.
