# Verification evidence

## Source isolation
Clean baseline1166cbebb1d6f670d2957816443036e263fe75ee; prospective official setup/planning commit1014868. No PR26 film assets, models, production helpers or rejected creative sources are in this branch. Installed Spec Kit1.2.6 uses workspace-local tools; official template license retained. Existing .agents/plugins untouched.

## Behavioral mapping
- FR-001: render.mjs/openPage launchError/exit state; regression exit42 on original code failed after10030ms with generic timeout. Final controlled spawn-error/exit/signal/empty cases reject in54–70ms. Actual local Chrome rejects in477ms with SIGABRT and socket() Operation not permitted/crashpad stderr. No security workaround attempted.
- FR-002: bounded Buffer tail, continuous stderr draining; overflow regression drops prefix and retains last marker. Final stderr after exit is retained. Empty stderr remains readable.
- FR-003: unchanged Chrome argument array; live timeout fixture retains10s (10033ms). A descendant-held pipe regression failed initial implementation then passed104ms with bounded100ms drain. Successful pixel parity remains OPEN pending real comparison.
- FR-004: all controlled failures leave no output/scratch; existing cleanup shutdown-order/retry regression still passes. Cancellation integration requires working Chrome.

## Commands and outcomes
- `node --import tsx --test tests/render-startup.test.tsx tests/render-cleanup.test.tsx`: final8/8 pass0fail,12.752s, exit0. Raw log `/tmp/frameforge-startup-final.log` is local-only.
- `node node_modules/typescript/bin/tsc --noEmit`: final source pass, exit0.
- `npm run benchmark`: final source pass1554matches0differences,exit0.
- `npm run build`: final source pass,exit0.
- `npm test`: intermediate source before final held-pipe refinement340total325pass15fail0skip,154.591s,exit1.14 browser-dependent environment failures; one unchanged Blender fixture cannot import pyopenvdb. The same failure classes were previously observed on unchanged source. This is not final-source integration acceptance. Raw log `/tmp/frameforge-diagnostics-npm-test.log` is local-only.
- `claude plugin validate .`: blocked, command not found,exit127. No host-tool install attempted.
- `git diff --check`: pass.
- Actual before/after90frame render + snapshot-diff: NOT_RUN in working renderer environment; local Chrome cannot launch. Required gate remains OPEN.
- No changed film entries, assets Python or plugin manifests: composition lint/assets selfchecks are not applicable. Added official agent skills still require host plugin validator above.

## Completion status
Source checkpoint only. Full exact-source integration, real rendering parity and plugin validator remain mandatory before merge. No film quality claim or engine acceptance is implied by test totals.

## Exact committed-source local integration
`npm test` on c5910540ca6bafe2d8ce6f4acf589cf1ef5f4595 / tree06d7387935e5f98ebaeeaf309d5ce426bef336b1 completed341total326pass15fail0skip,160.371s,exit1. Source/tests had no uncommitted changes. All15 failing test names exactly match the intermediate environment run; no new failure names.13 error records expose SIGABRT startup diagnostics, cancellation fixtures cannot reach readiness, and the unchanged Blender fixture still lacks pyopenvdb. This remains a failed integration gate, not acceptance.

Local raw log `/tmp/frameforge-diagnostics-c591054-npm-test.log`, SHA256d6713654b4299c9fc8d935b58942f7d9a40d2c47a438a3d0955e804b7a41e5c0. Successful integration and pixel parity require the working renderer environment; no security settings were changed.

Installed convergence guidance assessed the implementation against spec/plan/tasks after prerequisites succeeded. No additional application-code requirement gap identified. Remaining evidence gates are explicitly refined in T010/T011, not waived or marked complete.
