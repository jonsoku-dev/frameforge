# 에셋 규칙

이 문서는 스팟 한 편이 쓰는 소리, 아이콘, 글꼴, 제품 화면 캡처, 색을 어떻게 만들고 기록하는지 적는다. 모션 작성법은 `docs/guides/motion-graphics.md`에 있다. 파일에서 읽은 사실은 그대로 적고, 추정은 "추정"이라고 표시했다.

## 1. 오디오

### 작품마다 자기 소리를 만든다

공용 음원 라이브러리는 없다(`docs/samples/rules.md`). 이유는 소리가 그 작품의 모션에 맞춰 만들어져야 한다는 사용자 규칙이다. 이 규칙은 이 문서를 요청한 작업 지시에서 옮겼다. 저장소 문서에는 `rules.md`의 "공용 음원은 없다" 한 줄만 있다. 같은 30초 트랙을 두 편이 나눠 쓰면 타격이 어느 한쪽의 사건에도 맞지 않는다.

`scripts/assets/`에는 음악·효과음 생성기 `score.py`, 효과음 소스 해결기 `sfx.py`, 측정 도구 `score-report.py`, 그림 에셋 해결기 `art.py`가 있다. 샘플 코드는 모두 `/audio/generated/<slug>/`을 가리킨다.

### 사양 파일

소리가 있는 작품은 사양 JSON 하나를 갖는다. 형식의 기준 문서는 `docs/audio-score.md`다.

| 작품 | 사양 위치 | slug |
| --- | --- | --- |
| 샘플 | `examples/samples/<slug>/audio.json` | 폴더 이름 |
| 소리 없는 작품 | 사양을 두지 않는다 | 없음 |

`slug`가 위치와 다르면 생성기가 오류를 낸다. 주요 필드는 아래와 같다.

| 필드 | 값 |
| --- | --- |
| `durationSeconds` | 영상 길이와 같게. `music.wav`가 샘플 수까지 이 길이다 |
| `bpm` | 60–180 |
| `key` | `A minor`처럼 으뜸음과 장단 |
| `mood` | upbeat, calm, dramatic, minimal, tech, warm, corporate, lofi, house, hiphop, cinematic, ambient, chiptune 중 하나. 악기 구성을 고른다 |
| `sections` | 0초부터 끝까지 빈틈없이. 구간마다 `energy` 0–1 |
| `hits` | 초(숫자) 또는 `{"at", "weight", "style"}` 객체. 무게에 비례해 롤, 라이저, 킥, 서브 드롭, 크래시가 들어간다(`docs/audio-score.md` 히트) |
| `sfx` | `name`과 `intent`(무슨 소리인지 한 문장), 한 사건이면 `length`. 이름마다 `<name>.wav` 하나. `preset`만 적으면 합성 폴백 |
| `seed` | 같은 사양과 같은 시드는 같은 바이트 |
| `loudness` | `{"I": -24, "TP": -2}` |

### 장면표에서 구간과 타격을 뽑는다

사양은 장면표를 옮긴 것이다. 순서는 다음과 같다.

1. 장면 경계를 초로 바꿔 `sections`의 경계로 쓴다. 프레임을 30으로 나눈다.
2. 훅은 낮게, 본론은 높게 `energy`를 준다. 마지막 2초 구간은 0.15 이하로 둔다(`docs/samples/rules.md`).
3. 화면의 큰 사건(충돌, 이름 등장, 카운트 끝)을 `hits`에 초로 적는다.
4. 작은 사건(판 진입, 클릭, 체크)은 효과음으로 두고 `sfx`에 `intent` 문장과 `length`를 적는다.

cafe-morning이 예다. 장면표의 경계 150, 375프레임이 사양의 5, 12.5초가 되었다. 이름 구간은 96 BPM의 2.5초 마디선에 맞춰 17.5초(525프레임)에 시작한다. 화면의 이름은 480프레임에 먼저 들어온다. `hits`의 5.0초는 카드 셋이 들어오는 150프레임이고, 12.5초는 약속 장면이 시작하는 375프레임이다. 에너지는 0.3, 0.75, 0.6, 0.1이다(`examples/samples/cafe-morning/audio.json`, `examples/samples/cafe-morning/prompt.md`).

### 효과음 프리셋과 배치

효과음 소스는 `intent` 문장으로 Openverse CC0 녹음 → 아래 합성 프리셋 순으로 정해진다(`scripts/assets/sfx.py`, `docs/audio-score.md` 효과음 절). 프리셋은 폴백이고 전체 표(variant 포함)는 `docs/audio-score.md`에 있다.

| 프리셋 | 길이 | 소리 | 어울리는 사건 |
| --- | --- | --- | --- |
| `click` | 0.20초 | 2.2 kHz 짧은 클릭 | 콜아웃, 버튼 |
| `pop` | 0.25초 | 위로 휘는 팝 | 스프링 착지 |
| `whoosh` | 0.60초 | 왼쪽에서 오른쪽으로 지나가는 대역 노이즈 | 판 진입, 화면 미끄러짐 |
| `impact` | 0.90초 | 서브 / 금속 / 종이 타격(variant) | 충돌, 이름 슬램 |
| `riser` | 2.00초 | 올라가는 노이즈와 톤 | 큰 사건 2초 전 |
| `ding` | 0.80초 | 종소리 | 완성, 체크 |
| `tick` | 0.05초 | 아주 짧은 틱 | 카운트 |
| `swell` | 1.00초 | 커지는 화음과 열리는 노이즈 | 장면 열림 |
| `stinger` | 1.20초 | 짧은 슈퍼소 화음 타격, 킥, 짧은 크래시 | 로고 |
| `shimmer` | 1.50초 | 고역 노이즈 스윕 | 반짝임 |

효과음의 타이밍과 밀도는 사건과 믹스에 맞춰 고른다. 현재 렌더러의 `sfxFault`는 0.5초보다 가까운 효과음과 4초 안의 과밀도를 검사해 어기면 렌더를 거부한다. 검사 통과가 음질이나 지각적 동기화를 보증하지 않으므로 가능한 경우 최종 믹스를 듣는다.

"어울리는 사건" 열은 샘플에서 쓴 예를 모은 것이다. 생성기가 정한 규칙은 아니다. 같은 프리셋을 두 이름으로 적으면 서로 다른 테이크가 나온다.

배치는 움직임에서 받는 것이 기본이다. 움직이는 값을 `useMotionSound`/`<MotionProbe>`로 보고하고 `<MotionSound src role families quiet />`로 파일을 선언하면 엔진이 시작·착지·등장 사건에 소리를 놓는다(`docs/audio-score.md` 움직임에서 나오는 소리). 작품 코드가 사건을 직접 배치할 수도 있다. 사건과 같은 프레임의 `<Sequence from={n} durationInFrames={30} layout="none">` 안에 `<Audio src="/audio/generated/<slug>/<name>.wav" volume={0.8} />`를 둔다. 음악은 루트에 `volume={0.9}`로 하나다. 반복 사건은 배열로 펼쳐 화면과 소리가 같은 프레임 목록을 쓰게 한다. 그래서 타이밍을 고치면 둘이 같이 움직인다.

### 음량 정책

음악의 목표는 −24 LKFS, 트루 피크 −2 dBTP다. 국내 TV 송출 기준이다. 납품 판정은 최종 믹스 기준 −24 ±2 LKFS다. 샘플 열 편이 모두 −24.68에서 −25.16 사이에 들었다(`docs/samples/README.md`).

생성기는 ffmpeg `loudnorm` 2패스로 맞춘다. 원본 LRA가 목표보다 크면 loudnorm이 압축기로 바뀌어 일부러 낮춘 도입부를 눌러 버린다. 그래서 LRA 목표를 측정값(7–50 LU)으로 올려 두 번째 패스가 선형 이득 하나로 끝나게 한다. 트루 피크 여유가 없으면 tanh 소프트 리밋을 단계적으로 건다. 효과음은 샘플 피크 −18 dBFS다(`docs/audio-score.md`).

LRA에는 주의할 점이 있다. 조용한 훅과 사라지는 꼬리 때문에 LRA가 크다. 송출처가 LRA 상한을 요구하면 도입부와 꼬리의 에너지를 올려 다시 만들어야 한다. 효과음은 1초보다 짧아 단독 통합 음량이 참고값일 뿐이다. 믹스를 다시 잰다.

### 생성 시점

아래는 엔진 내 샘플의 생성 경로다. 결과는 엔진의 `public/audio/generated/<slug>/`이며 `.gitignore`에 있다. 외부 프로젝트의 자동 score·voice 생성 및 공용 생성 오디오 읽기는 충돌 방지를 위해 임시 차단된다. 외부 프로젝트는 직접 준비한 프로젝트 로컬 음원이나 명시적 전체 믹스 스냅샷을 사용한다.

1. 개발 서버. `vite.config.ts`의 `scoreOnDemand` 미들웨어가 `/audio/generated/<slug>/<file>` 요청에 파일이 없으면 사양을 찾아 생성기를 동기로 돌린다. 서버 로그에 `[score] <slug>: ...`가 남는다.
2. 렌더. `npm run render`가 Vite를 띄우기 전에 진입 파일 폴더의 `audio.json`을 생성한다. 기본 진입은 `examples/samples/index.tsx`이고 그 폴더에는 `audio.json`이 없으므로 아무것도 생성하지 않는다(`scripts/render.mjs`). 사양은 `examples/samples/<slug>/audio.json`에만 둔다.
3. 직접 실행.

```sh
npm run score -- examples/samples/<slug>/audio.json
npm run score -- --force examples/samples/<slug>/audio.json
npm run score
```

인자가 없으면 모든 사양을 처리한다. 생성기는 사양 원문과 `GENERATION` 상수의 해시를 `.spec.sha256`에 적고, 해시가 같고 파일이 모두 있으면 건너뛴다. 생성기 코드만 고쳤다면 `--force`로 다시 만든다. 필요한 것은 Python 3, numpy, PATH의 ffmpeg다.

### 한계와 교체 경로

음악은 numpy로 합성한다. 슈퍼소, PWM, 상태변수 필터를 거친 감산 합성, FM, 카플러스-스트롱 플럭, 합성 드럼과 리버브·딜레이·마스터 체인으로 만든다(`docs/audio-score.md`). 녹음한 악기나 작곡가를 대신하지는 못한다. 샘플 열 편 제작 중 아무도 소리를 듣지 않았다(`docs/samples/README.md`). 방송용 완성 음악으로 보지 않는다.

교체 경로는 둘이다.

1. 라이선스를 확보한 곡. `docs/audio-score.md`가 정한 방법은 작품의 `<Audio src>`를 그 파일로 바꾸고 사양을 지우는 것이다. `public/audio/generated/<slug>/music.wav`에 같은 이름으로 덮어쓰는 방법은 쓰지 않는다. 그 폴더는 커밋되지 않고, `--force`, 사양 수정, `GENERATION` 변경이 있으면 합성본으로 다시 덮인다. 옛 문서의 "같은 파일 이름으로 넣는다"는 이 구조 전의 이야기다.
2. 음악 생성 서비스. 사양의 `sections`와 `hits`를 그대로 넘겨 같은 구간표로 만든다. 결과는 1번처럼 연결한다.

어느 쪽이든 넣은 뒤 최종 MP4의 통합 음량과 트루 피크를 다시 잰다. 라이선스와 출처를 그 작품의 `assets.md`에 적는다.

## 2. 시각 에셋과 아이콘

주인공, 캐릭터와 아이콘은 장면의 목적과 권리에 맞춰 직접 그린 벡터, 허가된 래스터·3D·키트 또는 에셋 해결기 중 고른다. 하나의 형식이나 획 수가 완성도를 보장하지 않는다.

1. **모티프 키트(선택).** `import {Cup, Phone, Pin} from '@/assets'`. `src/assets/`의 46종은 모두 400 viewBox, 8px 그리드, 정면 시점이고 `{size, ink, accent, soft, paper, stroke, radius, draw, parts, style}`를 받는다. 목록과 의도 매칭용 태그는 `src/assets/catalog.ts`의 `CATALOG`, 시트는 `src/assets/Sheet.tsx`의 `AssetSheet`(한 쪽 24개).
2. **에셋 해결기(선택).** 작품 폴더의 `assets.json`(`{slug, palette: {ink, accent, soft, paper}, assets: [{name, intent, source, recolor, file}]}`)을 `npm run art -- examples/samples/<slug>/assets.json`(`scripts/assets/art.py`)이 해결한다. `source`가 `auto`(기본)면 이 순서로 시도하고, 값을 주면 그 소스만 쓴다.
   - `host`: 호스트 에이전트가 자기 이미지 도구로 만들어 `public/assets/generated/<slug>/<name>.svg|.png|.webp`에 둔 파일이나 항목의 `file`. SVG는 원본을 `<slug>/.host/`에 남기고 정리한다. PNG/WebP는 래스터 그대로 쓴다(색 바꾸기 없음).
   - `image-command`: 환경 변수 `FRAMEFORGE_IMAGE_COMMAND`(`{prompt}`와 선택 `{out}`이 든 셸 템플릿). 첫 PNG는 `{out}`이거나 명령이 출력한 JSON `paths`의 첫 항목이다. vtracer가 있으면 SVG로 추적하고, 없으면 PNG로 남긴다.
   - `library`: Openverse 이미지 검색의 CC0 SVG(키 없음, Wikimedia Commons 우선).
   - `kit`: `CATALOG`의 태그로 키트 컴포넌트를 고른다. 파일은 쓰지 않는다.
   SVG는 모두 스크립트, `foreignObject`, 외부 참조, 이벤트 속성을 지우고 viewBox를 붙인다. `recolor`가 참이면 밝기와 채도로 색을 팔레트 칸(ink, accent, soft, paper)에 옮긴다. 결과는 `public/assets/generated/<slug>/`(커밋하지 않음)와 선택을 해시로 고정한 매니페스트 `assets.json`, 표기가 필요한 출처가 있을 때 `CREDITS.md`다. 실패한 소스는 다음 소스로 넘어가고 매니페스트에 이유가 남는다. 개발 서버는 없는 SVG 요청에 그때 해결하고, `npm run render`는 진입 폴더에 `assets.json`이 있으면 렌더 전에 해결한다. 자동 해결은 외부 접근과 공용 생성 경로에 영향을 줄 수 있으므로 범위와 권한을 먼저 확인한다. 작품에서는 `<Art src="/assets/generated/<slug>/<name>.svg" size draw ink accent soft paper />`(가져오기 `frameforge`)로 그린다.
3. **직접 그리기.** 컨셉에 적합하면 다른 소스보다 먼저 선택해도 된다. `assets.tsx`의 벡터나 장면 코드, 허가된 래스터·3D를 사용할 수 있다. cafe-morning의 컵은 `pathLength={1}`과 `strokeDashoffset`을 쓰는 구현 예일 뿐 시각 스타일이나 복잡도의 기준이 아니다.

아이콘 라이브러리(`lucide-react`, ISC, 설치됨)는 작품의 시각 언어와 사용 권한에 맞을 때 사용할 수 있다. 아래 코드는 한 가지 구현 예다.

주 에셋은 실루엣, 형태·표정·포즈, 소재와 조명, 시점, 색 대비, 텍스트와의 가림을 장면의 원본 크기와 예상 전달 크기에서 평가한다. 모델을 에셋과 애니메이션에 고정 배정하지 않는다. 사용자가 고급 제작 모델을 요청했다면 허용된 실행 환경에서 기획·연출·구현·수정까지 가능한 모델을 사용하고 실제 설정이 확인되지 않으면 불명으로 보고한다.
- 실루엣은 의미를 구별하는 데 유용할 때 시험한다. 얼굴·보석·소재의 색과 조명처럼 실루엣만으로 알 수 없는 정보는 실제 장면에서도 관찰한다.
- 선 굵기·모서리·명암은 소재와 컨셉에 맞춰 설계한다. 400 viewBox나 8px 그리드는 키트의 설계 예이며 모든 에셋의 규칙은 아니다.
- 원근과 비례를 여러 포즈와 크기에서 살피고, 한 화면에 함께 놓이는 자산의 조명·스타일이 의도에 맞는지 확인한다.
- 같은 시점이나 디테일 밀도는 일관성에 도움이 될 수 있지만, 장면의 의도에 따라 시점과 재질이 달라도 된다.
- 등장·변형·표정은 사건과 음악의 역할에 맞춰 설계한다. SVG의 `draw`/`parts`는 선택 가능한 인터페이스이지 유일한 애니메이션 방법이 아니다.
- 저작권·상표·유료 도구의 사용 조건을 확인한다. 비트맵, 그라데이션, 흐림, 아이콘과 글자도 목적과 권리에 맞으면 쓸 수 있지만 효과나 자산을 추가한 사실만으로 완성도를 주장하지 않는다.
- 애니메이션 전에 대표 장면을 실제 소재·조명·타이포로 구성해 허용된 수단으로 원본과 전달 크기를 살핀다. 고칠 점을 기록하고 같은 구간의 저장 결과를 재검토한다. 캡처나 실제 재생이 불가하면 해당 판단을 미검증으로 보고한다.

예: 가상 게임 보상의 작은 평면 도형만 보이면 소재와 보상의 관계가 모호할 수 있다. 캐릭터의 포즈와 보상 형태·광원·조건을 장면에 함께 배치하고, 축소 프레임에서 표정과 조건이 실제로 읽히는지 비교한다. 이는 한 가지 수정 가설이며 효과나 세부를 늘리는 것 자체가 품질 증명은 아니다.

```tsx
import {Check} from 'lucide-react';
<Check size={96} strokeWidth={2.5} color={ink} />
```

| 항목 | 예시와 확인점 |
| --- | --- |
| 크기 | 1080px의 65px은 샘플 예다. 실제 전달 크기에서 구별되는지 확인한다 |
| 선 굵기 | 샘플은 2.4–2.5를 썼다. 그림의 스타일과 크기에 맞춰 조절한다 |
| 색 | 배경과의 대비와 작품의 색 체계를 확인한다 |
| 안의 글자 | 필요하면 넣고 전달 크기에서 읽히는지 확인한다 |
| 쓰는 곳 | 목적과 라이선스에 맞게 선택한다 |

장면의 주인공은 사용 권한과 표현 목적에 맞게 직접 만들거나 적절한 에셋을 쓸 수 있다. 변형이 필요하면 가능한 레이어나 리깅 구조를 선택한다.

**그려지는 등장.** `strokeDasharray`와 `strokeDashoffset`을 프레임 함수로 돌린다. lucide 컴포넌트는 이 속성을 SVG로 넘긴다.

```tsx
<Icon size={88} strokeWidth={2.5} color={ink} strokeDasharray={220} strokeDashoffset={220 * (1 - draw)} />
```

220은 24단위 viewBox 안의 가장 긴 경로보다 긴 값이다(추정. 아이콘마다 경로 길이가 다르므로 새 아이콘은 키프레임으로 확인한다). 다른 방법은 `pop`으로 스케일을 키우는 것이다.

**라이선스.** 사용한 세트·자료의 출처와 해당 배포 범위의 라이선스를 `prompt.md`에 기록한다. 실제 브랜드와 유료 자료는 권리 및 비용 승인을 확인한다.

| 세트 | 라이선스 | 허용 |
| --- | --- | --- |
| Lucide | ISC | 예. 기본, 설치되어 있음 |
| Heroicons | MIT | 예 |
| Phosphor | MIT | 예 |
| Tabler | MIT | 예 |
| Material Symbols | Apache-2.0 | 예 |
| 유료 세트 | 상용 | 사용 권한 및 별도 비용 승인 확인 |
| 실제 브랜드 로고 아이콘 | 상표 | 사용 권한 및 맥락 확인 |

## 3. 글꼴

**런타임 로드.** `googleFont('Family', {weights: [...]})`가 Google Fonts CSS2 주소를 만들어 `<link>`를 붙이고, 각 굵기를 `Ag가` 샘플로 미리 불러온다(`src/core/fonts.ts`). 반환값은 `"Family", fallback` 형태의 font-family 문자열이다. 렌더러는 글꼴 로드가 끝난 뒤 프레임을 캡처한다. 스타일시트 로드가 실패하면 조용히 넘어가고 대체 글꼴로 그린다.

```tsx
const display = googleFont('Do Hyeon', {weights: [400], fallback: 'sans-serif'});
const ui = googleFont('Noto Sans KR', {weights: [500], fallback: 'sans-serif'});
```

**한글 포함 여부 확인.** 한글 문자열을 그 글꼴로 쓰기 전에 확인한다. Google Fonts CSS에 한글 음절 영역(U+AC00–D7A3)의 `unicode-range`가 있으면 한글이 있다. 외부 접근이 허용된 경우에만 아래 명령으로 확인한다. 이 명령은 2026-10-20에 실행했고 Noto Sans KR, Gothic A1, Black Han Sans, Do Hyeon, Gowun Batang, Nanum Myeongjo, IBM Plex Sans KR는 51, Jua는 50, Manrope와 DM Sans는 0을 냈다. 0이면 한글이 없다. 브라우저 User-Agent를 주지 않으면 Google이 다른 형식의 CSS를 돌려줄 수 있다.

```sh
curl -s -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Manrope" | grep -ci "U+ac\|U+d5\|U+b[0-9a-f]"
```

라틴 전용 디스플레이 글꼴(Anton, Bebas Neue)은 영문과 숫자에만 쓰고 한글은 UI 가족에 맡긴다. 한 단어 안에서 두 가족이 섞이면 안 된다. 초안의 "30시간"은 "30"과 "시간"이 다른 서체로 그려졌다.

**글꼴별 마스크 여유.** 글꼴마다 잉크가 줄 상자를 넘는 정도가 다르다. 새 글꼴을 쓰면 Gothic A1 값(위 0.1em, 좌우 0.06em)에서 시작한다. 가드가 잘림을 보고하면 그쪽 여유를 늘리고 같은 크기의 음수 margin으로 위치를 되돌린다. 샘플에서 읽은 값은 `docs/guides/motion-graphics.md` 6절의 표에 있다. 명조(Gowun Batang)는 위 0.16em, 아래 0.26em까지 필요했다.

**재현성 위험.** 글꼴 파일은 저장소에 없고 렌더마다 `fonts.googleapis.com`에서 받는다. 위험은 두 가지다.

1. 오프라인이거나 Google Fonts가 막히면 대체 글꼴로 렌더된다. 글자 폭이 바뀌어 배치와 마스크가 어긋나고, 가드 결과도 달라진다.
2. Google이 파일을 갱신하면 같은 코드로도 결과가 바뀔 수 있다.

**오프라인 대비책.** `googleFont`에 자동 대비책은 없다. 재현성이 중요한 최종 렌더 전에는 쓰는 굵기의 파일을 `public/fonts/<family>/`에 넣고 `loadFont({family, url, weight})`(가져오기 `frameforge`, 로드가 끝날 때까지 렌더를 붙잡음)나 `@font-face`로 직접 연결하는 것을 권한다. 라이선스 파일도 같이 둔다. 선례는 `public/fonts/line-seed/`(SIL OFL 1.1, `NOTICE.txt`)다. 이 방법은 이 저장소의 스팟에서 아직 시험하지 않았다. Google Fonts의 한글 가족은 대부분 SIL OFL 1.1이라 광고 영상에 쓸 수 있다. 가족마다 Google Fonts 페이지에서 라이선스를 확인하고 `assets.md`에 적는다.

## 4. 제품 화면 캡처

실제 제품을 보여 줄 때는 화면을 상상으로 다시 그리지 않는다. 사이트를 방문해 캡처하고 목록을 남긴다. 화면에 없는 숫자, 버튼, 문장은 만들지 않는다.

**캡처 방법.** 캡처는 사용자가 직접 찍어 준비한다. 저장소에는 캡처 스크립트가 없다. 아래 다섯 단계를 하는 Playwright나 CDP 스크립트를 쓴다. 세부는 `docs/guides/product-explainer.md` 2절에 있다.

1. 임시 프로필로 headless Chrome을 띄운다. 로그인하지 않은 상태다.
2. CDP `Emulation.setDeviceMetricsOverride`로 영상 크기와 같은 1920×1080, 배율 1에 맞춘다. `--hide-scrollbars`, `--lang=ko-KR`을 준다.
3. 페이지를 열고 기다린 뒤 동의 팝업과 대화상자를 DOM에서 지운다.
4. `Page.captureScreenshot`으로 PNG를 저장한다.
5. 같은 페이지에서 `getBoundingClientRect()`로 콜아웃할 요소의 x, y, 폭, 높이를 재어 `rects.json`에 저장한다.

이미지를 영상 크기와 같은 픽셀로 찍으면 화면 좌표가 그대로 컴포지션 좌표가 된다. 이 좌표로 콜아웃 사각형과 카메라 중심을 정한다. 요소가 그려지지 않았으면 0이 나온다. 그때는 이미지에서 다시 잰 값을 쓴다. 측정값은 키프레임 위에 사각형을 그려 6px 안으로 맞는지 확인한다.

**개인정보.** 아래 규칙은 캡처 스크립트가 자동으로 하는 일이 아니다. 찍는 사람이 지킨다.

- 로그인한 상태로 찍지 않는다. 개인 피드, 추천, 기록이 들어간다.
- 다른 사람의 아바타와 이름이 크게 보이면 가린다.
- 댓글 목록은 쓰지 않는다.
- 캡처 날짜, 주소, 수정하지 않은 원본이라는 사실을 `prompt.md`에 적는다.

**상표.** 실제 제품 화면과 로고는 그 회사의 상표다. 설명 영상에서 식별 목적으로만 보여 주고 그 사실을 적는다. `prompt.md`에 "<제품> and its logo are trademarks of <소유자>, shown for identification in an explainer" 같은 문장을 적는다. 상표를 그대로 보여 주는 것과 로고를 베끼거나 흉내 내는 것은 다르다. 후자는 금지다.

**파일 위치.** 작품에 쓰는 캡처는 `public/` 아래 원하는 폴더에 둔다. 예를 들어 `public/<capture-dir>/<product>/<page>.png`다. 그 폴더를 `.gitignore`에 추가한다. 실제 사이트 화면은 다시 배포할 권리가 없을 수 있기 때문이다. 캡처 스크립트와 측정값은 `.scratch/<product>/`에 둔다. 코드에서는 원래 크기 그대로 불러와 감싼 상자를 변환한다.

```tsx
<Img src={staticFile('/<capture-dir>/<product>/<page>.png')} style={{width: 1920, height: 1080}} />
```

## 5. 색

**팔레트.** 컨셉과 소재에 맞게 색을 고르고 강조·정보·배경의 대비를 전달 크기에서 확인한다. 3–4색은 단순한 그래픽에 쓰는 한 방법이지 작품 전체의 필수 제한이 아니다.

**평면색과 그라데이션.** 소재와 조명에 맞게 선택한다. 그라데이션·질감의 띠나 압축 손실은 해당 저장 영상에서 확인하며, 기법의 사용만으로 완성도를 판단하지 않는다.

**bt709 파이프라인.** 프레임 PNG는 sRGB다. `scripts/render.mjs`는 bt709 행렬과 TV 범위로 변환하고, 색 태그(primaries, transfer, matrix, range)를 붙여 인코딩한다.

```text
scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv
```

태그가 없으면 1080p 플레이어가 색 공간을 추측해 색이 틀어진다. 다른 인코더로 다시 내보낼 때도 bt709 태그를 유지한다.

**복호 검증.** 렌더한 MP4를 다시 디코드해 팔레트 색을 잰다. 아래는 실제 브랜드를 써서 저장소에서 뺀 첫 작품의 측정값이다. 영상은 없지만 태그의 효과는 그대로다.

| 색 | 목표 | 태그 있음 | 태그 없음 |
| --- | --- | --- | --- |
| 초록 `#06C755` | [6,199,85] | [4,198,82] | [0,172,81] |
| 종이 `#f4f4f1` | [244,244,241] | [242,242,239] | 기록 없음 |
| 검정 `#111111` | [17,17,17] | [16,16,16] | 기록 없음 |

태그가 있으면 각 채널이 3 이내로 맞는다. 태그가 없으면 초록의 G가 27 낮아진다. 새 팔레트의 강조색은 같은 방식으로 한 번 잰다.

## 6. 작품별 에셋 명세 양식

샘플은 `prompt.md`에 에셋 명세를 짧게 적는다. 샘플보다 긴 작품은 작품 폴더에 `assets.md`를 따로 두고 아래 양식을 쓴다. 저장소에는 아직 그렇게 따로 둔 예가 없다.

```markdown
# <작품> 에셋 목록

이 문서는 `<코드 경로>`가 쓰는 모든 에셋의 출처, 라이선스, 재생성 방법을 적는다.
신 구성은 `shots.md`, 브리프는 `prompt.md`에 있다.

## 오디오

사양 `<사양 경로>`, slug `<slug>`. 생성 `npm run score -- <사양 경로>`.

| 파일 | 길이 | 쓰는 프레임 | 볼륨 |
| --- | --- | --- | --- |
| `/audio/generated/<slug>/music.wav` | <초> | 0부터 | 0.9 |
| `/audio/generated/<slug>/<name>.wav` | <초> | <프레임 목록> | 0.8 |

구간표(장면 경계 = 사양 sections), 타격(초와 프레임), 최종 MP4의 통합 음량, LRA, 트루 피크.
교체한 음원이 있으면 곡명, 권리자, 라이선스, 계약 범위.

## 아이콘

| 아이콘 | 세트 | 라이선스 | 크기 | 쓰는 곳 |

## 글꼴

| 가족 | 굵기 | 출처 | 라이선스 | 한글 확인 날짜 | 마스크 여유 |

로드 방식(Google Fonts 런타임 또는 `public/fonts/` 고정)과 재현성 위험.

## 화면 캡처

| 파일 | 원본 주소 | 캡처 날짜 | 크기 | 로그인 여부 | 가린 것 |

상표 표기 문장.

## 색

| 이름 | 값 | 쓰임 | 복호 측정값 |
```

비어 있는 절도 지우지 않고 "없음"이라고 적는다. 리뷰어가 빠뜨린 것과 없는 것을 구분할 수 있다.
