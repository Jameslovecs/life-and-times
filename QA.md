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
