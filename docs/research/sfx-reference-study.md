# 효과음 제작 방식 참조 조사 (2026-10-20)

사용자 판정: 합성 프리셋을 작품 코드에서 손으로 배치하는 지금 방식은 "이것저것 잘라 붙인 소리"다. 다른 도구가 효과음을 어떻게 다루는지 공개 산출물로 확인하고, 그 결과로 Frameforge의 효과음 경로를 바꿨다(`docs/audio-score.md` 효과음 절). 읽은 것은 전부 공개 npm 산출물, 공개 저장소(Apache-2.0), 공개 API 문서다. 코드는 옮기지 않았다.

## 확인한 사실

| 출처 | 방식 | 관찰 |
| --- | --- | --- |
| 기준 엔진의 `sfx` 패키지 4.0.537 (MIT, npm tarball의 `dist/index.d.ts`) | 녹음 배포 | 합성 없음. 32개 WAV의 CDN URL 상수(`whoosh`, `whip`, `pageTurn`, `uiSwitch`, `mouseClick`, `shutterModern`, `ding`과 밈 음원 다수)를 export할 뿐이다. 작품은 그 URL을 `<Audio>`에 넣는다 |
| HyperFrames `packages/cli/src/media-use/` (Apache-2.0, 커밋 f503387) | 공급자 사슬 + 장부 | `resolve --type sfx --intent "<문장>"` 한 동사. 순서: Openverse 검색(CC0/CC BY만, mp3/wav/ogg/flac, 15초 이하, 순위 + 4초 초과분 + BY 벌점으로 선택) → 번들 21개 라이브러리(오프라인) → 로컬 색인 → 생성. 결과는 `.media/audio/sfx/<id>.mp3`로 동결되고 매니페스트와 CC BY `CREDITS.md`에 기록된다. 익명 Openverse 한도 분당 20, 하루 200 |
| HyperFrames 릴리스 노트 v0.8.87 | 타이밍 | "효과음이 한 프레임 늦지 않고 제 시각에 시작" 수정. 효과음은 온셋이 프레임에 맞아야 한다 |
| HyperFrames `packages/core/src/audioCarve.ts` | 믹스 | 음성 아래 음악을 전체 더킹이 아니라 음성이 차지하는 대역만 깎는 "carve"(피킹 EQ 체인). 효과음에도 같은 생각이 통한다: 효과음이 울릴 때 음악이 비켜야 사건으로 들린다 |
| ElevenLabs Sound Effects API (공개 문서) | 텍스트 생성 | `POST /v1/sound-generation`, 헤더 `xi-api-key`, 본문 `text`, `duration_seconds`(0.5–30, 없으면 자동), `prompt_influence`(0–1, 기본 0.3), `loop`, `model_id`=`eleven_text_to_sound_v2`. `output_format=pcm_48000`이 있다. 지정 길이는 초당 40 크레딧. 프롬프트 지침: 단순 효과는 짧고 구체적으로, 연속 사건은 순서대로 |
| Openverse API `GET /v1/audio/?q=&license=cc0,by&page_size=` | CC 라이브러리 | 키 없이 동작. 결과는 대부분 Freesound의 hq mp3 미리듣기(128 kbps, 품질 상한). `duration`은 ms. 직접 호출로 "whoosh" 240건 확인. 긴 문장 검색은 0건, 한두 단어가 수백 건 |
| Adobe Firefly Generate Sound Effects (도움말·보도) | 영상 동기 생성 | 영상을 올리고 플레이헤드 위치에 텍스트 프롬프트로 생성. "add timing"은 사용자가 목소리로 리듬과 세기를 연기하면 그 타이밍·에너지에 맞춰 생성. 즉 타이밍은 사람 연기에서, 음색은 텍스트에서 온다 |
| 사운드 디자인 관행 (whoosh 가이드, 용어집) | 레이어 | 공기(대역 노이즈 스윕) + 몸통(톤) + 질감(녹음) 세 층을 움직임의 가속·착지에 맞춰 어택·몸통·스테레오 경로·꼬리를 잡는다. 작은 빠른 제스처는 가벼운 스우시, 착지는 임팩트, 장면 전환은 전환음 |

## 결론

1. 아무도 효과음을 합성하지 않는다. 녹음(라이브러리)이나 텍스트 생성이 기본이고, 합성은 8비트 게임(sfxr 계열)에만 남아 있다. 우리 프리셋은 폴백이어야 한다.
2. 효과음은 "의도 문장 → 소스 해결 → 동결 파일 + 장부"다. 작품 코드는 파일 이름만 알면 된다.
3. 품질은 소스보다 조건화와 믹스에서 갈린다: 온셋이 프레임에 맞고, 레벨이 한 기준이며, 음악이 효과음 아래서 비킨다.
4. 다음 단계는 타이밍과 세기를 사람(또는 애니메이션)에서 받는 것이다(Firefly 방식). Frameforge에서는 스프링 착지와 와이프 방향에서 엔진이 사운드 이벤트를 내는 것이 그 자리다.

## Frameforge에 반영한 것

`scripts/assets/sfx.py`: `generate`(ElevenLabs, 키 있을 때) → `library`(Openverse CC0, 검색어는 의도 전체 → 앞 세 단어 → 프리셋 키워드) → `synth`(프리셋) 사슬, 모든 소스에 같은 조건화(48 kHz 스테레오, −40 dB 온셋 트림, 길이 상한, 꼬리 페이드, 70 Hz 하이패스, 피크 −18 dBFS), `sfx.json` 매니페스트로 선택을 고정, 네트워크 실패는 합성 폴백으로 기록. `scripts/render.mjs`: 효과음 스템에 대한 음악 사이드체인 더킹. 스튜디오: 효과음 재생 중 음악 0.6배.

사용자 정책과의 충돌: "기존 음원을 가져다 쓰지 않는다"는 규칙은 텍스트 생성 계층만 만족한다. `ELEVENLABS_API_KEY`가 없는 지금은 CC0 녹음 검색이 유일하게 동작하는 비합성 소스라 켜 두었다(`FRAMEFORGE_SFX_LICENSES`, 엔트리 `source: "synth"`로 끌 수 있다). 가져온 파일은 `public/audio/generated/`에만 놓이고 커밋되지 않는다.
