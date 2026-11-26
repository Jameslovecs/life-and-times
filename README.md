# Cisheng · A Life in Time

A Chinese-language personal biography website that connects your memories with world history. Enter your birth date, record life events, and discover the historical context around them. No account or API key required.

## Live website

[Try Cisheng](https://jameslovecs.github.io/life-and-times/)

## Features

- Generate a personal and historical timeline from your birth date, with birthday-aware ages.
- Add, edit, and delete memories with topics, locations, and notes.
- Import social posts from supported JSON, CSV, and X archive files, with editable previews and duplicate detection.
- Discover explainable connections based on time, topic, and location; associations update as you add memories.
- Switch between the combined timeline, personal memories, and related history, with historical topic filters.
- Explore 12 curated historical events, each linked to its original institutional source.
- Save records in browser local storage, export or import JSON backups, and clear saved data.
- Explore a fictional example without overwriting your personal records.
- Use a responsive interface with native form validation and keyboard-accessible dialogs.

## Run locally

Python 3 is required for the local server. The npm commands and tests require Node.js 18 or later. There are no third-party dependencies, so `npm install` is unnecessary.

```sh
git clone https://github.com/Jameslovecs/life-and-times.git
cd life-and-times
npm start
# Open http://localhost:4173
```

Run tests in a separate terminal:

```sh
npm test
```

You can also start the server directly with `python3 -m http.server 4173 --directory dist`. Serve the files over HTTP; opening `index.html` directly with a `file://` URL does not support the app's ES module imports.

## Free deployment

The public repository uses GitHub Pages. The workflow in `.github/workflows/pages.yml` runs tests and deploys `dist/` after pushes to `main`. In the repository's **Settings → Pages → Source**, select **GitHub Actions**. The workflow uses GitHub's automatically provided short-lived token; no manually created secrets are required. No paid APIs, databases, or subscriptions are enabled.

You can also deploy `dist/` to any static HTTPS hosting service. The `.openai/hosting.json` file identifies the original Sites project. When copying this project, remove that file or replace its identity with your own; do not reuse the original site ID.

## Data and privacy

Personal records are stored only in the current site's browser local storage under `cisheng-v1`; they are not submitted to a server. Sharing the public website URL shares the product, not your personal biography. The app includes no analytics scripts, advertisements, or remote fonts. Following a historical source link opens that external website.

Clearing browser data, ending a private browsing session, or changing devices can result in lost records. Export backups regularly. Data is not shared between hosting domains; use JSON export and import to move it.

## Matching rules

`dist/engine.js` implements the matching logic as testable pure functions:

- A historical event within one year of a memory: +5 points; otherwise, within three years: +3.
- A topic or memory text matching an event tag: +3.
- Matching location text: +4.
- A match scoring at least 3 points is shown with its specific reasons.
- The timeline is sorted by date and shows historical events only between your birth date and today.

Connections are contextual clues, not claims of causation. The app does not invent an event when the history dataset has no entry for your birthday. Ages increase on each birthday; for a February 29 birthday, the age increases on March 1 in non-leap years.

## Expand the history dataset

Edit `dist/history.js`. Each entry contains `date` (a verified ISO date), `title`, `category`, `place`, `tags`, `text`, `source`, and `url`. The category values used by the Chinese interface are `科技` (Technology), `社会` (Society), `文化` (Culture), and `世界` (World).

Verify primary sources before writing a short, original summary. Do not add unverified events or copy long article excerpts. Run `npm test` to check the data and core rules.

## Current scope and limitations

This is a working MVP with a curated dataset, not a complete historical encyclopedia. It contains 12 events from 1945 through 2024; other years may have no historical entries.

The app does not include live news, generative AI, cloud synchronization, accounts, public sharing of personal biographies, photo uploads, or full biography generation. Locations use text matching rather than geocoding, so not all aliases are recognized. These limitations do not prevent local journaling and historical matching.

## Verification

`npm test` covers calendar validation, birthday boundaries, association updates, unrelated events, import validation, and source URL formatting. Social import tests also cover supported export formats and duplicate handling. See [QA.md](QA.md) for browser verification notes.

## Import social posts

On your personal timeline, click **Import social posts** (`导入社交动态`). Select a file or paste content, then click **Parse and preview** (`解析并预览`). Correct dates, titles, text, topics, and locations as needed, select the entries you want, and click **Confirm import** (`确认导入`).

Imports append to your existing memories; they do not replace them. Canceling saves nothing. Importing into the fictional demo profile is disabled, so create your own birth-date profile first.

### Supported formats

These structures are supported; compatibility with every historical export version is not guaranteed.

| Format | Supported fields and containers |
| --- | --- |
| X / Twitter | Extracted `tweets.js`, `tweet.js`, archive parts, or JSON; `tweet.created_at`, `full_text`, and `id_str` |
| Instagram | Post JSON arrays or `ig_posts` / `posts` containers; `media[].creation_timestamp` and post or media `title` |
| Facebook | Post arrays or `posts` / `your_posts` containers; `timestamp` and `data[].post` |
| Generic JSON | Arrays or `events` / `posts` / `tweets` / `statuses` / `data` / `media` containers; `date` / `timestamp` / `created_at` and `text` / `content` / `note` / `title` |
| CSV | `date,text` columns, optionally `platform,id,title,category,place,url`; also supports Chinese date/text/location headers, quoted commas, newlines, and a UTF-8 BOM |

Download the [JSON example](dist/samples/social-events.json) or [CSV template](dist/samples/social-events.csv), also available in the import dialog. All sample records are fictional. Use strings for `id` values to avoid precision loss with large integers.

### Import behavior

- **Dates:** `YYYY-MM-DD` values remain unchanged. ISO timestamps with time zones, X timestamps, and Unix seconds or milliseconds are converted to **UTC dates**. Timestamps without a time zone and ambiguous month/day formats are not guessed; correct them in the preview.
- **Context:** Chinese and English keywords suggest editable topics. Imported text, locations, and dates participate in the existing history matching. The platform, original timestamp, and original post's HTTPS link are retained in each memory's `origin` metadata and included in backups. Editing a memory preserves its provenance.
- **Duplicates:** Entries are duplicates if they share a date and normalized text (or title when text is empty), or a platform and string post ID. Checks cover both the current selection and saved memories. Without a stable ID, changing the imported date or original text may require manual deduplication. Identical same-day text across platforms is also treated as a duplicate.
- **Validation:** Future dates, dates before your birth, missing dates or text, and oversized fields are flagged with reasons. Correct them before importing. Duplicate entries are skipped automatically.
- **Limits:** Each file or pasted input can be up to 5 MB and 5,000 records, displayed 20 per page. The profile supports up to 1,000 total memories. Titles are limited to 80 characters, text to 2,000, and locations to 80. Oversized text must be shortened by the user and is not silently truncated. Generated titles use the first 80 characters while preserving the full text in the preview.
- **Saving:** Success is reported only after local storage is written successfully. If storage is unavailable or full, the preview stays open with an error; the import is not partially saved.
- **Security:** Files are parsed as data only. A strictly recognized X archive assignment wrapper is removed before `JSON.parse`; archive scripts are never executed. Imported text is escaped for display, and source links allow only HTTPS URLs without embedded credentials. Files are not uploaded, and platform tokens are not read.
- **Not yet supported:** OAuth or direct API account connections, scheduled synchronization, automatic ZIP extraction, screenshot OCR, and media attachments. Use platform exports or convert other data to the template format. No paid API is needed.

The implementation lives in `dist/social-import.js` (parsing and review) and `dist/social-import-ui.js` (preview interactions). `tests/social-import.test.js` uses synthetic fixtures to cover platform formats, CSV, time-zone boundaries, duplicates, corrections, backup round-trips, and historical associations. It contains no real social data or credentials.
