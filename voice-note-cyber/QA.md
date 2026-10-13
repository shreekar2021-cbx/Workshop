# Verification

Verified on 13 October 2026 using Chrome and a real Groq API key.

- Production build: passes JavaScript syntax checks and creates the standalone deployment artifact.
- Automated server/queue tests: 12 passed (`npm test`). Covers English/Telugu language validation and forwarding, validated AI actions, bounded input, missing keys, invalid keys, rate limits, network failures, timeouts, unsupported/empty audio, silence metadata, active Groq model fallback, transcript order, retries, and unique segment commits.
- Full browser workflow: app load → new note → microphone capture using a spoken test audio fixture → actual audio upload to Groq Whisper → progressive transcription during recording → additional ordered segments → stop → manual edit → save → notes list → reopen → refresh → real Groq summary → real Groq insights → real Groq recommendations → original text unchanged → TXT download verified → print view → PDF file generated → confirmed deletion → refresh confirms deletion.
- Notes: empty state, create, edit, save, reopen, delete cancellation, confirmed deletion, and persistence after refresh passed.
- Reports: all three live Groq actions passed. Results survive refresh and remain separate from the original note.
- Error UI: denied microphone permission, absent microphone, busy microphone, unsupported MediaRecorder, transcription rate limits, and AI failure messages passed. Manual typing and saving remain available after microphone errors.
- Recovery: failed recorded audio survives refresh. Retrying commits its text once; a further refresh does not duplicate it. Existing text and unsaved drafts remain intact.
- Responsive layout: widths 1440, 1024, 768, and 390 checked without horizontal overflow. Desktop and mobile screenshots inspected.
- Export: TXT includes the actual note and selected generated sections; the print/PDF view removes workspace controls and includes the chosen report content.
- No application JavaScript runtime errors observed during the full browser workflow.

Tests use isolated browser storage and temporary fixtures. No example notes, fake transcriptions, or fake AI reports ship in the app. Hardware-specific microphone behavior still depends on the user’s browser, permissions, and device.

## English and Telugu update

Live Groq checks returned HTTP 200: English transcription (0.68s), English summary (0.95s), English insights (1.24s), English recommendations (1.15s), and a Telugu summary (1.10s). These are individual measurements, not latency guarantees.

Browser checks passed for exactly two language choices, remembered selection after refresh, Telugu language forwarding with recorded audio, selection locking during recording, and mobile layout. That forwarding check used an isolated API fixture; spoken Telugu transcription accuracy has not yet been evaluated with a Telugu audio sample.

## Notebook-only home page

The app opens directly into the notebook at `/`. Existing `/notebook`, `/notebook/`, and `/notebook.html` links open the same page. Production-artifact checks confirmed that all four paths serve the notebook and that the removed landing styles and scripts return 404. The production build and browser checks for create, save, edit, reopen, refresh persistence, navigation, confirmed deletion, deletion after refresh, and absence of JavaScript runtime errors passed.
