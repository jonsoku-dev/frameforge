# 예시 지수 설명 영상 (narrated-explainer)

목적: 가상의 지표 "예시 지수"(집중한 시간 ÷ 전체 시간 × 100)를 29초 안에 말로 설명한다. 이 작품은 **내레이션 우선** 샘플이다. 대사(`narration.json`)를 먼저 쓰고 `npm run voice`로 읽혀 길이를 잰 뒤(`narration.timing.json`), 장면은 `useNarration`으로 그 길이에서 나온다.

- 형식: 1920×1080, 30fps, 870프레임(29초). 마지막 대사가 789프레임에 끝나고 2.7초 정지.
- 브랜드: "예시 지수"는 가상 서비스. 모든 숫자는 예시(화면에 "예시" 표기).
- 색: ink `#14213D`, paper `#F3EFE6`, accent `#F08A24`, soft `#D9D4C7`.
- 글꼴: Gothic A1 900(디스플레이), Noto Sans KR 500/600(UI, 자막).
- 선 굵기 16px, 모서리 반지름 18px 하나.
- 목소리: macOS `say` Yuna(ko). 음악은 `audio.json`(warm, 96bpm) 에너지 0.45 이하로 깔고 `<Audio volume={0.45}>`.

## 장면표 (절대 프레임, 대사 경계에서만 바뀐다)

| 장면 | 시작 | 대사 | 화면을 채우는 것 | 모션 |
| --- | --- | --- | --- | --- |
| hook | 0 | hook (18–108) | 시계(키트 Clock, 491px) 그려짐, 헤드라인 2줄 글자 올리기 | shape draw, glyph rise |
| define | 121 | define (121–241) | 종이 원이 시계에서 퍼짐, 임베드 "집중" 뒤, 링(567px)이 비율만큼 채워짐 | wipe, ring draw |
| formula | 253 | formula (253–363) | KaTeX 공식 `I = t_f / t_a × 100` 왼쪽에서 그려짐, "×100" 강조 | card rise, draw |
| example | 375 | example (375–484) | 막대 둘(전체 8시간, 집중 5시간) 스프링으로 자람 | spring plates |
| result | 496 | result (496–558) | 큰 숫자 0→62.5, 링이 같은 비율로 채워짐, 카메라 푸시 1 | count, ring |
| trend | 579 | trend (579–679) | LineChart(키트, 605px) 그려짐, 헤드라인 | shape draw, glyph rise |
| close | 692 | close (692–789) | ink 와이프, 이름 "예시 지수", 밑줄 바, 카메라 푸시 2 | wipe, glyph rise |
| hold | 790–869 | 없음 | close 화면 정지 | 없음 |

## 자막

- 레일: 모든 대사를 그대로, 하단 10% 안쪽(타이틀 세이프 80% 박스) 가운데, 단어별 노출, 강조어는 accent. 오버레이이므로 장면은 프레임 중앙에 그대로 둔다.
- 임베드: define 대사의 "집중" 하나만. 이웃 대사에는 두지 않는다.

## 소리

- `voice.wav`는 `narration.json`에서, `music.wav`/`whoosh.wav`/`pop.wav`는 `audio.json`에서 생성. 히트는 4.0초(임베드 등장), 16.5초(숫자 시작)에 soft.
- 효과음은 MotionProbe(clock, field, formula, bar-total, bar-focus, chart, close-wipe)에서 엔진이 받는다. quiet: 121, 496.

## 검사 프레임

30, 150, 300, 420, 540, 620, 760, 850

## 검사

- `npm run voice -- examples/samples/narrated-explainer/narration.json` → totalMs 26299, provider say/Yuna.
- `npm run narration-check -- examples/samples/narrated-explainer --prompt prompt.md` → PASS.
- 측정하지 않은 것: 전체 렌더의 frame-check와 flash-check(통합 담당이 돌린다). 음악이 목소리 아래로 자동으로 줄어드는 덕킹은 렌더러에 아직 없어 음악 볼륨을 0.45로 낮춰 두었다.
