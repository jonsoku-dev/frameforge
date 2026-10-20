# 과정 기록 남기기

컴포지션 폴더마다 `process.json`이 있다. 스튜디오 과정 탭은 이 파일을 읽어 누가 언제 무엇을 했는지 보여 준다. 계약 전체는 `spec.md` 3.2절이다.

## 쓰는 법

손으로 고치지 않는다. 쉼표 하나가 과정 탭 전체를 깨뜨린다. 모든 쓰기는 `scripts/process.mjs`를 거친다.

```sh
node scripts/process.mjs init <폴더>                # 없으면 만든다. 있으면 검사만 한다
node scripts/process.mjs append <폴더> '<실행 JSON>'  # 실행 하나를 덧붙인다
node scripts/process.mjs validate <폴더>            # 파일을 검사한다
```

`<폴더>` 대신 `.json`으로 끝나는 경로를 주면 그 파일을 쓴다. 예 `examples/<slug>.process.json`.

`append`가 하는 일은 다음과 같다.

- `process.json.lock`으로 잠근다. 잠금이 있으면 50 ms 간격으로 2초까지 기다린다. 10초보다 오래된 잠금은 지운다.
- `id`를 `r01`, `r02` 순으로 붙인다. `at`이 없으면 지금 시각을 넣는다. `findings`의 `id`가 없으면 `<실행 id>-1`부터 붙인다.
- 실행을 검사한다. 틀리면 아무것도 쓰지 않고 이유를 출력하며 1로 끝난다.
- 같은 폴더의 임시 파일에 쓰고 이름을 바꿔 교체한다.

이미 있는 실행은 고치지 않는다. 지적이나 요청이 해결됐다는 사실은 뒤에 오는 `fix`의 `resolves`로 남긴다.

서버는 같은 파일의 `append(폴더, 실행)`을 가져다 쓴다. `--kind`, `--actor` 같은 플래그 형식은 없다. 실행은 JSON 한 덩어리로만 받는다.

## 실행의 모양

| 필드 | 필수 | 내용 |
| --- | --- | --- |
| `actor` | 예 | `claude opus`, `codex gpt-6-luna`, `human`, `script` 등 |
| `kind` | 예 | `author`, `review`, `fix`, `render`, `check`, `capture`, `request` |
| `summary` | 예 | 300자 이하 |
| `prompt` | | `{path?, text?}`. `path`는 프로젝트 루트 기준 |
| `artifacts` | | `{kind, path, frames?}`. `kind`는 `sheet`, `mp4`, `still`, `review`, `log` |
| `changes`, `resolves` | | `fix`에서. 사람이 읽는 문장, 해결한 지적이나 요청 id |
| `findings` | | `review`에서. `{from?, to?, text}`. 프레임 구간이 없는 지적은 `from`을 뺀다 |
| `metrics` | | `render`는 `seconds`, `frames`, `overrides`. `check`는 `of`(렌더 실행 id)와 검사별 결과 |
| `frame` | | `request`와 `capture`가 가리키는 프레임 |

종류별로 더 필요한 것이 있다. `render`는 `mp4`나 `sheet` 산출물, `check`는 `metrics.of`, `capture`는 `still` 산출물, `request`는 `prompt.text`가 있어야 한다. `frame`은 "프레임 없음" 요청(`spec.md` 4.4절)이 있어서 빼도 된다.

## 예

에이전트가 열린 요청 `r06`을 처리하고 시트를 찍은 뒤 남기는 기록이다.

```sh
node scripts/process.mjs append examples/samples/saas-launch '{
  "actor": "claude opus",
  "kind": "fix",
  "summary": "밑줄을 헤드라인과 같이 끝나게 당겼다.",
  "changes": ["밑줄 시작 706 → 690"],
  "resolves": ["r06"],
  "artifacts": [{"kind": "sheet", "path": "renders/studio/saas-launch/20261020-1500-v3.png", "frames": [668, 690, 706]}]
}'
```

## 2026-10-20 기록의 출처

샘플 `process.json`의 첫 기록은 그날의 파일에서 채웠다. 지금 저장소에는 14개 샘플 폴더에 `process.json`이 있다. 채운 스크립트도 같은 `append`를 불렀다.

시각은 모두 파일 수정 시각(mtime)이다. 실제로 일이 끝난 시각과 다를 수 있다.

| 실행 | `at`으로 쓴 파일 | 내용의 출처 |
| --- | --- | --- |
| author (Claude 10편) | `entry.tsx` | 브리프 `prompt.md`, 모델은 `docs/samples/README.md` |
| author (Codex 4편) | `.scratch/samples/<slug>.last.md` | `brief-<slug>.md` 원문, 모델은 `results.json`, 자체 검사 스틸 |
| review | `docs/samples/reviews/review-*.md` | 리뷰 문서의 지적 다섯 |
| fix | `Spot.tsx` | README의 "고친 것" |
| render | `renders/samples/<slug>.mp4` | 시트 프레임은 렌더 스크립트의 목록 |
| check | `renders/samples/<slug>-sheet.png` | `renders/samples/results.json` |

알아 둘 것.

- `Spot.tsx`의 mtime(13:47:22)은 열네 편이 같다. 수정 뒤 한꺼번에 다시 쓴 시각이라 fix가 끝난 실제 시각보다 늦다.
- 기록을 채울 당시 `results.json`은 13:42:11에 쓰였고 MP4는 14:09–14:19에 다시 렌더됐다. render와 check의 수치는 그 전 렌더의 것일 수 있다. `results.json`은 `renders/` 아래의 로컬 파일이라 저장소에 없다. 그 기계에서 렌더한 작품만 항목이 있다.
- Codex 4편은 리뷰와 수정 기록이 없다.
