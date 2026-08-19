# Bad Code

`bad-code` is a small prototype for a browser-based coding workspace. It contains a React frontend and a Node.js/TypeScript backend that creates per-project workspaces, synchronizes files with S3-compatible storage, and exposes a shell terminal.

This folder is intentionally an example of an early, rough implementation. It is useful for understanding the original architecture and for comparing it with `good-code`; it is not production-ready.

## Architecture

```text
Browser
  |
  | HTTP POST /project
  v
Backend (Express + Socket.IO, port 3001)
  |                       |
  | S3 copy/download/save  | node-pty
  v                       v
S3-compatible storage     backend/tmp/<replId>
                              ^
                              |
                    file tree, editor, terminal
```

### Frontend

- `frontend/src/App.tsx` provides `/` (landing page) and `/coding?replId=<id>` (workspace page).
- The landing page sends `POST http://localhost:3001/project` with `{ replId, language }`.
- The coding page connects to Socket.IO at `ws://localhost:3001?roomId=<replId>`.
- The editor requests directories and file contents and sends complete file contents when a file changes.
- The terminal uses xterm in the browser and forwards input/output through Socket.IO.

### Backend

- `src/index.ts` loads `.env`, enables CORS, creates the HTTP server, and starts port `3001` by default.
- `src/http.ts` handles `POST /project` and copies `base/<language>` to `code/<replId>` in object storage.
- `src/ws.ts` handles Socket.IO connections and file/terminal events. On connection it downloads `code/<replId>` into `tmp/<replId>` and emits `loaded`.
- `src/fs.ts` reads directory contents and reads/writes local files.
- `src/aws.ts` lists, downloads, copies, and uploads files through `aws-sdk`.
- `src/pty.ts` starts a Bash PTY in the local project directory and routes terminal input/output by socket id.

## Runtime flow

1. Open the frontend and choose a project id and language.
2. The frontend calls `POST /project`.
3. The backend copies the selected S3 template from `base/<language>` to `code/<replId>`.
4. The browser navigates to `/coding?replId=<replId>` and opens a Socket.IO connection.
5. The backend downloads the project into `backend/tmp/<replId>` and sends the initial file tree.
6. File reads and directory expansion use Socket.IO callbacks.
7. Editor changes are written to the local temporary directory and uploaded to S3.
8. A terminal is started with its working directory set to `backend/tmp/<replId>`.

## Prerequisites

- Node.js and npm
- A shell available as `bash` on the backend host (the PTY currently hard-codes Bash)
- An AWS S3 bucket or S3-compatible service containing templates such as `base/node-js/`
- Credentials and endpoint access for that storage service

## Configuration

Create `backend/.env` with values appropriate for the storage provider:

```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_ENDPOINT=https://s3.example.com
S3_BUCKET=your-bucket
PORT=3001
```

`S3_ENDPOINT` can be omitted for standard AWS S3. Do not commit real credentials.

The frontend currently uses hard-coded local URLs in `src/components/Landing.tsx` and `src/config.ts`:

- HTTP API: `http://localhost:3001`
- Socket.IO endpoint: `ws://localhost:3001`

## Local development

Install and start the backend:

```bash
cd backend
npm install
npm run dev
```

In another terminal, install and start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the frontend terminal, normally `http://localhost:5173`.

For a backend production-style run:

```bash
cd backend
npm run build
npm start
```

For a frontend production build:

```bash
cd frontend
npm run build
```

## Socket.IO events

| Direction | Event | Purpose |
| --- | --- | --- |
| server -> client | `loaded` | Sends the initial root file tree |
| client -> server | `fetchDir` | Loads a directory and receives a callback result |
| client -> server | `fetchContent` | Reads a file and receives a callback result |
| client -> server | `updateContent` | Saves a complete file and uploads it to S3 |
| client -> server | `requestTerminal` | Starts a PTY for the socket |
| client -> server | `terminalData` | Sends terminal input |
| server -> client | `terminal` | Sends terminal output |

## Known limitations

- There is no authentication or authorization; the Socket.IO origin is `*` and `roomId` is trusted from the handshake.
- Project ids are not checked for collisions or safe path characters.
- S3 operations and socket handlers have limited error handling and no clear lifecycle cleanup for temporary projects.
- Every editor update sends the full file and writes directly to S3; updates are not throttled or versioned.
- PTY execution is host-level Bash execution and should not be exposed to untrusted users.
- The backend package currently imports `cors`, but `cors` is not listed in `backend/package.json`; install it or add it before building.
- The S3 copy operation is intended to support continuation tokens, but the recursive call currently passes the original token.
- The implementation assumes a single backend process and local temporary storage.

## Relationship to `good-code`

`good-code` contains the refactored layout for the same general idea. Its frontend is separate, while backend responsibilities are split into `init-service`, `orchestrator-simple`, and `runner`, with Kubernetes ingress configuration under `k8s/`.
