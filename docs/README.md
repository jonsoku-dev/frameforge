# 문서 목록

Frameforge의 모든 문서입니다. 처음이면 저장소의 [README](../README.md)부터 읽습니다.

## 시작과 설치

| 문서 | 내용 |
| --- | --- |
| [../README.md](../README.md) | 소개, 30초 시작, 요구 사항, 쓰는 방법 세 가지 |
| [../AGENTS.md](../AGENTS.md) | 에이전트가 클론부터 첫 렌더와 스튜디오까지 따라 하는 순서와 실패 대처 |
| [../CLAUDE.md](../CLAUDE.md) | Claude Code용 안내. AGENTS.md를 가리킵니다 |
| [agent-install.md](agent-install.md) | 에이전트에게 붙여 넣는 설치, 플러그인, 첫 작품, 제거 프롬프트(한국어, 영어, 일본어) |
| [manual.md](manual.md) | 사람이 처음부터 따라 하는 설치, 첫 렌더, 작품 만들기, 제거 |
| [install.md](install.md) | 설치 경로별 단계와 확인 명령, 환경 변수 표 |
| [uninstall.md](uninstall.md) | 설치의 역순으로 모두 지우는 방법과 확인 명령 |
| [plugin.md](plugin.md) | 에이전트 플러그인 구조와 스킬 열한 개 |

## 레퍼런스

| 문서 | 내용 |
| --- | --- |
| [reference/api.md](reference/api.md) | API 지원 범위, 전환, 플레이어, 미디어, 유틸 패키지, 소리, 에셋, 모티프 키트 |
| [reference/studio.md](reference/studio.md) | 스튜디오 실행, 진입점, 네 탭 |
| [reference/rendering.md](reference/rendering.md) | MP4 렌더러, 결정성 린트, 병렬 렌더, 측정 기록 |
| [reference/quality-checks.md](reference/quality-checks.md) | 글자 잘림 가드, frame-check, flash-check, 음량 보고 |
| [reference/cli.md](reference/cli.md) | 저장소 밖 프로젝트용 `frameforge` CLI |
| [reference/verification.md](reference/verification.md) | 검증 기록, REA 상태, 사용권 |
| [audio-score.md](audio-score.md) | `audio.json` 형식, 음악 생성, 음량 정책, 움직임에서 나오는 소리 |
| [reference/blocks-text.md](reference/blocks-text.md) | 블록 카탈로그 1: 글자, 로어서드, 카드 |
| [reference/blocks-data.md](reference/blocks-data.md) | 블록 카탈로그 2: 차트, 코드, 다이어그램 |
| [reference/seams.md](reference/seams.md) | 이음새 곡선과 `seam-check` |
| [reference/voice.md](reference/voice.md) | 나레이션 사양, `voice.py`, `useNarration`, 자막, 수식, `narration-check` |
| [reference/three-d.md](reference/three-d.md) | `3d.json`, 헤드리스 Blender 렌더, Poly Haven 모델, `ImageSequence`, `Model` |
| [reference/effects.md](reference/effects.md) | 색 보정, LUT, 라이트 리크, 비네트, 그레인 |
| [reference/generative.md](reference/generative.md) | 생성 배경 시스템과 손그림 주석 |
| [reference/blocks-maps.md](reference/blocks-maps.md) | 블록 카탈로그 3: 지도, 경로, 마커와 `geo.py` |
| [reference/seekable.md](reference/seekable.md) | 외부 애니메이션 라이브러리를 프레임으로 구동하는 어댑터 |
| [reference/tooling.md](reference/tooling.md) | 출력 형식, 박자 그리드, 레이아웃·대비 감사, 무음 탐지, `frameforge check` |

## 제작 가이드

샘플 제작 규칙은 [samples/rules.md](samples/rules.md), 시작 템플릿은 `examples/samples/_template/`입니다.

| 문서 | 내용 |
| --- | --- |
| [guides/README.md](guides/README.md) | 가이드 읽는 순서 |
| [guides/motion-graphics.md](guides/motion-graphics.md) | 15–30초 스팟 한 편의 기획, 화면, 모션 언어, 마스크, 코드 패턴, 자기 검사 |
| [guides/assets.md](guides/assets.md) | 작품별 오디오 사양, 아이콘, 글꼴, 화면 캡처, 색 |
| [guides/product-explainer.md](guides/product-explainer.md) | 사용자가 직접 캡처한 제품 화면으로 만드는 설명 영상 |
| [guides/model-playbook.md](guides/model-playbook.md) | 모델별 편차 분석, 같은 브리프 비교 결과, 브리프 쓰는 법, 교차 리뷰 |

## 샘플

| 문서 | 내용 |
| --- | --- |
| [samples/rules.md](samples/rules.md) | 샘플 제작 규칙과 구성 최소치 |
| [samples/README.md](samples/README.md) | 샘플 작품 목록과 결과표 |

## 스튜디오 설계

| 문서 | 내용 |
| --- | --- |
| [studio/spec.md](studio/spec.md) | 스튜디오 2.0 설계서(화면, API, 상태, 검증 항목) |

## 법률과 조사

| 문서 | 내용 |
| --- | --- |
| [legal/remotion-license-review.md](legal/remotion-license-review.md) | 기준 엔진 라이선스 검토와 참조 범위 |
| [legal/open-source-audit.md](legal/open-source-audit.md) | 공개 전 파일별 점검 |
| [research/video-engine-landscape.md](research/video-engine-landscape.md) | 프로그래매틱 비디오 엔진 비교 |
| [research/feature-parity-roadmap.md](research/feature-parity-roadmap.md) | 기준 엔진 기능 흡수 단계와 남은 한계 |
| [research/remotion-parity.md](research/remotion-parity.md) | 기준 엔진과의 픽셀 동등성 측정 |
| [research/sfx-reference-study.md](research/sfx-reference-study.md) | 효과음 제작 방식 조사 |
| [research/asset-practice-study.md](research/asset-practice-study.md) | 모션그래픽 에셋 출처와 도구 조사 |
| [research/motion-tools-absorption.md](research/motion-tools-absorption.md) | 에이전트용 영상 도구 다섯 가지의 REA 분석과 흡수 기록 |
| [research/benchmark-loop.md](research/benchmark-loop.md) | 원작과의 블라인드 비교 벤치마크 루프와 회차별 변경 |

## 저장소 루트

| 문서 | 내용 |
| --- | --- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | 개발 환경, 확인 명령, 독립 구현 규칙, 오라클 재생성, 샘플 작업 순서, 커밋 방식 |
| [../SECURITY.md](../SECURITY.md) | 로컬 전용 서버, 스튜디오 API 검사, 취약점 신고 |
| [../CHANGELOG.md](../CHANGELOG.md) | 변경 이력 |
| [../THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) | 제3자 코드, 글꼴, 의존성, 외부 서비스 결과물의 라이선스 |
| [../LICENSE](../LICENSE) | MIT License |
