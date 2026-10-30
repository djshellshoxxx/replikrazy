# ZIP directory and metadata boundary checkpoint

Scope: changed ZIP parser ranges only, using parent-supplied MK-ART-002/003
and existing source. No missing private specification was needed. No full
research text imported. No provider/browser download or publication operation.

## Fixes and retained failure evidence

Five initial new fixtures failed against `1cf27b0`:
- invalid directory components were skipped;
- a trailing slash bypassed symlink/encryption rejection;
- directory local-name and other local-header conflicts were accepted;
- a forged CRC matching an understated DEFLATE prefix silently truncated data;
- an understated EOCD entry count hid remaining central records.

The prefix fixture retains 10,000 ASCII x bytes with a declared size of 100
and CRC32 `0x5e0e5d8f`, independently checked with Python zlib for the first
100 bytes. One sentinel output byte now exposes overflow without an unbounded
buffer; maximum temporary inflation allocation is declared size plus one byte.

A disjoint read-only reviewer reproduced two additional metadata conflicts:
nonzero per-entry disk start, and tampered streaming data descriptors. Both
regressions first failed, then passed after fixes. Descriptor validation accepts
signed and unsigned ZIP32 forms, checks CRC and sizes, rejects missing records,
and includes descriptors in overlap checks. Bit-3 local placeholders may be zero
or match the central value; conflicting nonzero values fail. Valid empty stored/
deflated directories and streaming app-only exports continue to round-trip.

All failures remain as tests. No original fixture, cap, regex budget, fuzz seed
or acceptance oracle was weakened. ZIP64 remains unsupported.

## Results

- 13 files / **176 tests passed**, typecheck/build/diff check passed.
- Chromium **35 regression checks**, including invalid directory paths and
  conflicting local-header error presentation; zero page errors/external requests.
- **16 axe scans / 16 reflow checks**, 156 keyboard controls reached, zero
  violations/page errors/external requests.
- Independent reviewer: **58 focused ZIP/fuzz/export tests passed**, diff check
  passed; both reproduced findings fixed, no remaining concrete issue in this
  targeted verification. Not a full security audit.

## Exact remaining conformance gaps and next ranges

Line references are at this checkpoint and may move in later work.

| Gap | Next implementation range | Input or decision |
| --- | --- | --- |
| Approximate case folding, no pinned full Unicode data | `src/core/paths.ts:58` foldKey and collision callers | Choose/version a complete case-fold data source; no new hosting research needed. Keep existing rejection until proven. |
| Wrapper validation precedes explicit root stripping; missing entrypoint can be chosen after hashing | `src/core/intake.ts:49` finish, `src/core/pipeline.ts:31` runAnalysis, `src/ui/main.ts:160` refreshIdentity | Design a bounded preflight/root/entrypoint phase. The two supplied specs suffice; avoid relaxing existing path safety. |
| Wall-clock hard stop instead of active parser budget + continue | `src/ui/analysis-task.ts:17` run | Retain stricter stop. Relaxation requires explicit owner approval; real suspension timing remains untested. |
| Incomplete proposed private-data detectors | `src/core/analyze.ts` SENSITIVE and `src/core/scan.ts` SECRET_PATTERNS | Need exact synthetic acceptance cases from `09_ACCEPTANCE.md`, T-ART-08 and its private-data fixtures, before claiming broader detector coverage. |
| Partial public-operation Result coverage and versioned record handling | `src/contracts/manifest.ts:42`, `src/contracts/publish-plan.ts:114`, `src/ui/main.ts:347` download | No importer currently authorizes records. Scope the next local operation boundary; do not add deferred auth/publish records. |
| Unknown-version read-only retention not implemented | Future record importer; no current code range | Needs a separately scoped import UX. For recovery/persistence UX, request the exact recovery/import section referenced by MK-CTR-007 rather than infer it. |
| Manual workflow/qualification policy beyond current claims | `src/providers/select.ts`, `src/providers/types.ts`, adapter claim definitions | If expanding, request `03_POLICY_AND_TARGETS.md` MK-POL-002/003/004/006. No expansion in this batch; financial/trust gates unchanged. |
| Cross-browser/manual screen reader/full audit | Existing browser runners; no automatic full-audit path | Browser download denial remains binding. Owner needs an authorized browser-equipped environment and human screen-reader review. |

Broader unsupported schema versions, MIME verification and other proposed
records remain outside this bounded slice; do not claim full pack availability
or overall conformance. Private reference provenance is documented separately.
