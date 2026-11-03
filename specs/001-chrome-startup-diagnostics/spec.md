# Feature Specification: Actionable browser startup failures

**Feature Branch**: `fix/chrome-startup-diagnostics-20261103`
**Created**:2026-11-03
**Status**: Ready for planning
**Input**: User requests autonomous Frameforge engine/plugin improvement. Production exposed opaque browser startup failures; bounded repair only.

## User Scenarios & Testing
### User Story1 - Diagnose failed browser startup (Priority:P1)
A creator whose installed browser cannot start receives its real launch failure promptly rather than an unrelated10-second readiness timeout.
**Why this priority**: Production integration failures repeatedly hid the underlying cause.
**Independent Test**: Simulated launch failure/early process termination must reject without a readiness deadline wait and without publishing output.
**Acceptance Scenarios**:
1. Given a missing executable, rendering reports the operating-system launch error.
2. Given a browser that exits or is signalled before readiness, rendering reports exit status/signal and available diagnostic output.
3. Given a live browser that never becomes ready, rendering retains the10-second readiness limit and includes available diagnostics.
4. Given successful startup, rendering, cancellation and scratch cleanup retain their current behavior.

### Edge Cases
Empty diagnostic output, output larger than the diagnostic limit, invalid readiness file, normal exit code0 before readiness, signal termination and nonexistent executable must not hang or publish output.

## Requirements
### Functional Requirements
- **FR-001**: Distinguish launch errors and early browser termination from a live readiness timeout.
- **FR-002**: Include available recent browser stderr, bounded to the last8000 bytes; empty output must remain readable.
- **FR-003**: Keep the existing10-second readiness budget, browser flags/security model, API signatures and successful render behavior unchanged.
- **FR-004**: On failure, stop only the owned browser and remove its render scratch tree before rejection; never publish incomplete output.

### Key Entities
Transient browser process state and a bounded in-memory stderr tail only; no persistent data or database.

## Success Criteria
- **SC-001**: Early failures reject within2seconds in controlled regression fixtures instead of waiting10seconds.
- **SC-002**: All failure cases have an actionable classification and retain bounded available diagnostics.
- **SC-003**: Focused regressions, repository integration gates and a real baseline/after render comparison pass, or exact environment blockers remain explicitly open.

## Assumptions and Boundaries
No browser install/repair, no sandbox bypass, no remote logging, no new CLI option/dependency. This improves diagnosis; it does not claim to repair this executor's Chromium environment.
