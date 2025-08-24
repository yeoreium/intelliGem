# IntelliGem — AI Document Assistant (Office Add-in)

**IntelliGem** is an AI-powered Microsoft Word add-in that helps users process documents with intelligence: paraphrasing, summarization, document analysis, and reference finding. It combines a frontend Office Add-in (taskpane) with a Node.js backend that talks to Google Gemini (Generative AI) and optionally Google Custom Search.

---

## Table of Contents

* [Screenshots / Demo](#screenshots--demo)
* [Features](#features)
* [Tech Stack](#tech-stack)
* [Quick Start](#quick-start)

  * [Prerequisites](#prerequisites)
  * [Backend (local)](#backend-local)
  * [Frontend (Office Add-in) — development](#frontend-office-add-in--development)
* [How It Works (Architecture)](#how-it-works-architecture)
* [API Details](#api-details)
* [Development Notes & Tips](#development-notes--tips)
* [Testing](#testing)
* [Deployment](#deployment)
* [Roadmap / Next Steps](#roadmap--next-steps)
* [How to Contribute](#how-to-contribute)
* [File / Folder Reference](#file--folder-reference)
* [Security & Privacy](#security--privacy)
* [License](#license)
* [Contact](#contact)

---

## Screenshots / Demo

<img width="1920" height="1128" alt="Screenshot 2025-08-23 155601" src="https://github.com/user-attachments/assets/56afd56d-7115-42e6-a9ec-7cc7916fca42" />
<img width="1920" height="1128" alt="Screenshot 2025-08-23 155659" src="https://github.com/user-attachments/assets/0b6ddad2-ebfa-4b90-8493-5603b64de78b" />
Link Demo: https://drive.google.com/file/d/1aAnFSo7vKVG15WuDkCQ3mde0jgjwLqns/view?usp=drive_link

## Features

* Paraphrase selected text with change-aware analysis
* Summarize selected text or full document
* Context-aware document analysis and general AI queries
* Seamless Microsoft Word integration using Office.js
* Automation-friendly: backend exposes API endpoints and webhook support

---

## Tech Stack

* **Frontend:** Office Add-in (JavaScript), Webpack, Office.js
* **Backend:** Node.js + Express
* **AI:** Google Generative AI (Gemini) client (`@google/generative-ai`)
* **Utilities:** axios, dotenv, cors
* **Optional persistence:** MySQL or other DB

---

## Quick Start

> The project is split into two parts: `backend` (API) and `intelligem` (Office Add-in frontend). Start both when developing.

### Prerequisites

* Node.js >= 18
* npm or yarn
* Google Cloud API key / credentials for Generative AI (Gemini)
* (Optional) Google Custom Search API key + Search Engine ID

### Backend (local)

```bash
cd backend
npm install
# copy .env.example to .env and fill values
npm run dev   # or `node server_fixed.js`
```

**Example `.env`**

```
PORT=8080
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_PROJECT_ID=your_project_id_here
GOOGLE_LOCATION=us-central1
GOOGLE_MODEL=gemini-2.5-flash
GOOGLE_CSE_KEY=your_google_cse_api_key   # optional
GOOGLE_CSE_CX=your_search_engine_id      # optional
```

**Default backend endpoints**

* `GET /health` — health check
* `POST /api/intelligem` — main AI endpoint

**Example curl request**

```bash
curl -X POST http://localhost:8080/api/intelligem \
  -H "Content-Type: application/json" \
  -d '{
    "action": "PARAPHRASE",
    "text": "This is the text to paraphrase",
    "context": "Optional document context",
    "options": { "tone": "formal" }
  }'
```

**Sample response**

```json
{
  "status": "ok",
  "action": "PARAPHRASE",
  "result": {
    "output_text": "Paraphrased text here...",
    "metadata": { "changes": [/* diff-like structure */] }
  }
}
```

### Frontend (Office Add-in) — development

```bash
cd intelligem
npm install
npm start   # starts webpack dev server (HTTPS, port 3000)
```

* The manifest is at `intelligem/manifest.xml`. Sideload this manifest in Word for testing.
* `src/taskpane/taskpane.html` and `src/taskpane/taskpane.js` contain the UI and Office.js integration.
* `src/commands/commands.js` contains command handlers for add-in commands.

**Sideloading in Word (quick)**

1. Run frontend and backend.
2. Open Word (desktop).
3. Go to **Insert → My Add-ins → Manage My Add-ins → Upload My Add-in** and select `intelligem/manifest.xml` (or use Office Add-in Sideload instructions for your platform).
4. Open the add-in from **Home → Add-ins**.

---

## How It Works (Architecture)

1. User interacts with IntelliGem in Word (taskpane), selects text or uses chat.
2. Taskpane collects context (selection or document) and POSTs to `/api/intelligem`.
3. Backend classifies the request (PARAPHRASE / SUMMARIZE / FIND\_SOURCE / GENERAL), calls Google Generative AI (Gemini) and optionally Google CSE.
4. Backend returns structured results (text, diffs, sources). Frontend renders results and manipulates the Word document via Office.js.

---

## API Details

### POST `/api/intelligem`

**Request body**

```json
{
  "action": "PARAPHRASE|SUMMARIZE|GENERAL|FIND_SOURCE",
  "text": "selected text or input text",
  "document": "optional full document text",
  "options": {
    "tone": "formal|informal",
    "length": "short|medium|long"
  },
  "meta": {
    "userId": "optional"
  }
}
```

**Response**

```json
{
  "status": "ok",
  "action": "PARAPHRASE",
  "result": {
    "output_text": "paraphrased text ...",
    "changes": [
      { "from": "old", "to": "new", "pos": [10, 20] }
    ],
    "sources": [
      { "title": "...", "link": "..." }
    ]
  }
}
```

---

## Development Notes & Tips

* Webpack dev server uses HTTPS (self-signed). Accept the certificate in the browser when testing locally.
* Ensure CORS is enabled in backend so the add-in can call the API.
* Keep prompt templates in a local folder for quick iteration and logging (prompts + responses).
* Limit logging of raw document text in development logs to protect privacy.

---

## Testing

**Manual test plan**

1. Sideload `intelligem/manifest.xml` into Word.
2. Start backend (`npm run dev`) and frontend (`npm start`).
3. Open Word, open the add-in, highlight text and click paraphrase/summarize.
4. Verify results inserted into document and UI displays diffs/sources.

**Automated tests (suggestion)**

* Add Jest / Mocha tests for backend classification and prompt template generation.
* Add UI tests for taskpane components (Playwright / Cypress).

---

## Deployment

* **Backend:** Deploy to Railway / Heroku / Google Cloud Run. Set env vars (GOOGLE\_API\_KEY, project id, etc.).
* **Frontend:** Build static assets and host on a secure HTTPS origin (update `manifest.xml` SourceLocation). Or run webpack dev server behind a proxy in production.
* **Publishing:** Before publishing to AppSource, ensure manifest URLs point to a public HTTPS origin and follow Microsoft validation guidelines.

---

## Roadmap / Next Steps

* [ ] Multi-language support (EN / ID)
* [ ] Improve paraphrase change-detection UI (inline diffs)
* [ ] Add collaboration features (comments, multi-user)
* [ ] Analytics dashboard for usage insights
* [ ] Add user auth & rate limiting for production

---

## How to Contribute

1. Fork the repository.
2. Create a branch: `git checkout -b feat/your-feature`.
3. Implement changes and tests.
4. Open a PR and describe changes clearly.
5. Add screenshots for UI/UX changes.

Follow existing code style. Add unit tests for backend logic and lint your code before submitting.

---

## File / Folder Reference

* `backend/server_fixed.js` — main server logic & AI integration
* `backend/package.json` — backend dependencies & scripts
* `intelligem/manifest.xml` — Office Add-in manifest (sideload)
* `intelligem/src/taskpane/taskpane.html` — add-in UI
* `intelligem/src/taskpane/taskpane.js` — Office.js & UI logic
* `intelligem/src/commands/commands.js` — add-in commands
* `intelligem/webpack.config.js` — frontend build config
* `intelligem/babel.config.json` — transpilation settings

---

## Security & Privacy

* Never commit API keys or credentials to the repo. Use `.env` and CI secrets.
* Consider adding a privacy policy if storing user document data.
* Minimize document text logging; mask PII when logging is required.

## Contact

**Reisya Pratama**
Email: [reisyaprtm@gmail.com](mailto:reisyaprtm@gmail.com)
LinkedIn: [https://www.linkedin.com/in/reisya-pratama-bb2ba0306/](https://www.linkedin.com/in/reisya-pratama-bb2ba0306/)
GitHub: `[yeoreium](https://github.com/yeoreium/)` & `[reisyaprtma](https://github.com/reisyaprtma/)` 
