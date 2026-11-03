# Snow open-base customization: bounded prospective proof

## Current authority and supersession
User: “모델링은 무조건 오픈소스기반으로 커스텀하는방식으로해 처음부터 100% 순수만드는건 안되겠어.”
Use an existing licensed model and rig as the real production base. The generated Starfall illustration is reference only. Earlier primitive-model films and the unimplemented generated-still motion plan remain preserved, superseded rather than deleted. This checkpoint does not replace the open entertainment-film requests.

## Source and license inventory
Official page: https://studio.blender.org/characters/snow/v4/
Official archive: https://studio.blender.org/download-source/files/ba/0f/ba0fe6d810333b1d73c1c359e4dc03cb-6.zip
Archive111580346bytes, SHA-25698d58ef3a07083ede14140bc462cccb55d317062846aa0eb652d2e4a7ac422a6. Safe ZIP inspection found35entries,112080359uncompressed bytes, no absolute/traversal/symlink/encrypted paths. Original extracted separately, no asset overwrite.

Credit: **Snow Rig (CC) Blender Foundation | studio.blender.org**.
Asset license: https://creativecommons.org/licenses/by/4.0/ . Embedded ReadMe.txt explicitly confirms CC-BY and Blender4.1minimum. Embedded cloudrig.py separately declares SPDX GPL-3.0-or-later; do not relabel that code MIT. Keep third-party blend/textures external and untracked; no third-party binary publication at this checkpoint. Our new API tooling remains distinct from the licensed asset. Derived renders must retain attribution and identify modifications.

## Retrospective inspection baseline
Read-only opening used Blender4.3.2, --disable-autoexec, preferences.auto_execute=False and open_mainfile(use_scripts=False). It explicitly skipped bundled cloudrig.py. No bundled Python was executed. Original file header reports Blender4.4.32, so compatibility warning remains open, not ignored.
RIG-Snow contains1494bones; META-Snow396;51mesh objects include rig widgets/helpers plus skin/head/clothing/hair/eye/teeth geometry. Facial/finger corrective shape keys and1217drivers exist. Driver validity in metadata alone is not pose/deformation proof. UDIM pattern paths need tile-aware checking, not false missing-image claims.

## Requirements / scope
- R1: Preserve original asset bytes, attribution and license boundaries; never enable autoexec or execute embedded scripts.
- R2: Produce actual reference pixels retaining source meshes/materials, with explicit modest camera/light/render settings.
- R3: Test ordinary Blender API FK/IK control posing and measured evaluated-mesh response while scripts remain disabled. Stop affected workflow if it requires bundled Python.
- R4: Only after usable baseline, make a small sky-courier material/wardrobe-palette adaptation of existing source meshes, preserve rig/topology, and save to separate generated output. No scratch character primitives, replacement limbs or fake image-based animation.
- R5: Source-only tooling/provenance docs, exact commands and before/after proof. No full timeline, inference installation, paid API, global security change, public third-party binary, or parity claim.

## Ordered tasks and checks
1. Inspect safety/license/material/image/rig data. Complete core inventory; object-linked material slots and UDIM tiles still to verify.
2. Commit this prospective baseline before adaptation code.
3. Make a bounded first-party inspection/render helper with explicit --disable-autoexec gate. Baseline model pose/materials unchanged. Compare evaluated head/wrist/mesh positions before/after ordinary control changes without saving over original.
4. If safe response works, render one source-model frame and one existing-mesh palette/camera adaptation. Inspect saved images at actual output size; name concrete defects rather than declaring quality from metadata.
5. Python syntax, source hash/original archive recheck, actual render exit/texture/pose diagnostics and git diff checks. Repository aggregate tests remain for later integration, not this separate asset-only proof. Stop at representative evidence and report compatibility/rig/creative gaps accurately.

## Observed bounded result (2026-11-03)

First-party helper: `scripts/production/snow_open_base.py`. It requires explicit `--disable-autoexec`, also sets script auto-execution preferenceFalse and uses `open_mainfile(use_scripts=False)`. It never executes bundled texts, saves a blend, regenerates the rig or creates replacement character geometry. Third-party asset must be supplied externally; no blend/texture/UI-source binary is committed.

Exact baseline command:
```
blender -b -t 2 --disable-autoexec -P scripts/production/snow_open_base.py -- --asset /workspace/shared/frameforge-open-assets/snow-v4-original/Snow/snow_v4.2.blend --output /workspace/shared/frameforge-open-assets/snow-proof-v1 --mode baseline --samples 24 --width 720 --height 960
```
Baseline geometry, materials and T-pose were unchanged. Saved `baseline.png`720×960, exit0,10.53seconds total. The actual picture was dark/distant and is not presented as polished art. Original object-linked material slots resolve correctly; all actual UDIM tile paths exist. The four apparent missing `<UDIM>` pattern paths in early inventory were not missing textures.

Pose-test command uses the same asset and helper, `--mode pose-test --output /workspace/shared/frameforge-open-assets/snow-pose-check-v1`. Ordinary FK-head control deformation moved3719evaluated head vertices by maximum0.04997m. FK/IK property switching plus existing upper-arm controls moved wristz from1.330 to0.948m. This proves those sampled controls respond without bundled UI; not every rig/driver/action feature is verified.

Corrected portrait command:
```
blender -b -t 2 --disable-autoexec -P scripts/production/snow_open_base.py -- --asset /workspace/shared/frameforge-open-assets/snow-v4-original/Snow/snow_v4.2.blend --output /workspace/shared/frameforge-open-assets/snow-courier-proof-v2 --mode courier --samples 64 --width 720 --height 960
```
Saved `courier.png`720×960, exit0,57.32seconds total. Actual source head/skin/hair/shirt/pants/shoes/rig remain the base. Changes are source garment diffuse tint nodes (orange/petrol/brown, existing normal/roughness textures retained), ordinary FK arm/head pose, existing ACT lip-corner controls, copied/repositioned source light datablocks, explicit portrait sensor/lens and background. No scratch model, new costume mesh, vehicle or environment was created. The initial customizationv1 was too wide/pale and is preserved separately.

The final saved portrait shows a close3/4 waist-up character with a restrained smile. Smile.L/R evaluate0.62405/0.62400; facial-control deformation maximum0.02140m. The posed forearm is visible, but its hand is outside the deliberate portrait crop, so complete hand gesture/contact is not claimed. Monte Carlo noise is visible, and this is a base-customization proof rather than a final character/look or full scene.

License credit for any shared proof: **Snow Rig (CC) Blender Foundation | studio.blender.org**. Based on CC-BY4.0 source https://studio.blender.org/characters/snow/v4/ ; modified pose, wardrobe palette, lighting and camera as listed above. Embedded GPL CloudRig UI text stayed bundled/disabled and was not copied into MIT tooling.

Original blend SHA-256 `80fd0a81bca90f0efdcdcb98422df0e198ae57f4a1c239e13fb795922779b1fc` remained unchanged before/after every run. Exact original warning: `File written by newer Blender binary (404.32), expect loss of data!`. Local Blender4.3.2 compatibility is proven only for these opens, sampled poses and saved PNGs; no derivative blend was saved. General4.4feature compatibility remains unverified. Driver metadata after evaluation reports1217valid (895simple,322not-simple); that metadata is not proof of every expression or facial action. Bundled-text skip and autoexecFalse are recorded in provenance.

Source/helper hash, original hash, texture paths, material slots, pose responses, modifications and elapsed time are saved in each local `*-provenance.json`; helper bytes are saved beside each proof. Python syntax, diff checks and original archive hash recheck passed. No full timeline, natural acting/playback, synchronization, Frameforge composed scene, professional/reference parity, third-party binary publication or user acceptance is established.

## Prospective short temporal rig check

Authorized next scope: validate three poses, then only if sound render a short silent source-rig motion proof. This extends the existing open-base proof, not the three full entertainment films.
- Two seconds/60frames/30fps, diagnostic480×640, two CPUthreads, modest sampling. Measure three-key-pose elapsed times before committing full-sequence cost.
- Frame0: relaxed arms, neutral/reserved expression and initial gaze. Frame30: small head turn, existing left-forearm gesture and restrained smile. Frame59: settle/recover; no abrupt reset.
- All pose transforms are absolute functions of frame against captured source-control rest matrices. Existing source meshes/rig/material adaptation only; no primitive replacement, generated-image animation, bundled Python, autoexec or derivative blend save.
- Inspect0/30/59 for hand framing, garment/skin deformation, facial continuity and cropping. Stop/fix a concrete failing pose before sequence rendering. Inspect encoded MP4 start/middle/end, dimensions/fps/decode and successive states; playback unavailable must remain unverified.
- Preserve original asset hashes, source credit/license and all earlier stills. New helper/source commit only, no push/merge, broad test run, install, external API, Mac or GPU provisioning.

## Temporal proof outcome

Three actual source-rig key poses0/30/59 were rendered before the sequence. The first camera clipped fingertips at30/59 (projectedx1.02–1.03); a single fixed-camera widening from65mm to52mm was tested in a new preserved folder. Corrected key images retain both hands and show coherent sampled elbow, head and face deformation. Those3poses took25.63seconds total at480×640/Cycles24. No extra character geometry, texture synthesis or bundled script was used.

Exact sequence command:
```
blender -b -t 2 --disable-autoexec -P scripts/production/snow_open_base.py -- --asset /workspace/shared/frameforge-open-assets/snow-v4-original/Snow/snow_v4.2.blend --output /workspace/shared/frameforge-open-assets/snow-motion-preview-v1 --mode motion-preview --samples 16 --width 480 --height 640 --fps 30
python3 scripts/production/encode_snow_motion.py --frames /workspace/shared/frameforge-open-assets/snow-motion-preview-v1 --output /workspace/shared/frameforge-open-assets/snow-rig-motion-proof-v1.mp4
```
All60frames rendered in468.23seconds with two CPUthreads; both commands exited0. The head turns, source lip-corner expression builds and recovers, and existing forearm raises/settles. Poses use absolute frame curves against captured source-control matrices, not accumulated motion. Recorded gesturing-hand control bounds stay within the camera across all60frames (maximumprojectedx0.96299); saved key/intermediate/decoded samples show the complete gesturing hand. This is not certification of every skin/contact vertex.

Output `snow-rig-motion-proof-v1.mp4`: H.264,480×640,30fps,60frames,2.000seconds, intentionally no audio. Encoder uses the actual60PNGs without interpolation or frame substitution, adds diagnostic/CC-BY labels, and preserves original raw frames. Video SHA-256 `f1ac20dc2bb5e70a561949297811a4fdc27093c401f4e44c02614517a9d81b59`. Sidecar `.provenance.json` records asset credit/license, frame hashes, helper hash, encoder command and output hash. Source-frame helper SHA-256 `78a3d18eab0f70d12ce8feb0ed17e866d3bead5767b491b97e65aae64453e55e`.

Actual checks: full FFmpeg decode exit0; ffprobe metadata matches above; `node scripts/frame-check.mjs <video>` PASS (end-motion test skipped because film under4seconds); `node scripts/flash-check.mjs <video>` PASS, zero detected flashes. Sampling noise itself contributes to image differences, so these diagnostic passes do not establish natural acting or visual polish. Python syntax and diff checks passed. Original blend hash remained unchanged; autoexecFalse; no derivative blend saved and no third-party binaries added to repository.

Self-review inspected raw0/15/29/30/31/59 plus encoded0/15/29/30/31/45/58/59. No obvious sampled jump appeared around the peak29–31 or recovery58–59; source-model face/arm relationships and visible hand framing carry in those samples. The decoded contact sheet is a resize-only inspection aid, not playback evidence. Normal-speed video viewing was not performed by this author. The low16sample proof is visibly grainy, has no full-body weight transfer/contact or finished character acting, and is neither a Frameforge composed entertainment film nor Higgsfield/reference-parity evidence. Full12-second films and creative acceptance remain open. Blender4.4-file/4.3-runtime compatibility warning still applies.

## Source-publication gate record

This change publishes first-party MIT helper code and provenance/verification documentation only. Snow blend/textures remain external CC-BY inputs, and embedded GPL UI source is neither copied nor executed. The abandoned generated-still motion plan is explicitly superseded before implementation and is not revived or included as a production solution. Existing remote experimental history is preserved.

Local checkpoint source: ad13aee plus this documentation/index/changelog update. Actual scoped proofs and checks are recorded above. Publication-integration checks run once for this checkpoint:
- Python compilation of both first-party helpers: PASS.
- `node node_modules/typescript/bin/tsc --noEmit`: PASS, exit0 (installed compiler, no registry fetch).
- `node --import tsx scripts/benchmark.ts`: PASS,1554matches, no differences.
- Build equivalent `node node_modules/typescript/bin/tsc --noEmit && node node_modules/vite/bin/vite.js build`: PASS, exit0; existing module-level `use client` bundler warnings retained.
- `git diff --check`: PASS.
- Required repository-wide `npm test`: NOT RUN for this source-only publication checkpoint. No new full-suite pass is claimed; it remains an integration/merge gate. Earlier differently sourced test results are not reused as proof.
- Video-entry determinism lint: NOT APPLICABLE to these standalone Blender/FFmpeg helpers, which are not Frameforge composition entries. No new engine composition or deterministic saved-render replay is claimed.
- Plugin validation / scripts/assets self-checks: NOT APPLICABLE; no skill, manifest or scripts/assets file changed.
- CI, PR approval, merge and main update: NOT PERFORMED by this checkpoint. PR remains draft, with creative acceptance and full-film work open.
