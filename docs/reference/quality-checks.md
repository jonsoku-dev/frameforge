# 품질 검사

README에서 옮긴 검사 도구 레퍼런스입니다. 결정성 린트(`npm run lint:video`)와 런타임 멱등성 검사(`--check-idempotent`)는 [rendering.md](rendering.md)의 "결정성 린트와 병렬 렌더" 절에 있습니다. 검사 순서는 `skills/frameforge-check/SKILL.md`, 구성 최소치는 [../samples/rules.md](../samples/rules.md)입니다.

## 글자 잘림 검사

글자 잘림 검사: 렌더는 프레임마다 글자의 실제 잉크 범위(캔버스 `measureText`)를 가장 가까운 `overflow`/`clip-path` 조상과 비교하고, 0.5px 넘게 잘리면 `Clipped text: "퍼즐" top 8.3px`처럼 그 프레임을 실패시킵니다. 스튜디오는 잘린 글자에 빨간 테두리를 그리고 아래 막대에 `글자 잘림 N곳`을 표시합니다. 글자와 마스크 사이에 이동(translate) 변환이 있으면 등장 애니메이션 중으로 보고 검사하지 않습니다. 확대·회전은 그대로 검사합니다. 티커처럼 일부러 잘리는 요소는 `data-clip="allow"`로 제외하고, 스튜디오는 웹폰트 로드가 끝난 뒤 한 번 더 검사합니다.

## 품질 검사 도구

- `npm run frame-check -- <video.mp4>`: 인코딩된 영상에서 빈 화면 구간, 얼어붙은 구간(0.5초 전 프레임과 비교해 바뀐 픽셀 0.2% 미만이 1초 넘게 이어짐, 마지막 1초 끝 정지는 제외, `--hold`로 바꿈), 움직이는 프레임 비율(`motion share`), 중앙에 몰린 구성, 큰 요소가 없는 "얇은" 프레임 비율을 재고 통과·실패를 낸다(`scripts/frame-check.mjs`, 기준은 `docs/samples/rules.md`의 구성 최소치).
- `node scripts/flash-check.mjs <video.mp4>`: 방송 플래시 지침 근사. 연속된 같은 방향 변화는 한 전환으로 센다.
- `python3 scripts/assets/score-report.py <music.wav>`: 통합 음량, LRA, 트루 피크, 크레스트 팩터, 4대역 스펙트럼 균형, 스테레오 상관.
