# 3D 파이프라인

Frameforge의 3D는 소켓도 서버도 없는 파일 파이프라인이다. 작품 옆의 사양 파일을 스크립트가 읽어 `public/assets/generated/<slug>/` 아래에 결과를 쓰고, 컴포넌트가 그 파일을 프레임 함수로 재생한다. 세 가지 입구가 있다.

| 필요 | 사양 | 명령 | 결과 | 컴포넌트 |
| --- | --- | --- | --- | --- |
| Blender로 렌더한 샷 | `examples/samples/<slug>/3d.json` | `npm run blender -- examples/samples/<slug>/3d.json [--shot hero] [--frames 0-9] [--force]` | `public/assets/generated/<slug>/3d/<shot>/0000.png …` + `manifest.json` | `<ImageSequence>` |
| CC0 모델·HDRI·텍스처 | `examples/samples/<slug>/models.json` | `npm run models -- examples/samples/<slug>/models.json [--force]` | `public/assets/generated/<slug>/models/…` + 옆의 `models.lock.json` | `<Model>` 또는 3d.json의 `subject.src` / `light.hdri` |
| 브라우저 안의 실시간 3D | 없음 | 없음 | 없음 | `<ThreeCanvas>` + `<Model>` `<Turntable>` `<StudioLights>` |

Blender 4.2 이상이 필요하다(`blender`가 PATH에 있거나 `BLENDER_PATH`). 5.2 LTS로 검증했다. 없으면 `npm run blender`가 `Blender not found`로 멈추고, 이미 렌더된 PNG가 있으면 그대로 쓴다. Poly Haven API에는 키가 필요 없다.

## 3d.json

```json
{"slug": "turntable-spot", "shots": [{
  "name": "hero", "frames": 150, "fps": 30, "width": 1920, "height": 1080, "seed": 7,
  "engine": "eevee", "samples": 32, "transparent": true,
  "camera": {"preset": "turntable", "radius": 13, "height": 3.5, "fov": 40, "from": 0, "to": 360},
  "subject": {"kind": "primitive", "primitive": "torus", "scale": 1.15, "rotation": [90, 0, 0]},
  "material": {"base": "#C8553D", "metallic": 0, "roughness": 0.28, "emission": 0},
  "light": {"preset": "studio", "strength": 1},
  "background": "transparent", "shadowCatcher": true
}]}
```

| 필드 | 값 | 뜻 |
| --- | --- | --- |
| `name` | 소문자·숫자·대시 | 출력 폴더 이름 `3d/<name>/` |
| `frames`, `fps`, `width`, `height` | 양의 정수 | 시퀀스 길이와 크기. 작품과 같은 fps로 두면 한 프레임이 한 파일이다 |
| `seed` | 정수 | Cycles 샘플 시드. 기본 0 |
| `engine` | `eevee`(기본) / `cycles` | EEVEE는 1080p 한 프레임에 약 1초(32 샘플, M 시리즈 Mac). Cycles는 CPU로 돌고 훨씬 느리다 |
| `samples` | 정수, 기본 32 | EEVEE의 `taa_render_samples`, Cycles의 `samples` |
| `transparent` | 불리언 | 필름을 RGBA로 쓴다. `background: "transparent"`와 같다 |
| `camera.preset` | `turntable` / `orbit` / `dolly` / `static` | turntable은 `frames` 동안 한 바퀴(마지막 프레임은 첫 프레임 직전에서 멈춰 루프에 겹침이 없다). orbit은 `from`°→`to`°(기본 0→360). dolly는 각 0°에서 반지름 `from`→`to`(없으면 `radius`에 머문다). static은 각 `from`°(기본 0) |
| `camera.radius`, `height`, `fov` | 숫자 | 피사체 중심에서의 거리와 높이(단위 m), 가로 화각(도). 각 0°는 피사체 정면(-Y), 위에서 보아 반시계 방향 |
| `subject.kind` | `primitive` / `glb` / `script` | 아래 피사체 절 |
| `subject.scale`, `rotation` | 숫자, [x, y, z] 도 | 기본 도형의 한 변·반지름은 1 (지름 2) |
| `material` | `base` #rrggbb, `metallic` 0–1, `roughness` 0–1, `emission` ≥ 0 | Principled BSDF. `base`는 sRGB로 적고 스크립트가 선형으로 바꾼다. glb에는 `material`을 적었을 때만 덮어쓴다 |
| `light.preset` | `studio`(기본) / `sunset` / `hdri` | studio는 키·필·림 면광원 셋, sunset은 낮은 따뜻한 태양과 하늘빛 면광원, hdri는 `light.hdri`의 .hdr을 환경으로 쓴다. 모든 광원은 피사체 중심을 향한다 |
| `light.strength` | 숫자, 기본 1 | 프리셋 전체의 배율 |
| `background` | `#rrggbb` 또는 `transparent` | 카메라가 보는 색. 조명은 프리셋이 주고(hdri면 HDRI), 카메라 광선만 이 색을 본다 |
| `shadowCatcher` | 불리언 | 피사체 바닥에 그림자만 남는 판을 둔다. Cycles는 자체 shadow catcher, EEVEE는 Ambient Occlusion 노드로 만든 접촉 그림자(알파 최대 55 %) |

경로는 두 가지 기준이다. `subject.src`와 `light.hdri`는 `public/assets/generated/<slug>/` 기준(`models/vase/vase.gltf`처럼 `npm run models`가 쓴 경로), `subject.script`는 3d.json 옆 기준이다.

### 피사체

- `primitive`: `cube` `sphere` `torus` `monkey` `cylinder`. cube 말고는 부드럽게 셰이딩하고, monkey에는 서브디비전 2단, cylinder는 30° 기준 각도 스무딩이라 테두리가 산다.
- `glb`: `bpy.ops.import_scene.gltf`로 읽는다(.gltf+사이드카, .glb 모두). 가장 긴 변이 2 × `scale`이 되게 맞추고 중심을 원점에 둔다.
- `script`: 3d.json 옆의 파이썬 파일. Blender 안에서 실행되며 `build(scene, shot)`을 호출한다. `shot`은 기본값이 채워진 샷 사양이다. 피사체 오브젝트(하나 또는 리스트)를 돌려주면 그림자 판과 카메라 기준이 그 경계 상자를 따른다. `None`을 돌려주면 장면의 모든 메시를 피사체로 본다.

```python
import bpy

def build(scene, shot):
    bpy.ops.mesh.primitive_cone_add(radius1=1.0, depth=2.0, vertices=32)
    return bpy.context.active_object
```

## 결정성

같은 사양은 같은 바이트의 PNG를 낸다(이 Mac의 EEVEE·Cycles 모두에서 두 번 렌더해 확인했다. 다른 GPU·드라이버·Blender 판에서 같은 바이트가 나온다고는 주장하지 않는다). `blender_scene.py`가 고정하는 것:

- 샷마다 Blender 프로세스 하나, `--factory-startup`, `read_factory_settings(use_empty=True)`. 사용자 설정이 섞이지 않는다.
- 카메라는 키프레임이 아니라 `camera_pose(camera, index, frames)`라는 프레임 번호의 순수 함수로 매 프레임 놓는다. `--frames 5`만 렌더한 5번 프레임은 전체 렌더의 5번 프레임과 같은 바이트다(테스트가 확인한다).
- EEVEE: `taa_render_samples = samples`, 모션 블러 없음. Cycles: `samples`, `seed`, `use_animated_seed = False`, `use_adaptive_sampling = False`, `use_denoising = False`, `device = 'CPU'`.
- 색 관리: 디스플레이 sRGB, 뷰 변환 Standard, 룩 None, 노출 0, 감마 1. `background`와 `material.base`의 헥스가 적은 대로 나온다(테스트가 배경 픽셀을 확인한다).
- PNG 8비트, 압축 15, `use_stamp_*` 전부 끔. 스탬프 메타데이터(렌더 시간)가 유일하게 달라지던 바이트였다.

`manifest.json`의 `specHash`는 샷 JSON + 스크립트·모델·HDRI 파일 바이트 + `GENERATION`의 해시다. 같은 해시이고 요청한 PNG가 다 있으면 건너뛴다. `blender_scene.py` 자체를 고치면 `blender.py`의 `GENERATION`을 올려 모든 샷을 다시 렌더하게 한다.

## models.json

```json
{"slug": "turntable-spot", "items": [
  {"name": "vase", "kind": "model", "query": "ceramic vase", "id": "ceramic_vase_01", "resolution": "1k"},
  {"name": "sky", "kind": "hdri", "query": "studio small", "resolution": "1k"}
]}
```

- `kind`: `model`(기본) / `hdri` / `texture`. `resolution`: `1k`(기본) `2k` `4k` `8k` `16k`. 제공하지 않는 해상도면 제공 목록을 알려 주며 멈춘다.
- 고르기: `id`가 있으면 그 자산. 없으면 Poly Haven 전체 목록(검색 API가 없다)에서 id에 모든 질의 단어가 든 것 → 이름·태그에 모든 단어가 든 것 → 한 단어라도 든 것, 각 단계에서 id 정렬 순으로 첫 번째. 같은 질의는 같은 자산을 고른다. 원하는 것이 확실하면 `id`를 적는다(사이트 URL의 마지막 조각).
- 출력: model은 `models/<name>/<name>.gltf`와 그 옆의 `.bin`, `textures/` (Poly Haven은 .glb를 주지 않는다). hdri는 `models/<name>.hdr`, texture는 `models/<name>.jpg`(디퓨즈 맵). 모든 파일은 API의 md5와 대조한다.
- `models.lock.json`(models.json 옆, 커밋한다): id, kind, resolution, 제목, 작가, 라이선스(CC0), 자산 페이지, 파일마다 경로·url·md5. 잠금과 kind·resolution·id/query가 같고 파일이 다 있으면 네트워크를 쓰지 않는다. `--force`는 다시 받는다.
- Poly Haven은 전부 CC0라 `CREDITS.md`를 쓰지 않는다. 잠금에 CC0가 아닌 라이선스가 들어오면 그때만 쓴다.
- 오프라인이거나 맞는 자산이 없으면 `models.json: <name>: …` 한 줄과 종료 코드 1.

## 컴포넌트

모두 `frameforge`에서 가져온다.

### `<ImageSequence>`

```tsx
<Sequence from={120} layout="none">
  <ImageSequence src="/assets/generated/turntable-spot/3d/hero" frames={150} fps={30} />
</Sequence>
```

| prop | 뜻 |
| --- | --- |
| `src` | `0000.png …`가 든 폴더. `npm run blender`의 출력 경로 |
| `frames` | 파일 수. 렌더 때는 필수(manifest.json을 읽지 않는다). 스튜디오는 비워 두면 manifest에서 채운다 |
| `fps` | 시퀀스의 fps. 기본은 작품 fps. `sequenceIndex`가 `floor(frame × fps ÷ 작품fps)`로 파일 번호를 고른다 |
| `loop` | 끝을 지나면 처음으로. 기본은 마지막 파일에 멈춤 |
| `pad` | 파일 이름 자릿수, 기본 4 |
| `startFrame` | 첫 파일 번호(앞을 잘라 낸다), 기본 0 |
| `fit` | `contain`(기본) / `cover` / `fill` |

프레임은 그 파일이 로드될 때까지 `delayRender`로 잡고, 다음 파일을 미리 받는다. 시퀀스가 없으면 스튜디오는 `npm run blender -- examples/samples/<slug>/3d.json`을 알려 주는 오류를, 렌더는 같은 문구로 `cancelRender`를 낸다. 순수 함수 `sequenceIndex(frame, fps, seqFps, frames, loop?, startFrame?)`와 `sequenceFile(src, index, pad?)`도 내보낸다.

### `<Model>`, `<Turntable>`, `<StudioLights>`

`<ThreeCanvas>` 안에서 쓴다. 세 가지는 fiber의 JSX 타입 없이도 컴파일되지만, 작품에서 `<group>` 같은 태그를 직접 쓰려면 `import type {} from '@react-three/fiber'`를 한 줄 둔다.

```tsx
<ThreeCanvas width={W} height={H} camera={{position: [0, 0.6, 6.4], fov: 32}} gl={{alpha: true}}>
  <StudioLights intensity={1.1} />
  <group position={[1.75, -1.15, 0]}>
    <Turntable speed={0.12}>
      <Model src="/assets/generated/turntable-spot/models/vase/vase.gltf" scale={6} />
    </Turntable>
  </group>
</ThreeCanvas>
```

- `<Model src scale position rotation>`: three의 GLTFLoader로 `src`를 읽는다(동적 import, three가 없으면 설치 안내). 같은 src는 페이지에서 한 번만 받고 각 `<Model>`은 장면의 복제를 올린다. 로드될 때까지 `delayRender`로 프레임을 잡고, 올라간 커밋 뒤에 푼다. `rotation`은 라디안.
- `<Turntable speed phase>`: 자식을 세로축으로 초당 `speed` 바퀴(기본 0.25) 돌린다. `phase`는 시작 각(라디안). 프레임의 함수라 마지막 2초를 세우려면 `<Freeze>`로 감싼다(샘플 참고).
- `<StudioLights intensity color>`: 주변광 + 키(-3.5, 4.5, 5)·필(4.5, 2, 3)·림(1, 4, -5) 방향광. 위치는 고정이고 `intensity`가 넷을 함께 조절한다.

## 샘플

`examples/samples/turntable-spot/`: 3d.json의 hero(턴테이블 토러스, 투명 필름, 종이색 위에 합성)와 dolly(실린더, 잉크 위), models.json의 `ceramic_vase_01`을 `<Model>`로. `prompt.md`에 장면표와 확인하지 않은 것이 있다.

## 검사

- `python3 scripts/assets/blender.py --self-check`: Blender 없이 색 변환, 카메라 프리셋, 프레임 범위, 기본값, 해시, 검증.
- `python3 scripts/assets/models.py --self-check`: 로컬 가짜 API로 고르기, glTF+사이드카, HDRI, md5, 잠금 건너뛰기, 크레딧, 오류 경로.
- `npx tsx --test tests/three-d.test.tsx`: 위 둘과 파일 번호 계산, 마크업 결정성, 그리고 Blender가 있으면 `tests/fixtures/three-d/3d.json`을 두 번 렌더해 바이트 동일성·배경 픽셀·manifest·부분 렌더 일치를 확인한다(없으면 건너뛴다).
