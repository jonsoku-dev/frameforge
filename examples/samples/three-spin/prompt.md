# three-spin (10초, 1920×1080, 30 fps, 300프레임)

목적: `ThreeCanvas`(three + @react-three/fiber 어댑터)가 렌더러에서 결정적으로 돌아가는지 보이는 샘플. 가상 스튜디오 "각진 결 스튜디오"의 아이덴트. 브랜드는 가상이다.

| 프레임 | 장면 | 화면을 채우는 것 |
| --- | --- | --- |
| 0–60 | 보석이 어둠 속에서 떠오른다 | 저폴리 보석(잉크 외곽선, 면 선) |
| 60–240 | 보석이 조명 아래 회전, 카메라 푸시 | 보석과 제목 |
| 240–300 | 제목·태그라인, 정지 | 제목 |

팔레트: ink `#0B1220`, paper `#E2E8F0`, accent `#38BDF8`. 글꼴: Black Han Sans, Noto Sans KR.
소리: `audio.json` mood tech, 카메라 스케일에 모션 프로브 하나. 렌더 로그의 motionSounds: land@8 하나(whoosh는 발화 안 함).
검증: 60프레임 두 번 렌더 PSNR inf(동일), 연속 프레임은 전부 다름(움직임 있음). Metal GPU에서만 확인했다.
