# Consumer packages plan — comparison, what-if, deployment bundle (2026-10-29)

Status: **plan only**. The owner chose plan-only. This document writes no code
and freezes nothing until the owner confirms it.

## 1. Baseline (checked 2026-10-29)

- Latest handoff: `chatgpt/planner-integration-20261028` @ `80878309`
  (documentation head). The tested source is `50785458`. Draft PR #4 targets
  `chatgpt/intake-read-bounds-20261027` @ `a09d7b1`.
- Checked again in a fresh worktree at `80878309` with Node 22: typecheck passes;
  392 canonical tests pass (32 files); 166 planner tests pass; samples are up to
  date; build passes. PR #4 check `test` succeeded (run 40727058849).
- `99d0b68` and `d1f2a58` are ancestors on `chatgpt/intake-read-bounds-20261027`.
  They are history, not the latest ref. The tip of `claude/offline-mirror-planner`
  (`03d5523`) has the same tree as `abb7c31`, so it is already in the integration.
- **The supplied packages were not received.** No package specs or DTOs are in
  the session, any branch, the PRs or the issues. Everything below comes from the
  current source. If the real packages arrive, they replace §3–§4 wherever the
  two disagree.

## 2. Things that must not change

- `main`, all `claude/*` and `chatgpt/*` branches, the checkpoint branch, the
  research branch, and `docs/research/mirrorkit-v13/`.
- Canonical contracts: `src/contracts/publish-plan.ts` (PublishPlan, planId,
  expiry), `intended-use.ts` (consent and rights gates, `exportUseBlockers`),
  `manifest.ts` (artifactId), `canonical.ts` (RFC 8785), the `recovery-*`
  validators and `src/core/compare.ts`. Consumers import these. They do not
  edit them.
- Recovery, browser and keyboard work is done and tested. Do not rebuild it.
  The bundle consumer **calls** the existing validators (`validateManifest`,
  `verifyPlanId`, `validateArtifactHandle`, `validateRecoveryPlan`, `readZip`).
- The planner (`tools/offline-mirror-planner`) keeps its own schema. Nothing
  converts it to canonical. A filtered planner subset is never presented as a
  canonical artifact.
- Out of scope: network calls, provider probes, host signup, credentials,
  mirror publication, provisioning, deployment, environment switches, and
  retrying denied browser navigation.

## 3. Packages (proposed)

New directory: `src/consumers/`. These are pure functions over in-memory bytes
or objects. No DOM, no fetch, no worker. UI wiring is a later, separate slice.

### A. Comparison consumer — `src/consumers/comparison-report.ts`
Input: a `Comparison` from `compareInventories` plus the reference `artifactId`.
Output: `ComparisonReportV1` as canonical JSON with a `reportId` digest.
- The verdict is `identical` or `differs`. The report always says that byte
  equality is not verification of live content (MK-VER).
- Changed, missing and extra entries are sorted in UTF-8 order with exact
  sizes and hashes. They are reported but not judged.

### B. What-if consumer — `src/consumers/what-if.ts`
Input: an existing `PublishPlan` (its `verifyPlanId` must pass and it must not
be expired), the inputs it was built from, and a `WhatIfScenario`. A scenario
can swap the use category, keep a subset of destinations, or toggle the backup
flag.
Output: a `WhatIfResultV1` with a per-target status diff from the base plan.
- It re-runs the existing pure assessment and `buildPublishPlan` in memory and
  discards the hypothetical plan object. The result has **no planId, no
  consent fields and no export path**. Every export entry point rejects it,
  and tests assert this.
- It cannot loosen gates. `ownerHasRights` cannot be set to true by a scenario.
  Payment and token uses stay blocked. A scenario can only show *why* a target
  is blocked or allowed.
- The base plan's `expiresAt` caps the result. An expired base is rejected
  with the existing `MK_EVIDENCE_STALE`, and a planId mismatch with
  `MK_PLAN_CHANGED`. No new ErrorCode is added.

### C. Deployment-bundle consumer — `src/consumers/bundle-check.ts` + `scripts/bundle-dry-run.mjs`
Input: local ZIP bytes, read through the existing `readZip` limits.
It accepts two readers and detects which one applies. It never converts
between them:
1. Canonical handoff: `app/` plus `mirrorkit-control/`. Check the
   `artifact-manifest.json` canonical bytes, then check that `artifactId`
   matches the app bytes. `publish-plan.json` must pass `verifyPlanId` and its
   expiry check. The manifest's file list must equal the files under `app/`
   exactly: nothing extra and nothing missing. `mirrorkit-control/` is marked
   never-upload.
2. Planner bundle: `offline-mirror-plan/`. Check `SHA256SUMS` against `site/`,
   and check the `plan.json` schema version. Planner policy is reported as
   planner policy, not canonical policy.

Output: `BundleCheckV1` plus a dry-run step list for each destination. Every
operation has `remoteMutation: false`. The CLI reads a local path, prints JSON,
and exits non-zero on any blocker. It has no flags that contact a host.
- Fixtures go in `tests/fixtures/bundles/`. They are produced by the existing
  exporters (deterministic `FIXED_MTIME`), plus tampered variants. A
  `--check` regeneration step runs in `npm run test:all`.
- A test stubs `fetch` and `node:net`/`node:http(s)` so that any call fails.
  The CLI and the consumer must pass under that stub.

## 4. DTOs (proposed. Freeze them in `src/consumers/dto.ts` before workers start)

```ts
import type { Digest } from "../contracts/manifest";
import type { Diagnostic, ErrorCode } from "../contracts/diagnostic";
import type { UseCategory } from "../contracts/intended-use";

export interface ComparisonReportV1 {
  schema: "replikrazy-comparison-report"; schemaVersion: 1;
  reportId: Digest; artifactId: Digest;
  verdict: "identical" | "differs"; liveVerified: false;
  counts: { matching: number; changed: number; missing: number; extra: number };
  changed: { path: string; expectedSize: number; actualSize: number; expectedSha256: string; actualSha256: string }[];
  missing: string[]; extra: string[];
}

export interface WhatIfScenario {
  category?: UseCategory;            // ownerHasRights deliberately absent
  keepTargets?: string[];            // subset only; cannot add unknown targets
  backupConfirmed?: boolean;
}
export interface WhatIfResultV1 {
  schema: "replikrazy-what-if"; schemaVersion: 1; hypothetical: true;
  basePlanId: Digest; artifactId: Digest; validUntil: string; // = base expiresAt
  scenario: WhatIfScenario;
  targets: { targetId: string; baseMode: "manual" | "disabled"; whatIfMode: "manual" | "disabled"; addedBlockers: Diagnostic[]; removedBlockers: Diagnostic[] }[];
}

export type BundleKind = "canonical-handoff" | "planner-bundle";
export interface BundleCheckV1 {
  schema: "replikrazy-bundle-check"; schemaVersion: 1;
  kind: BundleKind; ok: boolean;
  artifactId?: Digest; planId?: Digest; planExpired?: boolean;
  uploadRoot: "app/" | "offline-mirror-plan/site/"; neverUpload: string[];
  files: { path: string; size: number; sha256: string; status: "match" | "changed" | "missing" | "extra" }[];
  errors: { code: ErrorCode; path?: string }[];
  dryRun: { targetId: string; steps: { id: string; kind: "manual-handoff" | "verify"; remoteMutation: false }[] }[];
}
```

## 5. Ownership and concurrency

Each worker gets its own worktree and branch, cut from the frozen-DTO commit.
No two writers touch the same file. Workers may not edit `dto.ts` or anything
listed in §2. If a worker needs a DTO change, it asks the lead.

| Owner | Branch | Exclusive files | Model |
| --- | --- | --- | --- |
| Lead | `claude/peaceful-shannon-4egtbv` | `src/consumers/dto.ts`, `src/consumers/index.ts`, `package.json` scripts, `vitest.config.ts`, CI, `docs/plans/*`, handoff docs | Opus |
| Worker A | `…-4egtbv-compare` | `src/consumers/comparison-report.ts`, `tests/consumers/comparison-report.test.ts` | Sonnet (small, mechanical) |
| Worker B | `…-4egtbv-whatif` | `src/consumers/what-if.ts`, `tests/consumers/what-if.test.ts` | Opus (policy-gate sensitive) |
| Worker C | `…-4egtbv-bundle` | `src/consumers/bundle-check.ts`, `scripts/bundle-dry-run.mjs`, `scripts/bundle-fixtures.mjs`, `tests/fixtures/bundles/**`, `tests/consumers/bundle-check.test.ts`, `tests/consumers/no-network.test.ts` | Opus (boundary parsing) |
| Reviewer | read-only | none (writes review notes through the lead) | Opus, not the author's instance |

A, B and C run in parallel. C's fixtures depend only on the existing
exporters, not on A or B.

## 6. Integration gate (per worker branch)

1. TDD: the failing test is committed first, and its failure output is kept in
   the review note.
2. The reviewer does an adversarial pass: gate loosening, export path for
   what-if, schema conversion, network reach, and unbounded reads.
3. The lead merges into the lead branch only after `npm run typecheck`,
   `npm run test:all` and `npm run build` pass and the diff touches only that
   worker's files.
4. The lead opens one draft PR against the integration line (base: the
   owner's choice, §7) and keeps CI green. No approvals, merges to main or
   deployments.

## 7. Owner decisions needed before code

1. Send the actual "supplied" packages, or confirm §3–§4 as the spec.
2. Confirm the DTO field names in §4. They are frozen once confirmed.
3. Choose the PR base: `chatgpt/planner-integration-20261028` (the latest
   integration, recommended) or `chatgpt/intake-read-bounds-20261027`
   (canonical only, without the planner reader in C).
4. Decide whether UI wiring for A, B and C is wanted now. The proposal is a
   later slice, owned by the lead only, because `src/ui/main.ts` belongs to
   the canonical line.
