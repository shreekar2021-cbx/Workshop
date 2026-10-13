# ECHO — Thought Interface 🎙️⚡

> A futuristic, luminous-dark voice notebook powered by Groq Whisper and LLM intelligence. Zero framework bloat, zero heavy dependencies, zero external database servers.

ECHO is an offline-first, browser-local thought capture platform. It combines live voice recording, chunked audio transcription (English & Telugu), and instant AI analysis (summaries, insights, and action points) into a fluid, sci-fi-inspired orbital interface.

---

## 🌟 Key Features

- **Chunked Speech-to-Text**: Captures and streams audio in 8-second self-contained chunks via Groq's high-speed Whisper models (`whisper-large-v3-turbo` with automatic fallback).
- **Multilingual Support**: First-class support for English and Telugu voice recording and transcription.
- **On-Demand AI Insights**: Instant generation of Summaries, Key Takeaways, and Action Items powered by Groq LLaMA models (`llama-3.3-70b-versatile`).
- **Browser-Local & Private**: All notes, drafts, and audio retries reside in browser IndexedDB (`voice-notebook`). Audio is processed server-side only for transcription and never retained.
- **Luminous Cyber UI**:
  - Animated orbital core visualizer & real-time audio signal rings.
  - Particle motion, animated panel boundaries, button shimmer, and ripple micro-interactions.
  - Full support for `prefers-reduced-motion` and persistent manual pause-animation toggle.
  - Zero external UI libraries or Google Fonts—built purely with native HTML5, CSS, and inline SVGs.
- **Resilient & Reliable**: Draft auto-saving, ordered segment delivery, retry pipeline for interrupted audio uploads, and automated test suite.
- **Export Options**: Export notes as Plain Text (`.txt`), formatted AI reports, or print-ready PDF.

---

## 🏗️ Workspace Architecture

The workspace is organized into a shared unified core with backwards-compatible entry points:

```
.
├── README.md               # Main project documentation (this file)
├── .gitignore              # Workspace-wide Git exclusion rules
├── package.json            # Workspace root scripts
├── voice-note/             # Core application & server implementation
│   ├── .env.example        # Environment variable template
│   ├── public/             # Native frontend assets (HTML, CSS, JS, SVGs)
│   ├── server/             # Lightweight Node.js HTTP & API server
│   ├── scripts/            # Build & packaging scripts
│   ├── tests/              # Native node:test suite (12 tests)
│   ├── QA.md               # Quality assurance & verification checklist
│   └── README.md           # Implementation & technical specification
└── voice-note-cyber/       # Compatibility wrapper (symlinked to voice-note/)
    ├── README.md           # Compatibility notes
    └── ...                 # Links to shared implementation
```

> **Note:** Both variants share the exact same codebase in `voice-note/`. Changes made in `voice-note/` immediately reflect across both entry points.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: `22.13+` is required (utilizes native `--env-file-if-exists` and `node:test`).
- **Groq API Key**: A valid API key from [GroqCloud Console](https://console.groq.com/).

### 1. Configure Environment Variables

Create your `.env` file inside `voice-note/`:

```sh
cp voice-note/.env.example voice-note/.env
```

Add your Groq API key to `voice-note/.env`:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

*(Note: The server reads `voice-note/.env` directly. Never commit your `.env` file to source control).*

### 2. Start the Application

From the root of this workspace:

```sh
npm start
```

Or run in development mode with automatic restart on file changes:

```sh
npm run dev
```

### 3. Open in Browser

Navigate to:
```
http://localhost:3000
```

> **Microphone Permissions**: Ensure microphone access is allowed in your browser. Audio recording requires HTTPS in production, or `localhost` during local development.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Cmd / Ctrl</kbd> + <kbd>S</kbd> | Save current note to IndexedDB |
| <kbd>Cmd / Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd> | Create a new note |
| <kbd>/</kbd> | Focus search bar (when not actively editing text) |
| <kbd>Esc</kbd> | Clear search / close modal |

---

## 🔄 Dual Port & Legacy Access

Browser IndexedDB storage is strictly origin- and port-scoped. If you have existing notes previously created on port `3001`, you can launch using port 3001 to retain access to that notebook origin:

```sh
cd voice-note-cyber
PORT=3001 npm start
```

---

## 🧪 Testing & Verification

The project includes an isolated test suite running on Node's native test runner (`node:test`):

```sh
npm test
```

### What is tested (12 Test Cases):
- ✅ Language validation (English & Telugu explicit forwarding)
- ✅ Missing API key graceful degradation & actionable messaging
- ✅ AI action restriction (Summary, Key Insights, Action Recommendations)
- ✅ Input constraints (empty or oversized notes rejection)
- ✅ Groq model fallback on decommissioned or unavailable models
- ✅ Rate-limiting, timeout, and network error handling
- ✅ CORS & forbidden HTTP method protection
- ✅ Audio chunk ordering, segment ID stability, and duplicate prevention
- ✅ Audio retry logic on network interruptions

To test production asset bundling:
```sh
npm run build
```

---

## 🚢 Deployment

The application runs anywhere Node.js 22+ is supported:

1. Deploy the `voice-note/` directory to your hosting provider (e.g., Render, Railway, Fly.io, VPS).
2. Set the environment variables in your deployment dashboard:
   - `GROQ_API_KEY=your_key`
   - `HOST=0.0.0.0`
   - `PORT=8080` (or host-assigned port)
3. Start the application:
   ```sh
   npm start
   ```
4. **Edge / Serverless Workers**: Running `npm run build` compiles a standalone module to `dist/server/index.js` compatible with Sites / Cloudflare runtime specifications.

---

## 📄 License

Private / Proprietary workspace. All rights reserved.
