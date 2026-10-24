# 제3자 고지

Frameforge의 독립 작성 코드는 [MIT License](LICENSE)입니다. 이 문서는 저장소에 함께 들어 있는 제3자 자료, 설치하는 의존성, 실행 중에 쓰는 외부 서비스와 그 결과물의 라이선스를 정리합니다. 법률 자문이 아닙니다. 검토 근거는 [docs/legal/open-source-audit.md](docs/legal/open-source-audit.md)에 있습니다.

Frameforge는 Remotion과 제휴하지 않은 독립 구현입니다. Remotion 코드는 저장소와 의존성에 들어 있지 않습니다.

## 저장소에 들어 있는 제3자 자료

### LINE Seed 글꼴 `public/fonts/line-seed/`

| 항목 | 내용 |
| --- | --- |
| 글꼴 | LINE Seed Sans, LINE Seed Sans KR, LINE Seed JP |
| 저작권자 | LY Corp. (https://seed.line.me/) |
| 라이선스 | SIL Open Font License 1.1. 전문은 `public/fonts/line-seed/OFL.txt` |
| 쓰는 곳 | 스튜디오 화면 글꼴. 컴포지션은 이 글꼴을 물려받지 않습니다. |

OFL에 따라 글꼴 파일만 따로 팔 수 없고, 수정한 글꼴은 예약 글꼴 이름이 있으면 그 이름을 쓸 수 없습니다. 이 글꼴로 만든 영상과 문서에는 이 조건이 적용되지 않습니다.

### 직접 만든 미디어

`public/footage/`의 영상과 GIF는 FFmpeg 테스트 패턴(`testsrc2`, `mandelbrot`)으로 만든 것입니다. 제3자 저작물이 아닙니다.

## 의존성

`npm ci`가 설치하는 직접 의존성입니다. 버전과 라이선스는 `node_modules/<패키지>/package.json`에서 읽었습니다(2026-10-20).

| 패키지 | 버전 | 라이선스 | 종류 |
| --- | --- | --- | --- |
| `@radix-ui/react-scroll-area` | 1.4.0 | MIT | dependencies |
| `@radix-ui/react-separator` | 1.2.0 | MIT | dependencies |
| `@radix-ui/react-slider` | 1.6.1 | MIT | dependencies |
| `@radix-ui/react-slot` | 1.5.0 | MIT | dependencies |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | dependencies |
| `clsx` | 2.1.1 | MIT | dependencies |
| `lucide-react` | 1.59.0 | ISC | dependencies |
| `react` | 19.3.0 | MIT | dependencies |
| `react-dom` | 19.3.0 | MIT | dependencies |
| `tailwind-merge` | 3.7.0 | MIT | dependencies |
| `@react-three/fiber` | 9.8.2 | MIT | devDependencies, `<ThreeCanvas>`의 선택 패키지 |
| `@tailwindcss/vite` | 4.3.3 | MIT | devDependencies |
| `@types/node` | 24.19.2 | MIT | devDependencies |
| `@types/react` | 19.3.0 | MIT | devDependencies |
| `@types/react-dom` | 19.3.0 | MIT | devDependencies |
| `@types/katex` | 0.16.7 | MIT | devDependencies |
| `@types/three` | 0.186.0 | MIT | devDependencies |
| `lottie-web` | 5.13.0 | MIT | devDependencies, `<Lottie>`가 실행 중에 씁니다 |
| `tailwindcss` | 4.3.3 | MIT | devDependencies |
| `katex` | 0.16.22 | MIT | devDependencies, `<Formula>`의 수식 렌더러. 글꼴 파일은 KaTeX 배포본의 것(SIL OFL 1.1) |
| `three` | 0.186.1 | MIT | devDependencies, `<ThreeCanvas>`의 선택 패키지 |
| `tsx` | 4.23.15 | MIT | devDependencies |
| `typescript` | 5.9.3 | Apache-2.0 | devDependencies |
| `vite` | 8.3.4 | MIT | devDependencies |

간접 의존성의 라이선스는 `node_modules` 안 각 패키지의 `package.json`과 LICENSE 파일을 따릅니다.

Python 쪽은 numpy(BSD-3-Clause 외 번들 구성 요소의 0BSD, MIT, Zlib, CC0-1.0)를 씁니다. `FRAMEFORGE_IMAGE_COMMAND`를 쓰면 `art.py`가 vtracer 0.6.15(MIT)를 설치할 수 있습니다. 두 라이선스는 설치된 패키지 메타데이터에서 읽었습니다.

Chrome과 FFmpeg는 저장소에 들어 있지 않습니다. 사용자가 설치한 프로그램을 실행만 합니다. 각 프로그램의 라이선스는 설치한 배포판을 따릅니다. FFmpeg는 빌드 설정에 따라 LGPL 또는 GPL입니다.

## 실행 중에 쓰는 외부 서비스

아래 서비스의 결과물은 저장소에 커밋하지 않습니다. `public/audio/generated/`, `public/assets/generated/`, `.cache/`는 `.gitignore`에 있습니다. 결과물을 배포하기 전에 라이선스를 확인하는 것은 사용자의 몫입니다.

| 서비스 | 언제 쓰나 | 결과물의 라이선스 |
| --- | --- | --- |
| Google Fonts (`fonts.googleapis.com`) | 작품이 `googleFont()`를 부를 때 | 글꼴마다 다릅니다. 대부분 SIL OFL 1.1이고 일부는 Apache-2.0입니다. 글꼴 파일은 렌더 중 브라우저가 받을 뿐 저장소나 출력 폴더에 저장하지 않습니다. 영상에 쓴 글자에는 OFL 조건이 적용되지 않습니다. |
| Openverse (`api.openverse.org`) | 효과음 해결(`sfx.py`), 그림 해결(`art.py`)에서 키 없이 | 효과음은 기본으로 CC0만 고릅니다. `FRAMEFORGE_SFX_LICENSES=cc0,by`로 CC BY를 허용하면 생성기가 `CREDITS.md`를 쓰고, 영상을 배포할 때 그 저작자 표시를 함께 실어야 합니다. 그림은 CC0 SVG만 고르며 Wikimedia Commons를 먼저 봅니다. |
| `FRAMEFORGE_IMAGE_COMMAND` | 호스트의 이미지 도구를 연결했을 때 | 그 도구의 약관을 따릅니다. |
| Poly Haven (`api.polyhaven.com`) | `models.py`가 3D 모델과 HDRI를 받을 때, 키 없이 | CC0입니다. 받은 파일과 출처는 `models.lock.json`에 고정합니다. |
| Blender (`blender` 실행 파일) | `blender.py`가 `3d.json`의 샷을 헤드리스로 렌더할 때 | Blender는 GPL이지만 별도 프로세스로 실행만 하므로 Frameforge 코드에 영향이 없고, 렌더한 이미지는 사용자의 것입니다. |
| macOS `say`, kokoro-onnx | `voice.py`가 나레이션을 만들 때 | `say`의 음성은 macOS 사용 조건을, kokoro-onnx는 Apache-2.0 모델 가중치의 조건을 따릅니다. 음성 파일은 커밋하지 않습니다. |
| https 미디어 URL | `<Video>`, `<AnimatedImage>`, `getVideoMetadata`에 https 주소를 줄 때 | 원본 파일의 라이선스를 따릅니다. 파일은 `.cache/remote/`에 내려받습니다. |

외부 서비스를 하나도 쓰지 않아도 렌더할 수 있습니다. 음악과 효과음은 내장 합성으로, 그림은 모티프 키트로 대체합니다.
