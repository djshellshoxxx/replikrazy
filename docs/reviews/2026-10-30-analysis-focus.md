# Intake/comparison cancellation focus — 2026-10-30

Continuation of 4c471ef on chatgpt/local-workflow-20261030 (PR6). Both source CI runs 41033639711 and 41036064450 passed; no external ref changes observed. One integrator, no new workers.

Existing recovery behavior already restored focus, but intake/comparison hid their focused Cancel buttons. Focus fell onto body (empty activeElement.id). Chromium reproduced this before the fix; original assertion retained at /workspace/checkpoints/analysis-focus-original.log. A shared UI helper now returns focus to the corresponding ZIP/folder picker only when the disappearing button held focus. Background completion/cancellation preserves unrelated focus. Clear paths also avoid leaving focus on hidden Cancel controls. Worker cancellation, generations, safety gates and data are unchanged.

Validation: npm run test:all passed (395 canonical, 166 planner, samples unchanged); npm run build passed. New scripts/browser-analysis-focus.mjs uses existing installed Chromium on canonical localhost preview: eight LTR/RTL focus assertions, including unrelated-control preservation, zero page errors/external requests. This mocks a pending analysis worker to make cancellation deterministic; it is not real OS suspension, manual screen-reader or independent acceptance. No denied planner navigation/download retries.

Commands: npm run test:all; npm run build; preview on 127.0.0.1:4174; BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node scripts/browser-analysis-focus.mjs. TEST_ORIGIN can point to another existing canonical localhost preview.

Remaining product gates are unchanged: source-pinned T-ART-08/fixtures, manual accessibility and independent security acceptance. Consumer-package scope is still a proposal. PR6 now includes the comparison root fix and this bounded adjacent accessibility correction; no release or deployment claimed.
