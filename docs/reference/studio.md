# 스튜디오

README에서 옮긴 스튜디오 레퍼런스입니다. 설계서는 [../studio/spec.md](../studio/spec.md)이고, 과정 기록 형식은 그 문서의 3절 "프로세스 가시성"입니다.

## 실행과 진입점

Node 24 이상에서 동작합니다. Node 24.20.0, npm 11.19.0에서 확인했습니다.

```sh
npm ci
npm run dev
```

미리보기: http://127.0.0.1:4317

기본 진입점은 모든 샘플 작품을 등록한 `examples/samples/index.tsx`입니다. 기존 영상 코드와 로컬 자산을 프로젝트 내부에 복사한 뒤 다음처럼 진입점을 지정할 수 있습니다.

```sh
VIDEO_ENTRY=examples/my-video/index.tsx npm run dev
```

`public/` 자산은 `staticFile()`로 참조합니다. 스튜디오에서는 장면을 고르고 재생하며, 출력 탭에서 MP4·컨택트 시트 렌더를 큐에 넣습니다(아래 "스튜디오 2.0"). 입력값 칸은 없습니다. 프리뷰는 개발 서버이며 운영 서비스가 아닙니다.

## 스튜디오 2.0

`npm run dev`로 띄운다(기본 진입점이 샘플 전체다). 설계서는 `docs/studio/spec.md`. 왼쪽 컴포지션 레일(모델·버전 배지), 가운데 스테이지(안전 영역·타이틀 세이프 오버레이, 글자 잘림 윤곽), 오른쪽 인스펙터 네 탭, 아래 타임라인(장면 띠, 소리 띠, 검사 띠, 과정 마커).

- 기획 탭: 그 작품의 `prompt.md`와 장면표.
- 과정 탭: `process.json`의 실행 기록(작성·리뷰·수정·렌더·검사·요청)을 최신순 카드로. 시트 썸네일 클릭으로 프레임 이동, 리뷰 지적과 해결 버전 표시. 프레임을 지정한 변경 요청을 적으면 요청 실행으로 기록된다(에이전트가 집어 간다). 기록 형식은 `docs/studio/spec.md` 3절, 추가는 `node scripts/process.mjs append <folder> '<json>'`.
- 조정 탭: 작품이 `export const variables`로 선언한 값(문구, 색, 타이밍 오프셋, 음량)을 즉시 미리보기로 바꾸고 `overrides.json`에 저장. 저장은 수정 실행으로 과정에 남는다. 지금 저장소의 샘플 중 변수를 선언하거나 `process.json`을 가진 작품은 없어서, 과정 탭과 조정 탭은 새 작품이 기록을 쌓을 때부터 채워진다.
- 출력 탭: MP4·컨택트 시트 렌더를 큐에 넣고 진행률(SSE)을 보며, 끝나면 가드·플래시·프레임 품질·음량·색 태그 결과 카드가 뜬다. 결과는 `renders/studio/<slug>/`.
- 서버 API는 loopback 전용이며 프로젝트 폴더 밖 경로를 거부한다(`src/studio/server/`).

## 미리보기

작품 하나만 띄우려면 그 작품의 `entry.tsx`를 진입점으로 줍니다. 예를 들어 `VIDEO_ENTRY=examples/samples/cafe-morning/entry.tsx npm run dev`는 `CafeMorning`(1920×1080, 30fps, 20초)만 엽니다.
