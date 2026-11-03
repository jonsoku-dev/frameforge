# Tasks: Browser startup diagnostics
## Phase1: Setup
- [x] T001 Install official workspace-local Spec Kit1.2.6 and inspect installed definitions.
- [x] T002 Capture retrospective baseline separately in research.md; specify/clarify/plan prospective scope and quality checklist. No material ambiguity remains.
## Phase2: Foundational
- [x] T003 Commit official scaffolding, constitution and analyzed planning baseline before application code.
## Phase3: User Story1 - Diagnose startup failures
Independent test: controlled browser launch failure reports reason promptly, leaves no output/scratch, bounded diagnostics.
- [x] T004 [US1] Add regression fixtures in tests/render-startup.test.tsx for FR-001/002/003/004; prove existing implementation fails.
- [x] T005 [US1] Implement bounded startup diagnostics in scripts/render.mjs; update cleanup mock pipe shape in tests/render-cleanup.test.tsx.
- [x] T006 [US1] Run focused regression/cleanup checks and inspect actual local browser error.
## Phase4: Delivery
- [x] T007 Update docs/reference/rendering.md and CHANGELOG.md; record evidence mapping.
- [ ] T008 Run mandatory TypeScript/full test/benchmark/build/plugin-validation gates and actual baseline-after render comparison. Record any blocked gates without claiming pass.
- [ ] T009 Execute installed analyze/converge guidance, inspect final diff and commit verified fix. Publication/merge only after required gates established, separate from PR26 rejected films.

Dependencies:T001→T002→T003→T004→T005→T006→T007→T008→T009. Single coding author, no parallel edits; documentation inspection can run alongside checks but adds no independent implementation task. MVP is the single complete startup diagnostic story, not a series of speculative features.

## Phase5: Convergence
- [ ] T010 Close T008/T009 renderer evidence in a working authorized environment: exact-source full suite and main1166 baseline/candidate90frame snapshot comparison. Current local341suite fails15 environment-dependent tests.
- [ ] T011 Close T008/T009 official-skill host validator gate: `claude plugin validate .` when an authorized host is available; local host command is absent. Do not install unrelated host tooling or claim substitute checks pass this gate.
