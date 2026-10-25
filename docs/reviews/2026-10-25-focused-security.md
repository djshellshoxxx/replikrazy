# Focused local security review — 2026-10-25

A separate read-only reviewer inspected `d54a3f7` while the integrator remained
the only writer. Scope: worker lifecycle, intake/comparison boundaries, export
policy and resource caps. This is not a complete audit, release qualification,
or proof of provider compatibility. No provider actions were performed.

## Original reproducible findings

| Severity | Original failure | Fix and regression |
| --- | --- | --- |
| High | 5,000 HTML files with two advisory findings each exhaust the 10,000-finding cap; a later synthetic secret gets no retained blocker. | Truncated scans block assessment and UI export. Origin/file relationships are also bounded; truncated reference and missing lists are reported. Test preserves the late-secret ordering and original caps. |
| High | Saved plan JSON `null` crashes restoration after rights revocation, leaving a stale manual plan exportable. | Validate stored shape and exact status values; ignore inherited properties. Both download handlers independently check shared global policy. Browser regression seeds `null` and revokes rights. |
| High | App-only export remains enabled with rights unchecked or payment/token use. | Share record validation, rights and sensitive-use blockers across assessment, button state and download handlers. Browser regression covers both buttons. |
| Medium | A valid `__proto__` filename changes the payload ZIP tree's prototype; output has unrelated entries and loses the original file. | Use fflate's entry-stream API for payload files. Exact filename/byte round-trip test includes prototype-related names. |
| Medium | An original archive with a rejected traversal entry compares its valid subset and reports “intact.” | Refuse comparison when original intake has errors, matching the existing copy-side check. Browser regression covers both sides. |

The review found no further concrete defect in worker ownership, queued-message
suppression or late-message deadline checks. It does not establish absence of
other defects.

## Original failures retained

The first attempted ZIP fix used a null-prototype input map. The new exact-name
regression still failed inside `fflate.zipSync` with
`TypeError: Cannot read properties of undefined (reading 'level')`, because
fflate internally flattens into an ordinary object. The fixture was not weakened;
payload export now supplies names as entry values through `ZipPassThrough`.

One intermediate typecheck also caught a missing `SCAN_LIMITS` test import;
the import was corrected before final validation.

## Validation at this checkpoint

- 12 test files / 152 tests pass, including all prior 144 tests.
- Typecheck, production build and `git diff --check` pass.
- Chromium production-preview regressions: 22 checks, zero page errors,
  zero external requests. Includes storage-denied behavior.
- Reusable browser runner: `scripts/browser-regressions.mjs`. Install optional
  `playwright-core` in an external tooling directory, start production preview
  on `127.0.0.1:4173`, then run with `BROWSER_TEST_TOOLS=<directory>`.
- No fuzz seed, hostile-regex budget, original fixture oracle or limit was relaxed.
