# Reproduce the NEW reconstructions

No original bytes are included or claimed restored. Work-in-progress, not accepted final films.

Requirements: Node24, official npm dependencies (`npm ci`), Blender4.3.2, Python3/numpy, FFmpeg, installed DejaVu Sans including `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf`, working standard Chromium renderer. No paid APIs/downloaded assets.

Source: `scripts/production/entertainment_scenes.py`, `entertainment_audio.py`, and three `examples/samples/*-reconstruction/` folders. Scene code is standalone authored Blender, not bundled3d.json; its own provenance is written beside frames. Audio is new original synthesis, not preserved original score. Generated media belongs under ignored public paths.

Representative production (one process at a time):
```
blender -b -t 2 -P scripts/production/entertainment_scenes.py -- moonpost --frames 196 --samples 32 --engine eevee --output public/assets/generated/moonpost-reconstruction/eevee-proof
```
Choose new output folders for revisions; maker refuses existing frame overwrite. For same-frame comparison, run Cycles with the same frame/dimensions and a separate output. Source hash is captured at process start. No denoising is enabled: this Blender build reports no OpenImageDenoise support. Noise/finish must be inspected, not called equivalent to denoised Cycles.

After representative/action review, render0–359 into the corresponding `scene` folder; don't full-render merely because these commands exist:
```
blender -b -t 2 -P scripts/production/entertainment_scenes.py -- starfall --frames 0-359 --samples 32 --engine eevee
python3 scripts/production/entertainment_audio.py starfall
npm run render -- examples/samples/starfall-reconstruction/entry.tsx StarfallReconstruction renders/samples/starfall-reconstruction-v1.mp4
```
Moonpost ID `MoonpostReconstruction`, music ID `NeonTideReconstruction`, slug `neon-tide-reconstruction`; replace both slug and ID appropriately. WAV maker preserves existing output. All finals360 frames/30fps; Starfall/Neon1080×1920 and Moonpost720×1280.

Local standard Frameforge representative command attempted2026-11-03 failed `Chrome did not write DevToolsActivePort within10s`. No sandbox flag/ownership modification attempted. Permitted cloud composition rendering still required. Raw scene proof is not composed typography review. Full-film render/decoding/actions/flash/seam/audio/playback/listening remain pending; successful source lint is not final quality acceptance.

## First actual proof observations (not final acceptance)

- Cycles Starfall142 native1080×1920/64 samples:04:34.16 elapsed. Pilot/scooter/star contact read, but oversized gold arches competed with pilot, pale surfaces and weak scene hierarchy. Follow-up source reduces arches, uses perspective rather than orthographic environmental projection, converts sRGB colors to scene-linear correctly and reduces cool fill. NOT yet re-rendered.
- Cycles Moonpost210 native720×1280/64 samples:01:57.37. Raw proof shows disconnected boots, cropped wing/house, viewer-facing gaze. Follow-up adds trouser legs, wider framing, right-directed head/window response; letter rotates flat before entering the narrower slot and hand remains behind it through support transfer. NOT yet re-rendered.
- Original Cycles Neon210 attempt stopped through its exact owned exec session (exit130) after excessive cost; no PNG generated. Logs retained locally.
- Local EEVEE Moonpost196 attempt emitted `EGL_BAD_MATCH`, no PNG or progress evidence; stopped through its exact owned session (exit130). No sandbox/security flag changes or path changes attempted. EEVEE suitability remains NOT VERIFIED on the separate cloud renderer.
- All three initial brief checks and determinism lints passed; TypeScript passed after shot-specific DOM revisions. These do not prove finish or full timeline execution.
- Typography now changes by narrative role: opening identity, short goal cue, brief post-storage feedback, unobstructed insertion/reaction, final condition/reward lockup. Neon reconstruction provenance is a discreet footer, not artistic headline. No permanent scoreboard/title stack.

Pending: corrected composed representative frames, adjacent action proof, practical cloud renderer selection, all360 final source frames, full MP4s and saved final/action/transition checks. Do not merge this source checkpoint as completed creative acceptance.

## Coordinated local source checkpoint

All further pictures are explicitly reduced-size previews (Starfall/Neon540×960, Moonpost360×640), not final1080/720 portrait deliverables. Native Cycles64 took274s Starfall and117s Moonpost under earlier concurrent workload; coordinated12–16sample previews take about4–22s. A local software EEVEE run with repository-standard LP_NUM_THREADS=1 succeeded161s at360×640/64samples despite EGLwarnings; that route is not a practical speed improvement here. Source now sets both Cycles and EEVEE sample counts,2CPUthreads, fixed seed and nonadaptive Cycles. No renderer security flag or permission changed.

Saved proof folders (under ignored `public/assets/generated/`):
- Starfall `coordinated-preview-v4/0142.png` and `action-preview-v5/0141–0143,0156–0159.png`; v5 revealed incomplete deposit and159 head/hand snap, so `action-preview-v6/0156–0160,0270,0330.png` is the scoped follow-up.
- Moonpost `action-preview-v5/0196,0214,0215,0240,0282,0291,0300.png`; `action-preview-v6/0214–0216,0225–0227,0240.png` verifies later dark-window and hand-outside-slot correction.
- Neon `coordinated-preview-v5/0300.png` removes clipped reflection-card geometry and horizon seam seen in v4.

Each process records source SHA at startup and actual frame settings in provenance. Latest source also saves maker source bytes and per-frame elapsed timings beside its output; that metadata addition does not imply older folders contain those fields. No whole-film quality acceptance, full-frame determinism, listening, normal-speed viewing, native-resolution finish, composed overlay review or original-byte recovery is claimed. Standard local Frameforge still fails Chrome DevTools startup; root has a separately verified compatible cloud renderer, but new-source remote publication/transfer is pending explicit approval. No public push/upload performed by author.

### Consequential proof outcome and ownership

Starfall: pre-contact star is world-owned at the predicted meeting position; hand contact90/142/198, hand carries to the bag rim98/150/210, releases there; gravity-style drop into the moving satchel completes106/158/218. Count is authorized only after those storage frames. V6 saved156/157/158/159 shows a small tip clearing the rim before disappearing into the bag, with hand/gaze retained rather than the old159 snap. This is sampled reduced-size evidence for the second pickup, not proof of all three full actions.270/330 are cape/landing diagnostic frames, not full reward motion.

Moonpost: letter is hand-supported through approach/rotation/slot push196–214, supported by mailbox at215, hand withdraws215–231; window remains dark225, starts warming226, visibly lights240. V6 saved214/215/216 confirms no obvious changed-prop appearance at the sampled support transfer. Geometric nonpenetration of every contact surface is not certified. The close insertion framing intentionally crops part of the left wing; the240 wider shot restores the world triangle. Saved282/291/300 from v5 shows contact/compression/recovery, not continuous landing playback. Full three-letter collection action remains unverified.

Neon: v5 saved300 demonstrates corrected camera-visible geometry and readable lettering only; the music-led transitions and all360-frame title continuity remain unverified.
