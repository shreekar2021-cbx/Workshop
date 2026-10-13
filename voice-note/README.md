# ECHO — Thought interface

A futuristic, animated notebook: browser-local notes, Groq Whisper voice transcription, and Groq summaries, important insights, and recommendations. No containers, accounts, database server, framework, or runtime dependencies.

## Run

Requires Node.js 22.13 or newer.

```sh
npm install
cp .env.example .env
```

Set the server-only value in `.env`:

```env
GROQ_API_KEY=your_key_here
```

If `.env` already exists, edit it instead of copying over it.

```sh
npm start
```

Open http://localhost:3000 directly into the notebook. Existing `/notebook`, `/notebook/`, and `/notebook.html` links also open the same notebook. For automatic server restarts during development, use `npm run dev`. The same server serves the frontend and API. No separate backend setup is needed.

Allow microphone access. Recording requires HTTPS in deployment or localhost during development. All transcription and AI processing runs through GroqCloud; the browser only records audio. Notes, drafts, generated reports, and failed audio segments are kept in IndexedDB in this browser. Clearing browser site data removes them. Changing domains uses a separate local notebook.

Choose English or Telugu beside the recording control before speaking. These are the only supported voice language choices; English is the default. The backend validates the selection and passes it explicitly to Groq Whisper. Each audio segment keeps its language for retries. AI reports respond in English or Telugu according to the note content.

## Deploy

On any Node host, deploy this directory, set `GROQ_API_KEY` as a private environment variable, set `HOST=0.0.0.0`, and run `npm start`. The server respects the host’s `PORT`. Use HTTPS for microphone access. Do not publish `.env` or expose the server key in frontend configuration.

`npm run build` checks frontend JavaScript and produces a standalone Worker module in `dist/server/index.js` for Sites hosting, with `.openai/hosting.json`. This is an additional hosting option; ordinary Node deployment needs no build or container. Configure `GROQ_API_KEY` as a secret in the hosted runtime.

## Verify

```sh
npm test
npm run build
```

Tests cover API validation, safe error messages, model fallback, silence, ordered segment delivery, retries, and duplicate prevention. Test fixtures are isolated from the app; the app never simulates AI responses.

## Behavior

- Notes contain only `id`, `title`, `content`, `createdAt`, and `updatedAt`. Drafts and reports use separate browser stores.
- Each recording segment is a complete WebM/MP4/Ogg file, sent approximately every 8 seconds. Requests are serialized to preserve order. Successfully committed audio is removed atomically with draft storage; failed audio remains for retry, including after refresh.
- The editor remains editable during recording and AI generation. Draft changes are kept locally. Save adds or updates a note in the notebook.
- AI results are separate from the original note and tied to its exact text. Editing the note hides stale results until regenerated.
- TXT exports the current editor content. Select “Include generated information” to add the available report sections. Print / PDF opens the browser print dialog with a clean report; select Save as PDF.
- Server defaults: `whisper-large-v3-turbo` and `llama-3.3-70b-versatile`. If unavailable, the server queries Groq’s Models API and selects a supported active Groq-hosted fallback. No other provider is used.

Visual reference: https://pin.it/5t89w2d8S. Its modular composition and light/dark contrast are adapted to the prompt’s neutral palette, without gradients or decorative imagery.

## ECHO interface

Both former variants share this implementation. The cyber entry point links to this directory; changes only need to be made here. See the workspace README for shortcuts, search, animation controls, and performance improvements.
