# 모션그래픽 에셋은 어디서 오는가: 도구·오픈소스 조사 (2026-10-20)

사용자 판정: haiku·luna 같은 약한 모델이 그린 에셋은 원 하나·막대 하나 수준이라 작품 품질을 떨어뜨린다. 에셋은 모델이 아니라 파이프라인이 보장해야 한다. 그래서 실제 도구와 오픈소스가 에셋을 어떻게 다루는지 조사했다. 출처는 공개 문서·공개 API·블로그이며, 코드는 옮기지 않았다.

## 1. 관찰: 아무도 애니메이션 도구 안에서 에셋을 "그리지" 않는다

| 도구 | 에셋의 출처 | 애니메이션 도구가 하는 일 |
| --- | --- | --- |
| After Effects + Bodymovin/Lottie | Illustrator에서 레이어별로 그린 벡터. 움직일 조각마다 레이어 하나, 설명적 이름, 관절은 겹치게, 그라데이션·그림자·비트맵 금지, 글자는 윤곽선으로 | 가져온 레이어를 셰이프 레이어로 바꿔 움직이고 JSON으로 내보냄 |
| Rive / Jitter / Linearity Move | Figma·Illustrator·Sketch에서 만든 SVG(레이어 구조 유지)를 붙여넣기·플러그인으로 가져옴 | 가져온 레이어에 상태·타이밍을 입힘 |
| Motion Canvas | `Img` 노드에 파일을 넣거나(`import`), `Path` 노드에 SVG path 데이터를 주거나, 3.11의 제한적 `SVG` 노드 | 코드로 트윈·모핑 |
| Manim | `SVGMobject(파일)`로 SVG를 벡터 객체로 불러옴. 커뮤니티 플러그인이 TikZ·Font Awesome을 SVGMobject로 만듦 | 변환·페이드·그리기 |
| 기준 엔진의 "프롬프트→모션그래픽" 템플릿 | 공개 문서에는 에셋 출처가 없다. 스킬에 Lottie 규칙이 있어 LottieFiles 애니메이션을 끼우게 한다 | 코드 생성 |
| LottieFiles | 무료 애니메이션은 Lottie Simple License(상업 이용 허용, 저작자 표시 권장, 재배포 시 같은 조건), 작품별로 라이선스가 다를 수 있음 | 플레이어 |
| 일러스트 라이브러리 | Open Peeps·Humaaans CC0, unDraw 자체 라이선스(상업 OK, 재패키징·AI 학습 금지), Storyset 무료는 저작자 표시, Blush 무료는 PNG | 정적 SVG, 모듈형 조립(사람 캐릭터) |
| 아이콘 라이브러리 | Reicon(24 그리드, 1.5px 선, 일정한 모서리), exaBase(2px 선 규칙), Phosphor(굵기 6단계, IconContext로 전역 기본값) | 선 시스템이 "일관성"의 실체다 |
| AI 벡터 생성 | Recraft `POST /v1/images/generations` (`style: vector_illustration`, `/generations/vector` 전용 엔드포인트, 색 5개 지정), Adobe Firefly text-to-vector(SVG 내보내기, 네이티브 여부 논쟁), QuiverAI(텍스트→SVG, 이미지→SVG). LLM이 직접 SVG를 쓰는 길도 있으나 복잡한 장면은 깨진다 | 프롬프트에서 새 벡터 |
| Openverse | 이미지 검색에 `license=cc0&extension=svg`가 되고 Wikimedia Commons의 CC0 SVG(커피잔 등)가 바로 나온다. 키 없음 | CC0 벡터 소스 |

결론 셋.
1. 에셋은 **파일**이다. 디자이너는 벡터 도구에서 레이어 단위로 그리고, 애니메이션 도구는 가져온다. 코드로 그리는 것은 도형 수준(Motion Canvas `Path`, Manim 기본 도형)에서만 한다.
2. 일관성은 **선 시스템**에서 온다. 좋은 아이콘 세트의 공통점은 그리드·선 굵기·모서리 규칙 하나다.
3. 약한 모델에게 그리게 하지 말고 **고르고 파라미터를 주게** 해야 한다. 효과음과 같은 구조: 의도 → 소스 해결(생성 → CC0 라이브러리 → 내장 키트) → 조건화(정규화·재색) → 매니페스트.

## 2. Frameforge에 들이는 것

2026-10-20에 넷 모두 들어왔다. 실제 구현과 다른 점은 각 항목 끝에 적었다.

1. **모티프 키트 `src/assets/`**: 강한 모델이 한 번 그린 파라미터 에셋 라이브러리(컵, 카드, 폰, 노트북, 핀, 시계, 달력, 종, 하트, 별, 동전, 동전 탑, 막대 차트, 선 차트, 지도 경로, 문, 말풍선, 봉투, 재생 버튼, 배지, 트로피, 잎, 해, 구름, 스쿠터, 가방, 탑, 다리, 산 등). 모든 에셋이 같은 400 그리드·선 굵기·모서리 상수를 받고(`stroke`, `radius`, `ink`, `accent`, `soft`), `draw`(그려지기)와 `parts`(조립 순서)로 등장한다. 약한 모델은 `import {Cup} from '@/assets'`만 하면 된다. 구현: 44종(`src/assets/catalog.ts`). 지도 경로는 없고 `Pin`이 있다.
2. **에셋 해결 사슬 `scripts/assets/art.py` + `assets.json`**: 효과음과 같은 계약. `{name, intent, source}` → Recraft 벡터 생성(`RECRAFT_API_KEY`) → Openverse CC0 SVG(위키미디어 커먼즈) → 키트 매핑. 가져온 SVG는 정리(스크립트·외부 참조·`foreignObject` 제거, viewBox 정규화, 색을 작품 팔레트로 재매핑)해 `public/assets/generated/<slug>/<name>.svg`에 두고 `assets.json` 매니페스트와 `CREDITS.md`를 쓴다. 코어 `<Art slug name draw />`가 인라인으로 그려 draw-in과 재색이 된다. 구현: 순서는 `host`(호스트 에이전트가 둔 파일) → `image-command`(`FRAMEFORGE_IMAGE_COMMAND`) → `generate` → `library` → `kit`이고, 컴포넌트는 `<Art src="/assets/generated/<slug>/<name>.svg" size draw ink accent soft paper />`다.
3. **Lottie 어댑터 `<Lottie src frame />`**: lottie-web(MIT)의 `goToAndStop(frame, true)`로 프레임 결정적 재생. LottieFiles 무료 애니메이션은 Simple License(작품 페이지의 라이선스를 확인해 `prompt.md`에 적는다).
4. **에셋 시트 검사**: 키트는 `src/assets/Sheet.tsx`의 `AssetSheet`로 그린다. 작품의 에셋만 한 장에 정지 상태로 렌더해 실루엣 테스트와 선 굵기를 눈으로 본다(`docs/guides/assets.md` 주 에셋 품질 기준).

## 출처

- Illustrator→AE→Lottie 준비 규칙: pixflow.net/blog/illustrator-to-after-effects-workflow, elpassion.com/blog/lottie-who-common-mistakes, ics.media/en/entry/230928
- Rive·Jitter·Move 가져오기: rivemasterclass.com/blog/import-figma-to-rive, jitter.video/product, linearity.io/academy/move/.../import-assets
- Motion Canvas 미디어·SVG 노드: motioncanvas.io/docs/media, motioncanvas.io/blog/version-3.11.0; Manim SVGMobject: docs.manim.community
- LottieFiles 라이선스: help.lottiefiles.com/animation-licensing-basics-, docs.lottiefiles.com premium-animations
- 일러스트 라이브러리 라이선스: pixels.market/blog/undraw-license, sketchvalley.com/blog/free-illustrations-no-attribution
- 아이콘 선 시스템: github.com/dqev/reicon, exawizards.com/exabase/design/icons, Phosphor React
- AI 벡터: recraft.ai/docs/api-reference/endpoints.md, openart.ai/blog/best-ai-vector-generators, perfectvector.com/blog/can-ai-generate-svg
- Openverse 이미지 API 직접 호출(2026-10-20): `GET /v1/images/?q=coffee%20cup&license=cc0&extension=svg` → Wikimedia Commons CC0 SVG 5건
