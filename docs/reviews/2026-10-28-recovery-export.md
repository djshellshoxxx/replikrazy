# Artifact-only recovery export — 2026-10-28

Base a7c3aa9d3deb387cbdef3c749a52e6ff26d57694. This completes the previously
unstarted local record producer, using the existing RecoveryRecord contract and
reader rather than adding a parallel format.

Step 7 can now save metadata for the loaded valid site. The record contains one
validated ArtifactHandle and empty plans/operations/provenance arrays. The
selected input kind and locally captured timestamp are recorded. Original site
bytes, consent, credentials, provider state and signature/trust assertions are
absent. The JSON must satisfy the existing 10 MiB bound. Keep a payload ZIP or
original files separately: metadata cannot recreate missing bytes.

After asynchronous manifest validation, intake, identity and recovery generations
must still match before downloading. An explicit action creates the file; nothing
is persisted automatically. Clearing/replacing a selection suppresses a stale
download. Imported source records remain unchanged.

Validation: 385 tests / 31 files, typecheck/build and diff check passed. Chromium
46 main checks and 18 payload recovery/export checks (including real downloaded
record round-trip and suppressed stale download) passed. Recovery keyboard matrix
76 controls, 16 reflow checks and four cancellation-focus checks; zero page
errors/external requests. Focused read-only review found no concrete issue and
17 focused tests passed. This remains AI review evidence, not independent audit.
Original missing-producer fixture: /workspace/checkpoints/recovery-export-original-failure.log.

Source milestones already published before this slice: 8f8f9de (CI40709662773)
and a7c3aa9 (CI40711686208), both GitHub success, remote SHAs verified. Other owner
branches remain unchanged; no merges, PR approvals, deployment or provider work.
Source branch: chatgpt/intake-read-bounds-20261027.

The accepted local intake/manual export/comparison/recovery workflow is now usable
end-to-end. Remaining acceptance inputs are still missing T-ART-08 fixtures,
manual screen reader, real OS suspension, cross-browser (download denial) and
independent security qualification. External standalone planner integration is
not automatically compatible: preserve its owners and separate schema. No new
host research, private pack recovery or broadened detector/financial policy.
