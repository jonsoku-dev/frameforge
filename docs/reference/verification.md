# 검증 기록과 호환 조사

README에서 옮긴 검증 기록입니다. 각 절의 날짜에 측정한 값이며 지금 다시 잰 값이 아닙니다. 기계가 읽는 요약은 저장소 루트의 `verification.json`입니다.

## 현재 상태

현재는 **부분 호환 프로토타입**입니다. 기존 프로젝트 전체의 무수정 실행, 기준 엔진의 전체 기능, 픽셀 단위 출력 일치가 검증된 것은 아닙니다. 사용자 기존 프로젝트 대신 공개 커뮤니티 예제 6개를 추가했습니다. 출처와 라이선스는 `examples/community/source.json` 및 해당 폴더의 `LICENSE`에 보존했습니다.

## 검증 결과 (2026-10-20)

이 절과 아래 절에 나오는 20초 TV 스팟과 기본 미리보기 작품은 실제 브랜드를 써서 공개판에서 빠졌습니다. 당시 측정 기록으로만 남깁니다.

- TypeScript strict 검사와 Vite 프로덕션 빌드 통과. `npm test` 138건 통과(그중 `tests/core.test.tsx` 32건).
- 기준 엔진 4.0.537 실행값 1554건(interpolate와 그 `posterize`·구간별 `easing`, Easing, random, spring 옵션 조합, overshootClamping 격자, measureSpring, interpolateColors 413건, 두 검증 함수 12건, `Easing.circle`/`bounce` 입력 고정 20건) 전부 `1e-6` 이내 일치. 오류를 기록한 39건은 같은 입력에서 오류를 내는지 확인합니다. 회귀 0.
- Sequence `playbackRate`/`trimBefore`/`freeze` 동작은 기준 엔진 저장소의 공개 테스트가 기대하는 값으로 검증했습니다(중첩 배속, 소수 프레임 4.5, 잘못된 배속 값 거부). `premountFor`/`postmountFor`는 기준 엔진과 달리 미리 올린 자식을 숨겨 두지 않고 아무것도 그리지 않습니다. 부작용이 있는 컴포넌트는 마운트 시점이 달라질 수 있습니다.
- 브라우저(렌더 모드): Opening과 커뮤니티 예제 6개 모두 30프레임 렌더에 성공, pageerror 없음. 픽셀 비교는 하지 않았습니다.
- 라이선스 검토와 참조 범위: `docs/legal/`. 기준 엔진 구현 코드는 복사하지 않았고, 제품 의존성에도 넣지 않았습니다.
- 작품: 실제 브랜드 20초 TV 스팟(작품 파일과 기획 문서 모두 공개판에서 제외)과 `examples/Opening.tsx`(15초)를 CLI로 전체 렌더했습니다. 글자 잘림 검사가 두 작품의 전 프레임을 통과했습니다.
- 소리: 오디오 파일은 커밋하지 않는다. 작품마다 구조를 적은 사양(그 스팟의 사양 파일(공개판에서 제외), `examples/samples/<slug>/audio.json`)에서 `scripts/assets/score.py`가 음악과 효과음을 `public/audio/generated/<slug>/`에 합성하고, 스튜디오 첫 요청과 `npm run render` 직전에 자동으로 만든다. 형식과 음량 정책은 `docs/audio-score.md`, 스팟의 측정값 문서는 공개판에서 제외.
- 가드 보강: 글자 잘림 검사가 이동 중인 글자도 정지 위치 기준으로 검사한다. `Sequence`의 `playbackRate`가 프레임 사이에 바뀌면 스튜디오에서 오류를 낸다(렌더 모드는 프레임마다 다시 마운트하므로 잡지 못함).
- 글자 잘림 원인과 수정: Gothic A1 900의 한글 잉크는 기준선 위 0.87em까지 올라가지만 글꼴 ascent는 0.80em이라, `line-height: 1` 한 줄 마스크가 윗부분 7%를 잘랐습니다. 두 작품의 글리프 마스크를 위로 0.1em, 좌우로 0.06em 넓혔고(글자 위치는 그대로), 같은 결함이 다시 들어오면 렌더가 실패하도록 검사를 넣었습니다.

## 검증 결과 (2026-10-13)

- TypeScript strict 검사와 Vite 프로덕션 빌드 통과.
- 코어 테스트 10개 통과: 중첩/음수 시작/구간 경계, Series offset, Loop/Freeze, 메타데이터, 보간 및 예외 처리.
- 실제 기준 엔진 **4.0.535** npm 패키지의 수학 API를 Node에서 실행한 82개 비교 중 80개가 절대 오차 `1e-6` 이내 일치. 나머지 2개는 난수열 차이. 전 제품 호환율로 해석하면 안 됩니다.
- 브라우저: 재생/정지, seek/reset, 장면 전환, 입력값 적용, 잘못된 JSON, 390px 모바일에서 가로 넘침 없음. 기본 흐름의 관측된 pageerror 없음.
- 별도 테스트 장면: 입력값으로 duration=6 설정, frame 1의 의도적 오류를 연속 2회 거부, 정상 frame 2로 이동하면 복구 확인. 진입 모듈의 최상위 getInputProps()에도 초기 width=400이 전달되는 것을 확인. 이 장면의 의도적 오류는 정상 실패 테스트입니다.
- Chrome user agent가 보고한 버전은 155.0.0.0. Stagehand의 기존 격리 세션 사용, 네트워크/CPU throttling 없음. warm/cold 렌더 성능 비교는 수행하지 않았습니다.

```sh
npm test
npm run build
npm run benchmark
```

`npm run benchmark`는 `compatibility-benchmark.json`에 기록한 원본 관측값을 재생합니다. 원본 기준 엔진을 설치하거나 실행하지 않습니다. 원본의 실제 실행 비교와 fixture 재생 검증은 별개의 증거입니다.

## REA 벤치마킹 상태

기준 엔진의 공식 배포물(코어 패키지와 렌더러 패키지, 4.0.535)을 분석 입력으로 확보했습니다. SHA-256:

- 코어 tarball: `57584368d713de3844913ac75de8b759fcf054c1e77decd51e2a1c687b2b9116`
- renderer tarball: `398cb7cce9560a0429b0182e91f8ed7effd36caa567803b30d34179e9c12526b`

REA `analyze_javascript_application`은 macOS의 SwiftBridging 중복 모듈 정의 때문에 프로세스 소유권 확인 helper를 컴파일하지 못했습니다. 466개 관련 파일을 인벤토리했지만 **파싱된 JavaScript는 0개**입니다. 내부 그래프/렌더러 경로 분석과 REA 기반 재구성 검증은 완료되지 않았습니다. 대체 Xcode 툴체인을 찾지 못했고 Docker daemon 조회도 타임아웃되었습니다. 시스템 파일이나 소유권 확인 기능은 변경하지 않았습니다.

보존된 REA 부분 Evidence: `ev_03182c56f18bd4e8123c269ce6c136dadf72c15b8a8a1cd9352706927cf6dcbb`. 이 기록은 실패 및 미확인 범위의 증거입니다. 현재 구현 근거는 공식 API 문서, 배포 메타데이터, 직접 호출한 공개 API의 반환값입니다.

## 사용권과 출처

이 폴더의 독립 작성 코드는 동봉한 MIT License로 제공합니다. 제3자 라이브러리와 Chrome/FFmpeg에는 각각의 사용권이 적용됩니다. 기준 엔진과 공식 제휴 관계가 없습니다. 독립 API 구현에 대한 포괄적인 법적 판단이나 무제한 권리 보증을 의미하지 않습니다.

확인한 기준 엔진 4.0.535 배포 라이선스는 개인, 직원 3명 이하 영리 조직, 비영리 조직 등 무료 자격을 명시하며, 원본 코드를 복사·수정한 파생물의 판매/재라이선스 등에 제한을 둡니다. 사내·로컬이라는 조건만으로 무료 자격이 결정되지 않습니다. 현재 웹 약관과 배포 버전별 라이선스는 구분해서 확인해야 합니다.

공식 약관·라이선스 문서의 출처와 판단 근거는 `docs/legal/`에 있습니다.

다음에 필요한 실제 근거는 정상화된 REA 툴체인에서의 분석과 사용자 기존 프로젝트로 실행하는 호환 테스트입니다. 동영상(`Video`/`OffthreadVideo`)은 [api.md](api.md)의 "미디어와 캔버스" 절에 구현되어 있습니다.

## 인터넷 예제 호환 조사

대상: `examples/community/source.json`에 적은 공개 저장소의 고정 커밋

Typewriter, FadeInFadeOut, BarChart, SpringPhysics, SlideTransition, StarrySky 6개 컴포넌트를 원본 그대로 가져왔고(이후 import 지정자를 이 프로젝트의 alias 이름으로 바꾸고 주석 한 줄에서 엔진 이름을 뺐다), 등록용 진입점만 따로 작성했습니다. 저장소 루트 LICENSE는 MIT이며 package.json에는 ISC라는 별도 메타데이터가 있으므로 그 차이도 출처 파일에 기록했습니다. 비교 대상의 원래 기준 엔진 버전은 4.0.273입니다.

```sh
VIDEO_ENTRY=examples/community/index.jsx npm run dev
```

6개 모두 선택한 프레임에서 실행되었습니다. 그중 결정적인 5개 예제의 15프레임을 실제 원본인 기준 엔진의 플레이어 4.0.273과 비교하자 수정 전에는 5개만 픽셀이 정확히 일치했습니다. 비교 중 Studio CSS가 영상 내부 h1에 적용되는 문제를 발견해 CSS 범위를 분리했습니다. 수정 후 내장 브라우저에서 h1의 fontSize=64px, lineHeight=normal, marginTop=42.88px 복구를 확인했습니다. Stagehand 연결이 끊겨 수정 후 전체 픽셀 재비교는 미완료입니다. `community-compatibility.json`의 수치는 **수정 전 관측값**입니다.

원본 예제 자체의 한계도 구분했습니다: FadeInFadeOut과 SlideTransition은 Sequence 안에서 시작 시점을 다시 빼며, StarrySky는 매 렌더에 Math.random()을 호출합니다. 원본 코드를 고쳐 호환 성공처럼 보이게 하지 않았습니다. 최신 공식 Hello World 템플릿의 문자열 보간은 현재 호환 범위 밖입니다. `Interactive`는 이제 있지만 시간·자르기 속성만 적용하고 스튜디오 직접 조작은 없습니다.
