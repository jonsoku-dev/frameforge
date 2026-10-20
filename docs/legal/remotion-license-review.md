# Remotion 라이선스 검토와 Frameforge의 참조 범위 (2026-10-20)

이 문서는 Frameforge가 Remotion을 참조하면서 지키는 경계를 적는다. 법률 자문이 아니라 라이선스 원문을 읽고 내린 판단이다. 법인 규모가 바뀌거나 상업 서비스로 전환하면 다시 검토한다.

## 참조한 원문

| 자료 | 식별자 |
| --- | --- |
| GitHub `remotion-dev/remotion` main | commit `051aeb2d5fd02a1870932195ac357a26e03d1c5d` (2026-10-19) |
| `LICENSE.md`, `packages/core/LICENSE.md` | 위 커밋 |
| `packages/docs/docs/terms.mdx` (Terms and Conditions) | 위 커밋 |
| `packages/docs/docs/license/faq.mdx` | 위 커밋 |
| npm `remotion@4.0.537` tarball | sha256 `e75511d3bc8ec4a981bfc125d5fb519a7aa190e249af99860a58fbda1375e3e4` |
| 5.0 라이선스 변경안 | PR #3750 |

## 조항 요약 (원문 인용)

허용. Free License 자격은 "an individual", "a for-profit organization with up to 3 employees", "a non-profit", "evaluating ... not yet using it in a commercial way". 허용 용도는 "to use the software ... for the purpose of creating videos and images and to modify the software to their own liking".

소스 열람. Terms: "The source code of the Remotion Software can be studied on GitHub."

금지 1 (파생물 재라이선스). "It is not allowed to copy or modify the Remotion Software for the purpose of selling, renting, licensing, relicensing, or sublicensing one's own derivative of the Remotion Software."

금지 2 (역공학). "It is not allowed to reverse-engineer, disassemble, reverse-compile, or otherwise attempt to derive the source code of any part of the Remotion Software or Services that is not provided by Remotion in source code form."

5.0 변경안(PR #3750)은 금지 1의 표현을 "source-code"로 바꾸고, 사용자가 자기 Remotion 코드를 올리는 렌더링 서비스 운영 금지를 추가한다. 파생물 조항의 실질은 같다.

패키지별 라이선스(package.json `license` 필드, 4.0.537). `remotion`, `@remotion/google-fonts`, `@remotion/player`, `@remotion/renderer`, `@remotion/cli`는 Remotion License. `@remotion/transitions`는 `UNLICENSED`. `@remotion/paths`, `@remotion/shapes`, `@remotion/media-utils`, `@remotion/preload`는 MIT. `@remotion/animation-utils`는 LICENSE.md가 MIT 본문이지만 package.json에 license 필드가 없다.

## 판단

Frameforge는 MIT로 배포한다. Remotion License 패키지의 코드를 복사하거나 가깝게 옮겨 적으면 금지 1의 "relicensing one's own derivative"에 해당하므로 하지 않는다. 이 문서 이후에도 같은 규칙이다.

허용되는 참조는 다음 셋이다.

1. 공개 문서(remotion.dev/docs)와 공개 타입 선언(`dist/*.d.ts`)으로 API 이름과 인자 형태를 맞춘다.
2. npm 패키지를 Node에서 실행해 입력과 출력만 기록한다(블랙박스 오라클). 개인 자격의 평가 사용이며 제품 의존성에 넣지 않는다.
3. REA로 npm 번들의 export 목록과 모듈 구조를 인벤토리한다. 소스가 공개된 JavaScript 산출물만 대상으로 하고, `@remotion/compositor-*`의 바이너리, FFmpeg 동적 라이브러리, Lambda 산출물은 금지 2가 미치는 범위이므로 열지 않는다.

구현 파일 열람 기록. `packages/core/src/random.ts`는 난수 생성기가 어떤 공개 알고리즘인지 확인하려고 읽었다. 결과는 mulberry32(Tommy Ettinger, 공개 도메인)와 Java `String.hashCode` 방식의 문자열 해시다. Frameforge의 `random`은 이 두 공개 알고리즘의 정의로부터 작성했고, 출력은 npm 패키지 실행값과 비교해 검증했다. 이 파일에서 가져온 Remotion 고유의 사실은 하나다. 숫자 seed를 `10000000000`배 해서 생성기에 넣는다는 점이며, 같은 난수열을 내려면 피할 수 없어서 그대로 썼다. 알고리즘과 상수는 저작권 보호 대상인 표현이 아니라고 판단했지만, 이 상수를 버리고 난수열 호환을 포기하는 선택도 열려 있다. 그 밖의 구현 파일은 읽지 않았다. 테스트 파일 `packages/core/src/test/wrap-sequence-context.tsx`, `sequence-playback-rate.test.tsx`, `sequence-premounting.test.tsx`는 Sequence 타이밍의 기대 동작을 명세로 삼기 위해 읽었다. 하네스를 실제로 실행하지는 못했고, 테스트가 기대하는 입력과 출력 쌍만 Frameforge 테스트의 기대값으로 옮겼다. 하네스 코드는 제품 코드로 옮기지 않았다.

## 사용 자격 가정

이 저장소의 작업자는 개인이며 Free License 자격이다. 4인 이상 영리 조직이 npm 패키지를 실행해 오라클을 다시 만들려면 Company License가 필요하다. 저장소의 소스와 문서를 읽는 것만으로는 라이선스 구매가 필요하지 않다.

## 미해결

"derivative"의 정의가 라이선스에 없다. 코드를 복사하지 않은 API 호환 구현은 조항의 문언상 대상이 아니라고 읽지만, 확정하려면 hi@remotion.dev에 문의하거나 변호사 검토가 필요하다.
