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
| `camera.ease`, `radiusTo`, `heightTo`, `target` | `linear`(기본)·`inout`·`out`, 숫자 | 아래 「카메라 이동」 |
| `camera.preset` | `turntable` / `orbit` / `dolly` / `static` | turntable은 `frames` 동안 한 바퀴(마지막 프레임은 첫 프레임 직전에서 멈춰 루프에 겹침이 없다). orbit은 `from`°→`to`°(기본 0→360). dolly는 각 0°에서 반지름 `from`→`to`(없으면 `radius`에 머문다). static은 각 `from`°(기본 0) |
| `camera.radius`, `height`, `fov` | 숫자 | 피사체 중심에서의 거리와 높이(단위 m), 가로 화각(도). 각 0°는 피사체 정면(-Y), 위에서 보아 반시계 방향 |
| `subject.kind` | `builtin` / `primitive` / `glb` / `script` | 아래 피사체 절 |
| `look`, `sweep`, `bloom`, `dof` | 아래 「히어로 룩」 | 룩을 적으면 `material`에 룩 기본값(`accent` `trim` `lines` `width` `glow` `ior` `scroll`)이 채워진다 |
| `subject.scale`, `rotation` | 숫자, [x, y, z] 도 | 기본 도형의 한 변·반지름은 1 (지름 2) |
| `material` | `base` #rrggbb, `metallic` 0–1, `roughness` 0–1, `emission` ≥ 0 | Principled BSDF. `base`는 sRGB로 적고 스크립트가 선형으로 바꾼다. glb에는 `material`을 적었을 때만 덮어쓴다 |
| `light.preset` | `studio`(기본) / `sunset` / `hdri` | studio는 키·필·림 면광원 셋, sunset은 낮은 따뜻한 태양과 하늘빛 면광원, hdri는 `light.hdri`의 .hdr을 환경으로 쓴다. 모든 광원은 피사체 중심을 향한다 |
| `light.strength` | 숫자, 기본 1 | 프리셋 전체의 배율 |
| `background` | `#rrggbb` 또는 `transparent` | 카메라가 보는 색. 조명은 프리셋이 주고(hdri면 HDRI), 카메라 광선만 이 색을 본다 |
| `shadowCatcher` | 불리언 | 피사체 바닥에 그림자만 남는 판을 둔다. Cycles는 자체 shadow catcher, EEVEE는 Ambient Occlusion 노드로 만든 접촉 그림자(알파 최대 80 %) |

경로는 두 가지 기준이다. `subject.src`와 `light.hdri`는 `public/assets/generated/<slug>/` 기준(`models/vase/vase.gltf`처럼 `npm run models`가 쓴 경로), `subject.script`는 3d.json 옆 기준이다.

### 피사체

- `builtin`: 히어로 메시. `head`는 기본이 CC0 스캔 고전 흉상이다. `blender.py`가 처음 쓸 때 `scripts/assets/scans/models.json`으로 한 번 받아 `public/assets/generated/frameforge-scans/`에 두고 모든 작품이 함께 쓴다(`scans/models.lock.json`이 id와 md5를 고정한다). 어떤 룩을 입혀도 스캔의 노멀 맵을 유지한다. 오프라인이거나 `subject.scan: false`면 조각한 흉상(눈꺼풀·조각한 홍채·입술, 피부에서 자라나는 짧은 곱슬머리, 돌림판 받침)이 대신 나오고 `manifest.json`의 `subject`가 `scan`인지 `builtin`인지 적는다. 나머지는 `bottle`(금색 캡의 세럼 병. 바깥 벽을 올라가 입구를 넘어 안쪽으로 내려오는 속이 빈 유리 껍질이고 바닥은 벽 세 배 두께다. `subject.liquid: {"fill": 0..1, "colour": "#rrggbb"}`가 안에 액체를 채운다), `gem`(라운드 브릴리언트 컷), `knot`(둥근 삼각 단면이 세 번 비틀리는 (2, 3) 토러스 매듭), `plush`(귀와 검은 광택 눈이 있는 말랑한 마스코트). head와 plush는 numpy로 적은 부호 거리장(smooth min으로 덩어리를 섞는다)을 복셀 격자에 샘플해 OpenVDB로 쓰고 Blender의 Volume to Mesh로 메시화한 뒤 다듬고 서브디비전한다. `subject.detail`(64–512, 기본 256)이 긴 변의 복셀 수다. 난수가 없어 같은 사양은 같은 메시다. 부품마다 역할이 있어 `body`는 룩을, `trim`(캡)은 `material.trim` 금속을, `eye`는 검은 광택을, `plinth`(받침)은 검은 석재를 받는다. 룩이 없으면 `glossy`다.
- `primitive`: `cube` `sphere` `torus` `monkey` `cylinder`. cube 말고는 부드럽게 셰이딩하고, monkey에는 서브디비전 2단, cylinder는 30° 기준 각도 스무딩이라 테두리가 산다.
- `glb`: `bpy.ops.import_scene.gltf`로 읽는다(.gltf+사이드카, .glb 모두). 가장 긴 변이 2 × `scale`이 되게 맞추고 중심을 원점에 둔다.
- `script`: 3d.json 옆의 파이썬 파일. Blender 안에서 실행되며 `build(scene, shot)`을 호출한다. `shot`은 기본값이 채워진 샷 사양이다. 피사체 오브젝트(하나 또는 리스트)를 돌려주면 그림자 판과 카메라 기준이 그 경계 상자를 따른다. `None`을 돌려주면 장면의 모든 메시를 피사체로 본다.

```python
import bpy

def build(scene, shot):
    bpy.ops.mesh.primitive_cone_add(radius1=1.0, depth=2.0, vertices=32)
    return bpy.context.active_object
```

## 히어로 룩

피사체의 실루엣·표정·재질·장면 목적에 맞춰 직접 제작한 `script`, 사용 권한이 있는 모델, builtin 중 선택하며 우선순위는 강제하지 않는다. Blender·ThreeCanvas·직접 만든 셰이더는 제작 수단이며, 3D나 프리셋 사용만으로 완성도를 판단하지 않는다. 실제 대표 화면과 관찰한 참고물을 대조한 뒤 동작으로 확장한다. 외부 모델의 `look`을 적으면 재질을 덮고, 빼면 원래 텍스처를 쓴다. 사양 밖의 리그·장면 제어가 필요해 별도 로컬 Blender 장면을 쓰면 명령·소스·시드·버전과 프로젝트 소유 출력 경로를 기록하고, 공용 생성물을 덮어쓰지 않는다.

| `look` | 모습 | `material`에서 읽는 값 |
| --- | --- | --- |
| `glossy` | 클리어코트 래커, 부드러운 스튜디오 반사 | `base` |
| `glass` | 소프트박스 스튜디오를 굴절하는 맑은 투과. 색은 `absorption`(Cycles는 두께에 따라 짙어지는 Volume Absorption, EEVEE는 투과색). EEVEE에서 병 벽은 비쳐 보이는 벽 + 프레넬 반사로 그려 안의 액체가 보인다. 유리·보석 히어로는 Cycles 권장 | `ior`(1.45, 물 1.33, 보석 2.4), `absorption`, `density`(2), `frost`(0) |
| `chrome` | 스튜디오를 비추는 거울 금속 | `base`(색조) |
| `plush` | 시언 잔털, 무광 바탕, 고운 노이즈 범프 | `base` |
| `toon` | 빛 세 단계, 딱딱한 하이라이트, 잉크 외곽선(반전 헐). EEVEE 전용 | `base` |
| `scanline` | 거의 검은 몸체 위 가로 발광 줄, 키 라이트가 닿는 쪽이 밝다 | `accent`, `lines`(단위당 36), `width`(0.16), `glow`(5), `scroll`(프레임당 줄 수) |
| `wireframe` | 리메시한 사본 위 고른 발광 격자, 어두운 몸체 | `accent`, `glow` |
| `holographic` | 검은 래커 위 박막 간섭 무지개, 높이에 따라 도는 프레넬 림 | `base`, `glow` |

- `sweep: {"to": <look>, "from": <프레임>, "until": <프레임>}`: 샷의 `look`이 아래에서 위로 `to`로 닦여 바뀌고, 경계에 `accent` 색의 밝은 이음매가 지나간다. 높이는 프레임 번호의 순수 함수(`sweep_level`, 인-아웃 이징)다. 대표 조합은 `scanline` → `glossy`.
- `bloom`: 룩이 있으면 기본 0.5, 없으면 0. 컴포지터 Glare(Bloom, 문턱 1.0)라 흰색보다 밝은 픽셀만 번지고 배경은 밝은 픽셀에서 떨어진 곳에서 헥스 그대로다(1080p 프레임 모서리는 정확히 같고, 96x54 테스트 썸네일에서는 번짐이 모서리에 1단계까지 닿는다). 투명 필름은 피사체 밖의 번짐을 잃으니 불투명 배경에 쓴다.
- `dof`: f-stop(예: 4). 초점 거리는 매 프레임 카메라에서 바라보는 점까지다.
- `motionBlur`: 셔터(프레임 단위, 0 초과 2 이하). 카메라와 `subject.keys`를 매 프레임 키프레임으로 넣으므로 블러가 실제 움직임을 본다.
- 룩이 있거나 조명 리그(`three-point` `product` `rim`)를 쓰고 HDRI가 없으면 절차적 소프트박스 스튜디오(어두운 방에 앞왼쪽 키 박스, 위 박스, 뒤쪽 세로 스트립 둘, 오른쪽 필, 피사체 뒤의 낮은 빛)가 반사와 굴절을 준다. `light.rotate`가 방을 돌리고 `light.environment`(#rrggbb)가 물들인다. 카메라는 여전히 `background`를 본다. `light.hdri`에는 파일 대신 번들 이름 `studio` `city` `courtyard` `forest` `interior` `night` `sunrise` `sunset`을 적을 수 있고 `light.rotate`(도)로 돌린다.
- 룩이 있으면 EEVEE 레이트레이싱을 켠다. 단 `toon`이나 `scanline`이 들어간 샷은 끈다. 레이트레이싱을 켜면 EEVEE의 Shader to RGB가 빛을 읽지 못해 띠와 줄 밝기가 평평해진다.

### 스튜디오 필드

| 필드 | 값 | 뜻 |
| --- | --- | --- |
| `view` | `standard` / `agx` / `neutral` | 색 관리 뷰 변환. standard(기본)만 헥스가 정확하다. agx는 밝은 하이라이트를 부드럽게 눕히고, neutral(Khronos PBR Neutral)은 제품색을 헥스에 가깝게 둔다 |
| `light.preset` | `three-point` / `product` / `rim` | 리그. three-point: 앞왼쪽 소프트 키, 넓은 필, 뒤 림. product: 위 박스, 양옆 뒤 세로 스트립, 낮은 앞 필. rim: 강한 뒤 스트립, 약한 키 |
| `light.ratio` | `[key, fill, rim]` | 리그 에너지 배율. 없으면 피사체 종류별 값: organic 1:0.3:0.6, hard 1:0.45:0.9, metal 0.7:0.7:1, glass 0.5:0.6:0.45(강한 림이 유리·액체의 색을 씻어 내므로 림은 약하게, 필은 넉넉히) |
| `subject.ops` | `[{"op": ..., ...}]` | 몸체에 순서대로 적용하고 한 번 굽는다. `bevel`(width, segments), `subdivide`(levels), `remesh`(voxel), `smooth`(factor, iterations), `inflate`(amount, 법선 방향), `displace`(strength, scale, 구름 노이즈). 크기는 장면 단위 |
| `subject.keys` | `[{"frame", "location"?, "rotation"?, "scale"?}]` | 피사체 자체 회전·크기 위에 더하는 변환. 키 사이는 `subject.ease`(기본 inout), 첫 키 전과 마지막 키 뒤는 멈춘다 |
| `scatter` | `{count, shape: sphere/cube/gem, size, radius, flatten, seed, spin, material: trim/body}` | 피사체 둘레에 메시 하나를 공유하는 인스턴스를 `random.Random(seed)`로 놓고 `spin`(도/프레임)으로 돌린다 |
| `denoise` | 불리언 | Cycles OpenImageDenoise(CPU). 같은 기계에서 같은 바이트(확인함) |
| `camera.fill` | 0.1–1 | `radius`를 빼면 피사체 경계 상자가 이동 중 가장 넓은 순간에 화면의 이 비율(기본 0.9)을 차지하게 반지름을 푼다. `elevation`(도, 기본 10)이 높이를, 상자 중심이 `target`을 정한다. dolly는 반지름을 직접 적는다 |

### 검사 명령

- `npm run blender -- <3d.json> --inspect [--shot 이름]`: 장면을 만들고 렌더하지 않은 채 `<shot>/inspect.json`을 쓰고 출력한다. 피사체 출처(`scan` 등), 종류와 비율, 경계 상자, 오브젝트(면 수, 재질, 노멀 맵 여부), 조명 에너지와 위치, 월드, 카메라, `framing`(이동 17프레임에서 상자 모서리가 닿는 최대 `extent`, `cropped`, `small`), `warnings`.
- `--review`: 위 숫자에 더해 앞, 3/4, 옆, 뒤, 반대 옆, 위 여섯 방향에서 각각 맞춰 찍은 `<shot>/review.png`(3열)를 만든다. 타일은 ffmpeg xstack.

### 카메라 이동

모든 프리셋에 `radiusTo`(밀어 들어가기), `heightTo`(크레인), `target`(바라보는 높이, 흉상은 0.3)을 붙일 수 있고 `ease`가 궤도·돌리·이동의 곡선을 정한다(`linear`, `inout` smoothstep, `out` 빠르게 출발해 부드럽게 멈춤). 턴테이블의 회전 자체는 루프가 끊기지 않게 늘 선형이다.

```json
{"name": "reveal", "frames": 90, "fps": 30, "width": 1920, "height": 1080, "samples": 32,
 "camera": {"preset": "orbit", "from": -40, "to": 28, "ease": "inout", "radius": 9, "radiusTo": 7.4, "height": 1.6, "heightTo": 0.8, "target": 0.3, "fov": 30},
 "subject": {"kind": "builtin", "builtin": "head"},
 "look": "scanline", "sweep": {"to": "glossy", "from": 18, "until": 72},
 "material": {"base": "#D8D0C4", "accent": "#7FE8FF", "scroll": 0.04}, "dof": 4, "background": "#05060A"}
```

### 속도

Apple M 시리즈 Mac, EEVEE, 32 샘플, 1080p 기준: 스윕·피사계 심도·블룸을 쓴 head가 프레임당 약 0.9초다. 처음에 head를 `detail` 300으로 조각하는 데 15–20초가 한 번 든다(다른 builtin은 2–3초). 90프레임 히어로 샷이 103초 걸렸다. 960x540으로 렌더하고 `<ImageSequence fit="cover">`가 키우게 하면 프레임당 약 0.4초로 시간이 절반쯤 줄지만, 스캔라인과 와이어프레임은 가는 선이 흐려지고 반짝이므로 1080p로 둔다. glossy·plush·toon·chrome처럼 부드러운 룩에만 쓴다.

속도의 핵심은 두 가지다. builtin 메시는 다듬기·서브디비전을 한 번 구워 두어 프레임마다 다시 계산하지 않는다. 프레임마다 바뀌는 값(스윕 높이, 줄 흐름)은 값 노드가 아니라 장면 사용자 속성을 읽는 Attribute 노드로 넣는다. 값 노드의 기본값을 바꾸면 EEVEE가 재질을 다시 컴파일해 프레임당 10초가 넘게 걸렸다.

## 결정성

같은 사양은 같은 바이트의 PNG를 낸다(이 Mac의 EEVEE·Cycles 모두에서 두 번 렌더해 확인했다. 다른 GPU·드라이버·Blender 판에서 같은 바이트가 나온다고는 주장하지 않는다). `blender_scene.py`가 고정하는 것:

- 샷마다 Blender 프로세스 하나, `--factory-startup`, `read_factory_settings(use_empty=True)`. 사용자 설정이 섞이지 않는다.
- 카메라와 피사체는 `camera_pose`·`subject_pose`라는 프레임 번호의 순수 함수에서 계산해 모든 프레임에 키프레임으로 넣는다(사이는 선형). 스윕 높이(`sweep_level`)와 스캔라인 흐름, 피사계 심도 초점은 매 프레임 넣는다. scatter는 고정 시드다. 블룸은 결정적인 컴포지터 노드다. `--frames 5`만 렌더한 5번 프레임은 전체 렌더의 5번 프레임과 같은 바이트다(테스트가 확인한다).
- EEVEE: `taa_render_samples = samples`, 모션 블러는 `motionBlur`가 있을 때만. Cycles: `samples`, `seed`, `use_animated_seed = False`, `use_adaptive_sampling = False`, 디노이즈는 `denoise`일 때만, `device = 'CPU'`.
- 색 관리: 디스플레이 sRGB, 뷰 변환은 `view`(기본 Standard), 룩 None, 노출 0, 감마 1. `background`와 `material.base`의 헥스가 적은 대로 나온다(테스트가 배경 픽셀을 확인한다).
- PNG 8비트, 압축 15, `use_stamp_*` 전부 끔, 쓴 뒤 tEXt 청크를 지운다. 스탬프와 Cycles가 적는 렌더·동기화 시간이 같은 그림에서 달라지던 바이트였다.

`manifest.json`의 `specHash`는 샷 JSON + 스크립트·모델·HDRI 파일 바이트 + `blender_scene.py`·`blender_builtins.py`·`blender_looks.py`·`blender_studio.py` 바이트, 스캔 흉상을 쓰면 그 파일 바이트 + `GENERATION`의 해시다. 같은 해시이고 요청한 PNG가 다 있으면 건너뛴다. 빌더를 고치면 저절로 다시 렌더된다. 번들 HDRI 이름은 해시에 파일 바이트를 넣지 않는다(Blender 판에 따라 그림이 달라질 수 있다).

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

## 별도 제작 장면의 확인

직접 만든 Blender 장면은 spec 래퍼의 검사·결정성 보장이 자동 적용되지 않습니다. 소스·명령·Blender 버전·시드·출력 경로를 기록하고, 실제 면이 의도한 재질에 연결됐는지 확인합니다. Boolean/변환 후 빈 재질 슬롯이 남을 수 있으므로 재질 데이터블록이 존재한다는 사실만으로 배정 완료라고 판단하지 않습니다. 관련 면의 `material_index`별 개수와 연결된 재질 이름을 조사한 뒤 실제 합성 프레임을 봅니다. 원시 3D 이미지에 더해 최종 타이포·배경·구도를 함께 확인하고, 핵심 동작의 짧은 저장 시퀀스를 검사한 후 전체 타임라인으로 확장합니다. 기술 검사, 시각 관찰, 미검증 재생·청취를 별도로 보고합니다.

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
- `npx tsx --test tests/three-d.test.tsx`: 위 둘과 파일 번호 계산, 마크업 결정성, 그리고 Blender가 있으면 `tests/fixtures/three-d/3d.json`(builtin plush에 scanline → glossy 스윕·블룸·피사계 심도·이징 궤도를 쓴 샷 포함)을 두 번 렌더해 바이트 동일성·배경 픽셀·manifest·부분 렌더 일치를 확인한다(없으면 건너뛴다).
