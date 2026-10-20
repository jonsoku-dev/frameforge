# screen-intro

Purpose: a 30 s explainer that introduces a fictional video app (Moru) to a first-time user by showing the real captured screen and pointing at six buttons.


Format: 1920x1080, 30 fps, 900 frames, composition id `ScreenIntro`, port 4415.
Palette: ink #0F0F0F (opening and ending background, shadow block, label cards), paper #FFFFFF (text), accent #FF4D4D (callout stroke), muted #AAAAAA (stage behind the screen card). Dim overlay is ink at 0.55.
Fonts: Noto Sans KR 900 headlines (Glyphs rise), Noto Sans KR 500 labels. The screenshots carry the app's own type.
Icons: lucide-react (ISC). Search, Menu, Bell, ThumbsUp, Share2, Bookmark, Play, MessageSquare.

Screen card: screenshot at its natural 1920x1080 inside a container scaled 0.82 and centred, ink block offset 24 px behind it. Camera: translate then scale so the target centre lands at frame centre, spring 18 frames, overshoot clamped. The focus is clamped so the screenshot never leaves a gap at the frame edge when pushed, so a target near the screen edge settles off-centre. The player push uses 1/0.82 instead of 1.15 so the screenshot fills the frame exactly (1.15 would leave a gap).

Target rectangles (screen px), checked against the PNGs: search box 642,8,600,40 (the brief's 566 start is the DOM container; the drawn box starts at 642); left menu 14,68,200,120; 구독 (channel) 615,428,56,40; player 16,68,1344,756; 좋아요 974,874,94,40; 공유 1132,874,84,40; 저장 1226,874,86,40; 댓글 header 16,1052,1344,28.

| Frames | Fills the frame | Motion | Text |
|---|---|---|---|
| 0-75 | ink | headline glyphs rise (two lines), six icons spring in under it | 모루, 버튼 여섯 개만 / 알면 됩니다 |
| 75-150 | muted stage rises with home.png card | callout 1 at 95 on the search box, push 1.5 | 검색창. 보고 싶은 것을 입력 |
| 150-225 | same | camera back to 1.0 by 165, callout 2 at 170 on the left menu, push 1.3 | 왼쪽 메뉴. 홈, Shorts, 구독 |
| 225-300 | channel.png slides in from the right, home exits left | callout 3 at 245 on 구독, push 1.6 | 구독. 새 영상이 오면 알려줘요 |
| 300-375 | watch.png slides in the same way | callout 4 at 318 on the player, push to full bleed | 영상 화면. 클릭하면 재생과 멈춤 |
| 375-600 | watch.png pushed 1.7 on the button row | hole and stroke spring from button to button at 375, 450, 525 | 좋아요. 마음에 들면 / 공유. 친구에게 보내기 / 저장. 나중에 다시 보기 |
| 600-675 | watch.png at 1.0, lifted 120 px | callout 7 at 615 on the comments header | 댓글. 아래로 내리면 이야기가 이어져요 |
| 675-840 | stage slides down, ink returns | line rises from 683, six icons spring in with their words from 712, settled by 760 | 이제 눌러 보세요; 검색 메뉴 구독 좋아요 공유 저장 |
| 840-899 | hold | nothing moves | same |

Audio: /audio/generated/screen-intro/music.wav at 0.9. click.wav at 95, 170, 245, 318, 375, 450, 525, 615 (every callout). whoosh.wav at 75, 225, 300, 675 (every screen slide).
Check frames: 40, 110, 200, 270, 340, 400, 480, 560, 640, 760, 880.
