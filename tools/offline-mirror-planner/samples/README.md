# Sample exports

Generated from the built-in synthetic demo by `node scripts/export-samples.cjs` with a fixed timestamp (`2026-10-27T00:00:00.000Z`). All content, names and addresses are fictional; no onion or I2P address appears because none was generated. `node scripts/export-samples.cjs --check` verifies these files match the current engine.

- `demo-draft/` — the demo as shipped: bait files excluded, two unsafe paths rejected, destinations in mixed states, so `planState` is `draft`.
- `clean-ready-for-manual-review/` — clean demo site with fully declared operator-managed destinations; `planState` is `ready-for-manual-review` (still unverified).

Each contains `offline-mirror-plan/` (plan.json, SHA256SUMS, destinations.json, per-destination INSTRUCTIONS.md and inert templates) and `offline-mirror-plan-bundle.zip` (the same plus `site/` with the site files byte-for-byte). Verify a bundle with `unzip offline-mirror-plan-bundle.zip && cd offline-mirror-plan/site && sha256sum -c ../SHA256SUMS`.
