# Research and reconstructed baseline
Recorded after existing implementation, before this repair, from exact main1166cbebb1d6f670d2957816443036e263fe75ee.

scripts/render.mjs openPage spawns Chrome with stdio ignored, discards error events and polls DevToolsActivePort for10seconds. Thus a failed spawn/early exit becomes a generic timeout. Existing tests/render-cleanup.test.tsx exercises scratch removal ordering with a mock process. Production root-local integration on prior exact source had12 explicit startup timeouts and2 readiness cancellation precondition failures; known-good cloud passed334/334 on that source, demonstrating environment-dependent failure rather than proving its precise cause.

Decision: retain bounded stderr and lifecycle state, no launch flag changes. Use process close so stderr is drained before reporting early exit. Keep the readiness budget unchanged. No unknown design questions remain. Captured stderr is local error text, not uploaded automatically; diagnostic output may include machine paths.

Tool provenance: official https://github.com/github/spec-kit README recommends uv tool install specify-cli. Workspace-only install resolved1.2.6, matching stable official tag commit9eacc24ffe47eadf035a3af601e4dabfb15b8fde. Init used installed bundled assets, no network templates. Actual --version, init --help, init, resolve-template and setup-plan commands ran; skill stages are agent-guided definitions, not invented CLI subcommands. No extension hooks registered.
