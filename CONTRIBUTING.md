# 기여 안내

Frameforge에 기여해 주셔서 고맙습니다. 이 문서는 개발 환경, 확인 명령, 독립 구현 규칙, 샘플 작품을 만드는 순서, 커밋 방식, 문서 위치를 다룹니다.

## 개발 환경

필요한 프로그램은 [README의 요구 사항](README.md#요구-사항)과 같습니다. Node 24 이상, Chrome 또는 Chromium, FFmpeg와 ffprobe, Python 3와 numpy입니다.

```sh
git clone https://github.com/jonsoku-dev/frameforge.git
cd frameforge
npm ci
npm run dev        # 스튜디오 http://127.0.0.1:4317
```

경로별 설치와 확인은 [docs/install.md](docs/install.md)에 있습니다.

## 확인 명령

변경을 보내기 전에 아래를 모두 통과시킵니다.

| 명령 | 확인하는 것 |
| --- | --- |
| `npx tsc --noEmit` | TypeScript strict 타입 검사 |
| `npm test` | `tests/*.test.tsx` 전체(코어, 패키지 오라클 재생, 스튜디오, CLI, 도구) |
| `npm run benchmark` | `compatibility-benchmark.json`의 기준 실행값 재생. 차이가 있으면 종료 코드 1 |
| `npm run build` | 타입 검사와 Vite 프로덕션 빌드 |
| `npm run lint:video -- <entry.tsx>` | 작품의 결정성 린트. 바꾼 작품마다 돌립니다 |
| `claude plugin validate .` | 플러그인과 마켓플레이스 매니페스트(스킬이나 매니페스트를 바꿨을 때) |

`npm run lint`라는 스크립트는 없습니다. 코드 스타일 린터는 두지 않았고, 영상 결정성 린트만 있습니다.

Python 스크립트에는 자체 검사가 있습니다. `scripts/assets/`를 바꿨다면 돌립니다.

```sh
python3 scripts/assets/art.py --self-check
python3 scripts/assets/sfx.py
```

렌더러를 바꿨다면 짧은 구간을 실제로 렌더하고, 바꾸기 전 출력과 비교합니다.

```sh
npm run render -- examples/samples/kit-launch/entry.tsx KitLaunch renders/after.mp4 --frame-range 0-89
node scripts/snapshot-diff.mjs --against renders/before.mp4 renders/after.mp4
```

## 독립 구현 규칙

Frameforge는 Remotion과 제휴하지 않은 독립 구현입니다. 공개 라이선스(MIT)를 지키려면 기준 엔진 코드에서 나온 것이 저장소에 들어오면 안 됩니다. 판단 근거는 [docs/legal/remotion-license-review.md](docs/legal/remotion-license-review.md)와 [docs/legal/open-source-audit.md](docs/legal/open-source-audit.md)에 있습니다.

**참고해도 되는 것.**

- 공개 문서(remotion.dev의 API 문서와 가이드)
- npm 패키지에 들어 있는 공개 타입 선언 파일(`.d.ts`)
- npm 패키지를 블랙박스로 실행해 얻은 입력과 출력
- 기준 저장소 공개 테스트가 기대하는 값(테스트가 무엇을 기대하는지만, 구현은 아님)

**하면 안 되는 것.**

- 기준 엔진의 구현 파일(`.ts`, `.tsx`, `.js` 소스와 번들된 `dist/` 코드)을 열어 읽거나, 옮기거나, 줄 단위로 따라 쓰기
- compositor 바이너리, FFmpeg 동적 라이브러리, Lambda 산출물을 디컴파일하거나 역공학하기
- `remotion`이나 `@remotion/*`를 `package.json`에 넣기
- 기준 엔진이 렌더한 마크업 문자열을 저장소에 그대로 커밋하기. 비교에 필요한 구조와 숫자만 요약해 둡니다(`tests/oracle-digest.ts`).

구현이 막히면 문서와 `.d.ts`로 동작을 정하고, 모르는 부분은 블랙박스 실행으로 관찰합니다. 관찰도 안 되면 그 기능은 지원하지 않는다는 오류를 내고 문서에 적습니다.

### 오라클 다시 만들기

오라클은 기준 패키지를 실행해 기록한 입력·출력 쌍입니다. 테스트는 저장소의 구현으로 같은 입력을 실행해 기록과 비교합니다.

1. 저장소 **밖**의 빈 폴더를 만듭니다. 기준 패키지는 그 폴더에만 설치합니다.

   ```sh
   mkdir -p ~/oracle-scratch && cd ~/oracle-scratch
   npm init -y
   npm install remotion@4.0.537
   ```

   필요한 패키지(`@remotion/paths` 등)도 같은 버전으로 설치합니다. tarball을 고정하려면 `npm pack remotion@4.0.537`의 sha256을 `compatibility-benchmark.json`의 `reference.sha256`과 비교합니다.

2. 생성 스크립트를 그 폴더에 씁니다. 스크립트는 공개 export만 불러와 입력마다 호출하고, 반환값이나 던진 오류 메시지를 기록합니다. 패키지 내부 경로를 import하지 않습니다.

3. 결과를 `compatibility/<이름>.json`(수학 API는 `compatibility-benchmark.json`)에 씁니다. 파일 머리에 `source`(패키지와 버전), `generator`(스크립트 이름), `method`(무엇을 어떻게 비교하는지)를 둡니다. 마크업은 숫자와 구조 요약으로 줄입니다.

4. 저장소로 돌아와 재생합니다.

   ```sh
   npm test
   npm run benchmark
   ```

5. 생성 스크립트와 scratch 폴더는 커밋하지 않습니다.

기준 엔진 라이선스는 개인과 직원 3명 이하 조직 등에 무료 사용을 허용합니다. 오라클을 다시 만드는 사람이 그 자격에 해당하는지 스스로 확인합니다. 저장소의 기존 오라클을 재생하는 데는 기준 패키지가 필요 없습니다.

## 샘플 작품 만들기

샘플은 엔진 기능을 보여 주고 회귀를 잡는 작품입니다. 규칙은 [docs/samples/rules.md](docs/samples/rules.md)입니다. 실제 회사, 제품, 로고, 수치는 쓰지 않습니다. 브랜드는 가상이어야 합니다.

1. 템플릿을 복사합니다.

   ```sh
   cp -R examples/samples/_template examples/samples/<slug>
   mv examples/samples/<slug>/template.audio.json examples/samples/<slug>/audio.json
   ```

   `audio.json`의 `"slug"`, `Spot.tsx`의 컴포넌트 이름, `entry.tsx`의 컴포지션 id를 slug에 맞게 바꿉니다. 바꿀 목록은 템플릿의 `prompt.md`에 있습니다.

2. `prompt.md`에 기획을 먼저 씁니다. 목적 한 문장, 색 넷, 글꼴 둘, 절대 프레임 장면표, 소리, 검사 프레임입니다.
3. 에셋은 모티프 키트(`import {Cup} from '@/assets'`)나 `assets.json` + `npm run art -- examples/samples/<slug>/assets.json`으로 채웁니다.
4. `Spot.tsx`를 프레임 함수로 쓰고, `examples/samples/index.tsx`에 import 한 줄과 `<Composition>` 한 줄을 더합니다.
5. 소리를 만듭니다. `npm run score -- examples/samples/<slug>/audio.json`
6. 검사합니다.

   ```sh
   npm run lint:video -- examples/samples/<slug>/entry.tsx
   npm run render -- examples/samples/<slug>/entry.tsx <Id> renders/samples/<slug>.mp4
   npm run frame-check -- renders/samples/<slug>.mp4
   node scripts/flash-check.mjs renders/samples/<slug>.mp4
   ```

7. 과정을 기록합니다. `node scripts/process.mjs append examples/samples/<slug> '<json>'`. 규약은 [docs/studio/process-log.md](docs/studio/process-log.md)입니다.

렌더 결과(`renders/`)와 생성된 소리·그림(`public/audio/generated/`, `public/assets/generated/`)은 커밋하지 않습니다.

## 커밋 방식

아래는 제안하는 규칙입니다. 저장소에 강제하는 도구는 없습니다.

- 제목은 [Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/) 형식으로 씁니다. 예: `feat(render): add --pipe encoding`, `fix(studio): reject non-loopback Host`, `docs: add uninstall guide`.
- 범위(scope)는 `core`, `packages`, `render`, `studio`, `audio`, `assets`, `cli`, `plugin`, `samples`, `docs` 중 하나를 씁니다.
- 한 커밋에는 한 가지 변경만 담고, 그 변경을 확인한 명령을 본문에 적습니다.
- 사용자에게 보이는 변경은 [CHANGELOG.md](CHANGELOG.md)의 다음 버전 절에 한 줄로 적습니다.

## 문서 위치

| 위치 | 내용 |
| --- | --- |
| `README.md` | 첫 화면. 소개, 빠른 시작, 요구 사항, 쓰는 방법 |
| `AGENTS.md`, `CLAUDE.md` | 에이전트 지침 |
| `docs/install.md`, `docs/uninstall.md`, `docs/manual.md`, `docs/agent-install.md` | 설치와 제거 |
| `docs/reference/` | API, 스튜디오, 렌더링, 검사, CLI, 검증 기록 |
| `docs/guides/` | 기획과 제작 가이드 |
| `docs/samples/` | 샘플 규칙과 결과 |
| `docs/studio/` | 스튜디오 설계서와 과정 기록 규약 |
| `docs/legal/` | 라이선스 검토와 공개 전 점검 |
| `docs/research/` | 조사 기록 |
| `skills/` | 에이전트 스킬. 사람용 문서와 내용이 겹치면 둘 다 고칩니다 |

전체 목록은 [docs/README.md](docs/README.md)에 있습니다. 새 문서를 더하면 그 목록에도 한 줄을 더합니다.
