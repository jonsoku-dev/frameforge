# Implementation Plan: Browser startup diagnostics
**Branch**:`fix/chrome-startup-diagnostics-20261103` | **Date**:2026-11-03 | **Spec**:[spec.md](spec.md)

## Summary
Capture a bounded stderr tail and explicit launch/close state in the existing openPage lifecycle; report real early failures without changing browser flags or readiness semantics.

## Technical Context
Node24 ESM renderer; existing node:test/tsx fixtures. No new dependency, storage or public API. Platforms remain installedChrome/macOS/Linux. Scope: scripts/render.mjs, tests/render-startup.test.tsx, existing cleanup mock, docs/reference/rendering.md, CHANGELOG.md. Error diagnostics are the only intended externally visible change.

## Constitution Check
Independent implementation:pass; minimal scope:pass; no security change:pass; normal repository gates required:pass. Rechecked after design: no deviations.

## Project Structure
Existing renderer and tests stay in place. This feature directory holds prospective artifacts and evidence. Official Spec Kit1.2.6 scaffolding adds .specify/ and .agents/skills/; existing .agents/plugins remains untouched.

## Design
Use stderr pipe while ignoring stdin/stdout, continuously drain it and retain only last8000bytes. Record spawn error and process close including exit/signal. Before each readiness read reject recorded early failures with status and diagnostic tail; live browser retains10s deadline with same timeout wording plus tail. Cleanup must not await exit from a process that failed to spawn. Successful startup follows unchanged CDP code.

## Verification Strategy
First add focused failure fixtures and demonstrate current failure. Cover ENOENT, early exit0/nonzero/signal, stderr empty/overflow, live readiness timeout, no output, owned-process cleanup. Keep existing cleanup test compatible with a real piped ChildProcess shape. Run scoped node:test then installed TypeScript, npm test, benchmark, build. No changed compositions/assets/manifests: video lint, Python checks and plugin validator not applicable. Renderer gate: short exact-main baseline and after render plus snapshot-diff; local browser may block it, in which case root's known-good cloud must establish it. Do not waive that gate or run CI.

## Complexity Tracking
No architecture expansion or new helper module. Single coding author. No independent review required absent unresolved risk.
