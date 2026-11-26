# Verification · 2026-11-25

## Automated

`npm test`: 5/5 tests pass. JavaScript syntax check passes.

## Browser core-flow verification

Checked in the Codex in-app browser using fictional test data:

- Entered birth date 1990-06-15 and a test name; the timeline rendered correct ages and 10 post-birth historical entries.
- Added a 2008-09-01 university memory in Beijing; Olympics association appeared with both date and location explanations.
- Reloaded; profile and memory persisted.
- Edited the memory title; associations updated to the new title.
- Opened related-history view; matched historical cards appeared with explicit reasons.

## Limits

History is a curated 12-entry dataset, not complete global coverage. Matching is deterministic and does not assert causality. No paid services or AI APIs are used. Automated tests do not replace full cross-browser accessibility testing.

## Social import release

- `npm test`: 17/17 passing, including X archive, Instagram/Facebook JSON, CSV quoting, UTC rollover, leap dates, malformed inputs, deduplication, Meta Unicode, preserved provenance and matching integration.
- Browser: pasted three fictional posts; preview correctly reported one ready, one duplicate and one missing date. Corrected the missing date and imported two. Existing memory remained, and all three persisted after reload.
- Browser: selected the downloadable CSV template through the native file chooser and imported two records. Reimporting the same file reported two duplicates and disabled confirmation; cancel kept the count unchanged.
- Browser: tested the import dialog at 390 × 844; form and review remain within the viewport and scroll inside the dialog.
- Imported records display platform attribution. Editing preserves provenance; backup serialization and revalidation are covered by tests.
- No live social account credentials or personal social exports used; all fixtures are synthetic. Actual export variants outside the documented schemas, OAuth, screenshot OCR and media import are not supported.
