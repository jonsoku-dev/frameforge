# Frameforge를 에이전트 플러그인으로 쓰기 (2026-10-20)

Frameforge는 저장소 자체가 포터블 에이전트 플러그인이다. 기준 엔진이 하는 방식(공식 문서 `docs/ai/claude-code-plugin`, `docs/ai/codex-plugin`, 모노레포 `packages/agent-plugin`·`claude-code-plugin`의 공개 매니페스트)을 그대로 따랐다: 루트 `plugin.json`(agent-plugins.org 스키마) + `skills/<이름>/SKILL.md` + 호스트별 오버레이(`.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`) + 마켓플레이스 파일(`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`). MCP는 두지 않는다(기준 엔진도 호스팅 MCP를 폐기하고 스킬로 대체했다: 토큰 비용, 설치 난이도, 에이전트가 잘 부르지 않음).

## 스킬

| 스킬 | 용도 |
| --- | --- |
| `frameforge-best-practices` | 전체 규칙과 참조 문서(assets, motion, sound, checks, hosts). 다른 스킬의 진입점 |
| `frameforge-create` | 새 작품: 브리프 → 에셋 → Spot → audio.json → 등록 |
| `frameforge-assets` | 모티프 키트, assets.json 해결(호스트 이미지 스킬 → 생성 → CC0 → 키트), 에셋 시트 |
| `frameforge-audio` | audio.json, 생성·측정, 움직임에서 나오는 효과음 |
| `frameforge-render` | 렌더 옵션(frame-range, concurrency, pipe, idempotent) |
| `frameforge-studio` | 스튜디오 띄우기·스틸 찍기 |
| `frameforge-check` | 검사 순서와 교차 리뷰 |
| `frameforge-blocks` | 블록 카탈로그(글자, 로어서드, 카드, 차트, 코드, 다이어그램)의 공통 계약과 고르는 법 |
| `frameforge-voice` | 나레이션 먼저: narration.json → voice.py → 측정된 시간으로 장면 → 자막 오버레이 → narration-check |
| `frameforge-3d` | 3d.json → 헤드리스 Blender PNG 시퀀스 → ImageSequence, Poly Haven CC0 모델, ThreeCanvas의 Model |
| `frameforge-generative` | 알고리즘 선언문 → 생성 배경 시스템 → 변수 노출, 색 보정·LUT·라이트 리크·그레인, 손그림 주석 |

약한 모델(haiku, gpt-*-luna, grok build-fast)은 키트와 템플릿 안에서만 움직이고, 강한 모델이 `assets.tsx`와 교차 리뷰를 맡는다. 호스트에 이미지·벡터 생성 도구가 있으면 `FRAMEFORGE_IMAGE_COMMAND`로 에셋 해결기에 연결한다.

## 설치

Claude Code (터미널):
```bash
claude plugin marketplace add jonsoku-dev/frameforge   # 또는 로컬 경로
claude plugin install frameforge@frameforge
```
개발 중에는 `claude --plugin-dir /path/to/frameforge`. 검증은 `claude plugin validate /path/to/frameforge`.

Codex (CLI·ChatGPT 데스크톱):
```bash
codex plugin marketplace add jonsoku-dev/frameforge   # 또는 로컬 경로
codex   # 세션에서 /plugins 로 설치, 새 세션에서 $frameforge-create
```
Codex는 저장소의 `.agents/skills`와 `$HOME/.agents/skills`에서도 스킬을 찾는다.

Cursor: `git clone https://github.com/jonsoku-dev/frameforge.git ~/.cursor/plugins/local/frameforge` 후 재시작(기준 엔진의 Cursor 안내와 같은 방식). Grok Build·스킬만 쓰는 호스트: `npm run skill:install`이 `~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`, `~/.grok/skills` 중 이미 있는 폴더에 스킬 11개를 심볼릭 링크한다(없는 폴더는 건너뛴다).

## 사용

새 세션에서 `/frameforge:frameforge-create 20초 제품 소개 모션그래픽`(Claude) 또는 `$frameforge-create ...`(Codex). 작품은 플러그인 저장소의 `examples/samples/<slug>/`에 만들어지고, 스튜디오는 `frameforge-studio`로 띄운다.

## 아직 아닌 것

- npm 배포: 엔진은 아직 npm 레지스트리에 올리지 않았다. 저장소 밖 프로젝트는 `bin/frameforge.mjs`(`frameforge init/new/studio/render/score/art/lint/check`)로 만들 수 있고, `npm link`로 PATH에 올린다(`docs/reference/cli.md`, 설치는 `docs/install.md`). `npx frameforge`처럼 설치 없이 부르는 길과 생성물을 프로젝트 쪽에 두는 일은 남았다.
- Codex 플러그인은 로컬 마켓플레이스로 검증했고, ChatGPT 디렉터리 등록은 하지 않았다.
