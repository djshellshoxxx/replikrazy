// Byte-preserving inventory: path, size and SHA-256 of every file, plus a
// bundle digest over the canonical manifest so two inventories of the same
// bytes and names always compare equal.

import type { BundleFile } from "./intake";
import { compareUtf8 } from "./paths";

export interface InventoryEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface Inventory {
  entries: InventoryEntry[];
  totalBytes: number;
  bundleDigest: string;
}

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer: subtle.digest rejects SharedArrayBuffer views.
  return hex(await crypto.subtle.digest("SHA-256", bytes.slice()));
}

// One line per file, "sha256 size path\n", sorted by UTF-8 byte order. Paths
// cannot contain newlines (validatePath rejects control characters).
export function canonicalManifest(entries: readonly InventoryEntry[]): string {
  return [...entries]
    .sort((a, b) => compareUtf8(a.path, b.path))
    .map((e) => `${e.sha256} ${e.size} ${e.path}\n`)
    .join("");
}

export async function buildInventory(files: readonly BundleFile[]): Promise<Inventory> {
  const entries: InventoryEntry[] = [];
  let totalBytes = 0;
  for (const f of files) {
    entries.push({ path: f.path, size: f.bytes.length, sha256: await sha256Hex(f.bytes) });
    totalBytes += f.bytes.length;
  }
  entries.sort((a, b) => compareUtf8(a.path, b.path));
  const bundleDigest = await sha256Hex(new TextEncoder().encode(canonicalManifest(entries)));
  return { entries, totalBytes, bundleDigest };
}
