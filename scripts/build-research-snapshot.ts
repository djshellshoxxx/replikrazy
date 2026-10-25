// Maintainer script: regenerates src/research/catalogue-snapshot.json from the
// published research catalogue. Deterministic (no timestamps).
// Run: node --experimental-strip-types scripts/build-research-snapshot.ts
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildSnapshot } from "../src/research/mapper.ts";

const SOURCE = "docs/research/mirrorkit-v13/catalog/consolidated-providers.json";
const OUT = "src/research/catalogue-snapshot.json";
const bytes = readFileSync(SOURCE);
const snap = buildSnapshot(JSON.parse(bytes.toString("utf8")), SOURCE, createHash("sha256").update(bytes).digest("hex"));
writeFileSync(OUT, JSON.stringify(snap, null, 1) + "\n");
console.log(`${OUT}: ${snap.recordCount} records from ${SOURCE} (sha256 ${snap.sourceSha256})`);
