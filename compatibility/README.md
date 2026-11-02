# Recorded compatibility oracles

`paths.json` is the original historical oracle and remains byte-for-byte unchanged.
`paths-runtime-linux-x64-node24.22.1.json` supplements exactly three cases for
Linux x64, Node 24.22.1, V8 13.6.233.17-node.58 and the recorded transcendental
fingerprint. Other runtimes, fingerprints, cases, or inputs use the original
expectations. Comparisons remain exact; this does not add a tolerance or skip.

## Why the paths supplement exists

On 2026-11-02 an independent public-export replay of the official
`@remotion/paths@4.0.537` package reproduced Frameforge's two arc-index residuals
and two coordinates in one sine-warp case exactly. The historical oracle's
runtime was not recorded. The sine callback itself yields the differing values;
accumulated arc lengths also depend on transcendental rounding. No production
geometry change was warranted.

The replay evaluated all 1,582 existing inputs. Frameforge passed every case
against the current reference using the existing comparison rules (including the
previously established bounding-box tolerance). There were exactly three
numerical differences from the historical oracle. An additional error-message
change reflects an original Infinity input serialized as JSON null; both calls
throw, and that case and its existing assertion are unchanged.

## Provenance and scope

The supplement records the original fixture SHA-256, independently captured
reference output SHA-256, generator SHA-256, lockfile SHA-256 and official npm
package URLs/integrities. The generator and raw replay evidence are retained
outside the repository, as CONTRIBUTING.md requires; no reference implementation
source was read or copied. The public root export `PathInternals.debugPath`,
listed in the package's `.d.ts`, was used for the debug cases.

The reference was installed in an isolated personal-evaluation directory with
`--ignore-scripts`, not as a Frameforge dependency. Actual license files were
checked: paths is MIT; its pinned `remotion@4.0.537` dependency uses the Remotion
license under the personal-evaluation assumption documented in
`docs/legal/remotion-license-review.md`. Automatic MIT peer dependencies and
integrities are recorded too.

The selector does not examine Frameforge outputs. It checks runtime identity and
a SHA-256 fingerprint of fixed sine/cosine/acos probes, including the semicircle
sample grid and differing sine callback inputs. This fingerprint is a guard,
not a claim of universal numerical equivalence. No other platform or Node/V8
version has been certified. Future runtime support requires a fresh independent
reference replay, not broadening the selector or copying Frameforge outputs.

Focused verification:

```sh
node --import tsx --test tests/packages-math/paths.tsx tests/paths-runtime-oracle.test.tsx
```
