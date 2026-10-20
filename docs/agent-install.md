# 에이전트에게 맡기는 설치와 제작

Claude Code, Codex, Cursor, Grok Build 같은 코딩 에이전트에게 아래 프롬프트를 그대로 붙여 넣습니다. `<REPO_URL>`만 바꿉니다. 공개 저장소는 `https://github.com/jonsoku-dev/frameforge`입니다.

모든 프롬프트는 에이전트가 저장소 루트의 [AGENTS.md](../AGENTS.md)를 먼저 읽게 합니다. 실제 단계와 실패 대처는 AGENTS.md에 있으므로 프롬프트에는 목표만 적었습니다.

| 프롬프트 | 결과 |
| --- | --- |
| 설치하고 실행하기 | 클론, 의존성, 테스트, 첫 렌더, 스튜디오 URL |
| 이 에이전트에 플러그인으로 설치하기 | 지금 쓰는 호스트에 플러그인이나 스킬 설치 |
| 이 브리프로 첫 작품 만들기 | `examples/samples/<slug>/` 작품, 렌더, 검사 결과 |
| 모두 지우기 | [uninstall.md](uninstall.md) 순서대로 제거하고 확인 |

## 한국어

### 설치하고 실행하기

```text
<REPO_URL> 저장소를 클론하고, 저장소 루트의 AGENTS.md를 먼저 끝까지 읽어. 그다음 AGENTS.md의 "클론부터 첫 렌더와 스튜디오까지" 1~6단계를 순서대로 실행해. 각 단계의 성공 조건을 확인하고, 실패하면 AGENTS.md의 "실패했을 때" 표대로 고쳐서 다시 해. 끝나면 렌더한 MP4 경로, ffprobe 결과, 스튜디오 URL, 실행하지 못한 단계와 이유를 알려 줘.
```

### 이 에이전트에 플러그인으로 설치하기

```text
<REPO_URL> 저장소의 AGENTS.md를 먼저 읽어(클론이 없으면 클론하고 npm install까지 해). 그다음 AGENTS.md 7단계에서 지금 네가 실행 중인 호스트에 맞는 방법 하나로 Frameforge 플러그인이나 스킬을 설치해. 설치 확인 명령의 출력을 보여 주고, 새 세션에서 어떤 명령으로 스킬을 부르는지 알려 줘.
```

### 이 브리프로 첫 작품 만들기

```text
<REPO_URL> 저장소의 AGENTS.md를 먼저 읽고, 설치가 안 되어 있으면 AGENTS.md 1~3단계를 먼저 해. 그다음 skills/frameforge-create/SKILL.md를 따라 아래 브리프로 새 작품을 examples/samples/<slug>/에 만들어. 렌더하고 skills/frameforge-check/SKILL.md의 검사를 돌린 뒤, 결과 MP4 경로와 각 검사의 통과 여부와 수치를 알려 줘.

브리프:
<여기에 브리프를 적는다. 예: 20초, 1920×1080, 가상의 커피 구독 서비스 소개, 따뜻한 색, 마지막에 로고>
```

### 모두 지우기

```text
<REPO_URL> 저장소의 AGENTS.md와 docs/uninstall.md를 먼저 읽어. docs/uninstall.md의 순서대로 이 컴퓨터에서 Frameforge가 남긴 것을 모두 지워. 지우기 전에 지울 목록을 보여 주고, frameforge init으로 만든 프로젝트 폴더처럼 내 작품이 든 폴더는 지우기 전에 나에게 확인받아. 각 단계의 확인 명령 출력과 남은 것을 알려 줘.
```

## English

### Install and run

```text
Clone <REPO_URL> and read AGENTS.md at the repository root in full before doing anything else. Then run steps 1 to 6 of "클론부터 첫 렌더와 스튜디오까지" in AGENTS.md in order. Check each step's success condition. If a step fails, fix it as the "실패했을 때" table in AGENTS.md says and retry. When you finish, report the rendered MP4 path, the ffprobe output, the studio URL, and any step you could not run and why.
```

### Install as a plugin in this agent

```text
Read AGENTS.md in the <REPO_URL> repository first (clone it and run npm install if there is no local clone). Then install the Frameforge plugin or skills with the one method in step 7 of AGENTS.md that matches the host you are running in. Show the output of the verification command, and tell me which command calls the skill in a new session.
```

### Make my first film from this brief

```text
Read AGENTS.md in the <REPO_URL> repository first. If Frameforge is not installed yet, run steps 1 to 3 of AGENTS.md. Then follow skills/frameforge-create/SKILL.md to make a new film in examples/samples/<slug>/ from the brief below. Render it, run the checks in skills/frameforge-check/SKILL.md, and report the MP4 path and each check's result with its numbers.

Brief:
<write the brief here, for example: 20 s, 1920x1080, an intro for a fictional coffee subscription, warm colours, logo at the end>
```

### Uninstall everything

```text
Read AGENTS.md and docs/uninstall.md in the <REPO_URL> repository first. Remove everything Frameforge left on this computer, in the order docs/uninstall.md gives. Show me the list before you delete anything, and ask me before you delete a folder that holds my films, such as a project made with frameforge init. Report the output of each step's verification command and anything left behind.
```

## 日本語

### インストールして実行する

```text
<REPO_URL> をクローンし、作業を始める前にリポジトリ直下の AGENTS.md を最後まで読んでください。次に AGENTS.md の「클론부터 첫 렌더와 스튜디오까지」の手順 1〜6 を順番に実行してください。各手順の成功条件を確認し、失敗したら AGENTS.md の「실패했을 때」の表に従って直してからやり直してください。終わったら、レンダリングした MP4 のパス、ffprobe の出力、スタジオの URL、実行できなかった手順とその理由を報告してください。
```

### このエージェントにプラグインとしてインストールする

```text
まず <REPO_URL> リポジトリの AGENTS.md を読んでください(ローカルにクローンがなければクローンして npm install まで行ってください)。次に AGENTS.md の手順 7 から、いま動いているホストに合う方法を一つ選んで Frameforge のプラグインまたはスキルをインストールしてください。確認コマンドの出力を見せ、新しいセッションでスキルを呼び出すコマンドを教えてください。
```

### このブリーフで最初の作品を作る

```text
まず <REPO_URL> リポジトリの AGENTS.md を読んでください。まだインストールしていなければ AGENTS.md の手順 1〜3 を先に行ってください。次に skills/frameforge-create/SKILL.md に従って、下のブリーフから examples/samples/<slug>/ に新しい作品を作ってください。レンダリングして skills/frameforge-check/SKILL.md のチェックを実行し、MP4 のパスと各チェックの結果と数値を報告してください。

ブリーフ:
<ここにブリーフを書く。例: 20 秒、1920×1080、架空のコーヒー定期便の紹介、暖色、最後にロゴ>
```

### すべてアンインストールする

```text
まず <REPO_URL> リポジトリの AGENTS.md と docs/uninstall.md を読んでください。docs/uninstall.md の順番に従って、Frameforge がこのコンピューターに残したものをすべて削除してください。削除する前に一覧を見せ、frameforge init で作ったプロジェクトのように私の作品が入っているフォルダーは、削除する前に確認を取ってください。各手順の確認コマンドの出力と、残ったものを報告してください。
```
