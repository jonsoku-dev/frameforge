# 오픈소스 공개 전 점검 (2026-10-20)

공개 대상: 이 저장소 전체를 MIT로 공개한다. 기준 엔진(Remotion 4.0.537)을 블랙박스로 관찰하고 공개 문서를 참고해 독립 구현했다는 점이 핵심 위험이다. 아래는 저장소 안의 파일을 하나씩 확인한 결과다. 법률 자문이 아니며, 공개 전 판단은 저장소 소유자가 한다.

## 판정 요약

| 등급 | 뜻 |
| --- | --- |
| 차단 | 고치기 전에는 공개하지 않는다 |
| 조치 | 공개 전에 고치는 것이 맞다 |
| 확인 | 지금 상태로 공개 가능하나 근거를 기록해 둔다 |

| # | 항목 | 등급 | 근거와 조치 |
| --- | --- | --- | --- |
| 1 | 실제 브랜드 화면 캡처 `public/screens/youtube/*.png`(4장), `public/screens/wikipedia/*.png`(3장) | 차단 | YouTube 캡처에는 Google의 UI·로고와 제3자 썸네일·채널 이미지가 들어 있다(각각 저작권자 다름). 위키백과 캡처는 본문이 CC BY-SA 4.0이라 재배포 시 저작자 표시와 동일 조건 변경 허락 의무가 생겨 MIT 저장소와 맞지 않는다. 조치: 두 폴더를 저장소에서 빼고, `youtube-intro`·`cmp-website-*` 샘플은 "사용자가 직접 캡처를 넣는" 방식(`.gitignore` + 캡처 스크립트 `.scratch/wiki/capture.mjs`를 `scripts/capture.mjs`로 승격)으로 바꾼다 |
| 2 | 실제 브랜드를 쓴 예제 `examples/YahooJapan.tsx`, `examples/yahoo-assets.tsx`, `examples/LineGameSpot.tsx`, `examples/samples/tsumtsum-jp/`(「LINE：ディズニー ツムツム」 문구, 브리프의 Disney·LINE 언급), `examples/samples/youtube-intro/` | 차단 | 상표(Yahoo! JAPAN, LINE, LINE GAME, Disney, ツムツム, YouTube)를 광고 영상 형태로 쓰면 제휴·보증 오인 위험이 있다. 특히 `yahoo-assets.tsx`는 실제 서비스 아이콘을 따라 그린 것이라 트레이드 드레스 문제가 될 수 있다. 조치: 공개판에서는 가상 브랜드로 바꾸거나(카피·이름·색만 교체) 비공개 폴더로 옮긴다. 업무용 작품(tsumtsum-jp)은 고객 자료이므로 공개 저장소에서 뺀다 |
| 3 | 블랙박스 오라클 데이터 `compatibility-benchmark.json`, `compatibility/*.json`, `community-compatibility.json` | 조치 | 기준 패키지를 실행해 얻은 입력·출력 쌍이다. 수치(보간·스프링·노이즈·경로 좌표)는 사실 데이터라 위험이 낮다. 그러나 `compatibility/transitions.json`(253건)과 `motion-blur.json`, `shapes.json`에는 기준 패키지가 렌더한 **마크업 문자열**이 그대로 들어 있고, 그중 transitions는 npm 라이선스가 UNLICENSED다. 조치: 마크업은 비교에 필요한 숫자·구조 요약(태그 이름과 숫자 배열)으로 바꾸거나, 공개판에서 이 세 파일을 빼고 테스트를 선택 실행으로 돌린다. 각 파일 머리의 `reference` 문구에 "기준 패키지 실행 출력이며 코드는 포함하지 않음"을 명시한다 |
| 4 | API 이름과 형태의 동일성(`Composition`, `Sequence`, `interpolate`, `spring`, `TransitionSeries` 등) | 확인 | API 이름·시그니처를 맞춘 독립 구현이다. 미국 Google v. Oracle(2021)은 API 재구현을 공정 이용으로 봤고, EU SAS v. World Programming(2012)은 기능·프로그래밍 언어·파일 형식이 저작권 보호 대상이 아니라고 봤다. 구현 파일은 열지 않았다는 기록이 `docs/legal/remotion-license-review.md`와 각 단계 보고에 있다. 조치 없음. 단, 독립 구현 절차(문서·.d.ts·블랙박스 실행만, 구현 파일 금지)를 `CONTRIBUTING.md`에 고정한다 |
| 5 | 기준 엔진 라이선스의 금지 조항(파생물 재라이선스, 소스로 제공되지 않은 부분의 역공학) | 확인 | 이 저장소는 기준 엔진 코드를 복사·수정하지 않았다(파생물 아님). REA는 npm에 소스로 배포된 JavaScript 산출물의 export 목록·모듈 이름만 인벤토리했고, compositor 바이너리·FFmpeg·Lambda 산출물은 열지 않았다. 블랙박스 실행은 Free License(개인) 범위의 "사용"이다. 조치: 공개 후 기여자가 늘어 팀이 3인을 넘으면 기준 엔진 라이선스의 무료 자격을 다시 확인한다(실행 오라클을 다시 만들 때만 해당) |
| 6 | 기준 엔진 이름의 표기 | 확인 | 남은 곳은 `docs/legal/`, `docs/research/`, `verification.json`, 오라클 JSON의 `reference` 필드, `examples/community/{LICENSE,source.json}`(원저작자 표기)뿐이다. 모두 지명적 사용(비교·출처)이다. 조치: README 첫머리에 "Remotion과 제휴하지 않은 독립 구현" 한 줄을 둔다(상표의 지명적 사용 관행) |
| 7 | 제3자 코드 `examples/community/`(jessai2026/remotion-playground, MIT, 6개 파일) | 조치 | MIT 원문(`examples/community/LICENSE`)과 출처(`source.json`)가 있다. 그러나 `source.json`의 "byte-for-byte unchanged"는 더 이상 사실이 아니다(import 지정자와 주석 한 줄을 바꿈). 조치: 문구를 "import 지정자와 주석 한 줄만 변경"으로 고치고, 루트 `THIRD_PARTY_NOTICES.md`에 목록을 둔다 |
| 8 | 글꼴 `public/fonts/line-seed/`(LINE Seed Sans/KR/JP, LY Corp., SIL OFL 1.1) | 조치 | OFL은 재배포를 허용하지만 라이선스 전문을 함께 실어야 하고 예약 글꼴 이름 규칙이 있다. 지금 `NOTICE.txt`에는 URL만 있다. 조치: OFL 1.1 전문을 `public/fonts/line-seed/OFL.txt`로 넣고 THIRD_PARTY_NOTICES에 기록 |
| 9 | 런타임에 받는 자원(Google Fonts, Openverse CC0 녹음·SVG, ElevenLabs·Recraft 생성물) | 확인 | 저장소에 커밋되지 않는다(`public/audio/generated/`, `public/assets/generated/`, `.cache/`가 `.gitignore`에 있음). CC BY를 쓰면 `CREDITS.md`가 생성된다. 조치: README에 "생성물의 라이선스는 사용자가 확인한다"와 CC BY 표기 의무를 적는다 |
| 10 | 직접 만든 미디어 `public/footage/*.mp4·gif`(ffmpeg testsrc2·mandelbrot) | 확인 | ffmpeg 테스트 패턴으로 생성. 저작권 문제 없음 |
| 11 | 개인 정보·로컬 경로 | 조치 | `plugin.json`·오버레이의 `repository`가 `github.com/jongseoklee/frameforge`로 되어 있다(실제 공개 주소로 맞출 것). `examples/samples/*/process.json` 5개와 `docs/studio/spec.md`에 `/Users/jongseoklee/...` 절대 경로가 있다. 사용자 이메일은 저장소에 없다. 조치: 절대 경로를 저장소 상대 경로로 치환 |
| 12 | 다른 프로젝트 코드 참조(HyperFrames Apache-2.0, Motion Canvas·Revideo MIT) | 확인 | 설계·패턴만 참고했고 코드를 옮기지 않았다고 각 보고에 기록돼 있다. Apache-2.0 코드를 옮겼다면 NOTICE 의무가 생기지만 해당 없음. `docs/research/*`에 파일 경로를 인용한 것은 출처 표기다 |
| 13 | 외부 글 요약 `docs/references/opus-5-5/*.md`(note.com, X, 강좌 등) | 조치 | 원문을 옮기지 않은 요약이지만 표·문장이 원문 구조를 따르는 부분이 있다. 조치: 각 파일 머리에 출처와 "요약, 원문 아님"을 두고, 인용은 짧게 유지(지금 상태로도 짧다). 불안하면 공개판에서 폴더를 뺀다 |
| 14 | 의존성 라이선스 | 확인 | 직접 의존성 22개: MIT 18, Apache-2.0 2(class-variance-authority, typescript), ISC 1(lucide-react). 모두 MIT 저장소와 호환. `license-checker`의 UNLICENSED 1건은 이 저장소 자체(`private: true`, license 필드 없음) |
| 15 | `package.json` | 조치 | `"private": true`, `license` 필드 없음. 조치: `"license": "MIT"`, `"repository"`, `"bugs"`, `"homepage"` 추가. npm 공개 시 이름을 정하고 `private` 해제 |
| 16 | 시험·검증 기록 `verification.json`, `docs/samples/*`(모델 비교) | 확인 | 내부 작업 기록이다. 모델 이름·평가가 들어 있으나 문제될 내용 없음. 공개판에서 남길지 선택 |

## 공개 전 체크리스트

1. [차단] `public/screens/` 삭제, 캡처 스크립트 승격, 해당 샘플을 "캡처를 직접 넣는" 방식으로 전환.
2. [차단] 실브랜드 예제(Yahoo, LINE GAME, ツムツム, YouTube 소개) 제거 또는 가상 브랜드로 교체. 업무용 작품은 별도 비공개 저장소로.
3. [조치] 마크업 오라클 3종을 숫자 요약으로 바꾸거나 제외.
4. [조치] `THIRD_PARTY_NOTICES.md`(community 예제 MIT, LINE Seed OFL 전문, 의존성 표), `source.json` 문구 수정.
5. [조치] 절대 경로 치환, 매니페스트의 저장소 주소 확정, `package.json` 라이선스 필드.
6. [조치] README에 비제휴 문구, 생성물 라이선스 안내.
7. [확인] `CONTRIBUTING.md`에 독립 구현 규칙(구현 파일 금지, 오라클 절차) 고정.
