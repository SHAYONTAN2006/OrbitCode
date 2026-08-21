# OrbitCode

OrbitCode is a browser-based coding workspace. It contains a React frontend, an orchestrator API, and ECS runner containers. Projects are copied from S3 templates into per-repl workspaces, where users can browse and edit files, use a shell terminal, and run JavaScript or Python files.

This implementation provides the core OrbitCode workflow: create a project from a language template, browse and edit its files, persist changes, and work in an interactive terminal.

## Architecture

```text
Browser
  |
  | POST /project
  v
Orchestrator (Express, port 3000)
  |                  |
  | S3 copy          | ECS RunTask
  v                  v
S3 bucket       ECS Fargate runner
                     |
                     | Socket.IO, HTTP, port 8080
                     v
              file tree, editor, terminal, run output
```

### Frontend

- `frontend/src/App.tsx` provides `/` (landing page) and `/coding?replId=<id>` (workspace page).
- The landing page sends `POST http://localhost:3000/project` with `{ replId, language }`.
- The coding page reads the runner URL returned as `taskInfo` and connects to it with Socket.IO.
- The editor loads the S3-backed file tree, fetches file contents, and uploads complete file changes.
- The terminal uses xterm in the browser and forwards input/output through Socket.IO.
- The Run button asks the runner to execute the selected `.js` or `.py` file and displays stdout/stderr.

### Backend

- `backend/orchestrator/src/index.ts` loads `.env`, handles `POST /project`, copies the template, and starts an ECS Fargate task.
- `backend/orchestrator/src/aws.ts` copies S3 templates, polls ECS, resolves the runner ENI public IP, and returns its port-8080 URL.
- `backend/runner/src/index.ts` downloads `code/<replId>` into `/app/workspace` and starts the runner HTTP/Socket.IO server on port `8080`.
- `backend/runner/src/ws.ts` handles file, terminal, and run events.
- `backend/runner/src/pty.ts` starts a Bash PTY in the workspace.
- The runner image installs its own dependencies during Docker build; dependencies inside the downloaded user workspace are not installed automatically.

## Runtime flow

1. Open the frontend and choose a project id and language.
2. The frontend calls `POST /project` on the orchestrator.
3. The orchestrator maps `node-js` to the S3 prefix `base/node.js` and copies it to `code/<replId>`.
4. The orchestrator starts the ECS task using `ECS_TASK_DEFINITION_ARN` and waits for `RUNNING`.
5. The orchestrator resolves the task public IP and returns `http://<public-ip>:8080` as `taskInfo`.
6. The browser connects to the runner with Socket.IO.
7. The runner downloads `code/<replId>` and emits the initial file tree.
8. File reads, edits, terminal traffic, and run output use Socket.IO events.
9. Editor changes are written to the runner workspace and uploaded to S3.

## Prerequisites

- Node.js and npm
- A shell available as `bash` on the backend host (the PTY currently hard-codes Bash)
- An AWS S3 bucket containing templates such as `base/node.js/` and `base/python/`
- AWS credentials with S3 and ECS permissions for local orchestrator use
- An ECR repository containing the runner image
- An ECS cluster, active task definition, subnets, and a security group allowing TCP `8080`

## Configuration

Create `backend/orchestrator/.env` locally. Never commit it:

```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET=your-bucket
ECS_CLUSTER_NAME=your-cluster
ECS_TASK_DEFINITION_ARN=arn:aws:ecs:region:account:task-definition/runner:revision
ECS_CONTAINER_NAME=Main
ECS_SUBNETS=subnet-a,subnet-b
ECS_SECURITY_GROUPS=sg-runner
PORT=3000
```

`S3_ENDPOINT` can be omitted for standard AWS S3. Do not commit real credentials.

The frontend uses Vite environment variables in `frontend/.env`:

- `VITE_ORCHESTRATOR_URL=http://localhost:3000`
- `VITE_EXECUTION_ENGINE_URI=ws://localhost:8080` for local fallback only; ECS sessions use the returned runner URL.

Do not commit AWS credentials. If credentials have ever been pushed, revoke and replace them, remove them from Git history, and use the replacement credentials locally or through an IAM role.

## Local development

Install and start the orchestrator:

```bash
cd backend/orchestrator
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

For an orchestrator production-style run:

```bash
cd backend/orchestrator
npm run build
npm start
```

The runner is normally built as a Docker image and pushed to ECR. Changes to `backend/runner/src` require rebuilding the image and registering a new active ECS task-definition revision before new tasks can use them:

```bash
cd backend/runner
docker build -t <ecr-repository>:<tag> .
docker push <ecr-repository>:<tag>
```

Update `ECS_TASK_DEFINITION_ARN` to the new active revision before restarting the orchestrator.

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
| client -> server | `run` | Executes the selected JavaScript or Python file |
| server -> client | `runOutput` | Sends process stdout/stderr to the output panel |

## Known limitations

- There is no authentication or authorization; the Socket.IO origin is `*`.
- Project ids are not checked for collisions or safe path characters.
- S3 operations and socket handlers have limited error handling and no clear lifecycle cleanup for temporary projects.
- Every editor update sends the full file and writes directly to S3; updates are not throttled or versioned.
- PTY and file execution run inside the ECS container but should still not be exposed to untrusted users without authentication and resource limits.
- User workspace dependencies are not installed automatically; the Run handler executes JavaScript with Node or Python files with Python 3.
- The runner currently exposes port `8080` for Socket.IO and runner HTTP health checks. A separate application preview port and ECS/network mapping are required for web previews.
- The orchestrator returns a task public IP. A load balancer or service discovery is recommended for production deployments.
- ECS tasks shut down after five minutes without an active socket connection.
- The S3 copy operation is intended to support continuation tokens, but the recursive call currently passes the original token.

