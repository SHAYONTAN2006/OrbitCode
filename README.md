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
                     ^
                     | gateway-to-runner connection
                     |
Execution Gateway (port 4000)
                     ^
                     | Socket.IO
                     |
                   Browser
```

### Frontend

- `frontend/src/App.tsx` provides `/` (landing page) and `/coding?replId=<id>` (workspace page).
- The landing page sends `POST http://localhost:3000/project` with `{ replId, language }`.
- The coding page connects only to the stable execution gateway and sends `replId` as Socket.IO query metadata.
- The editor loads the S3-backed file tree, fetches file contents, and uploads complete file changes.
- The terminal uses xterm in the browser and forwards input/output through Socket.IO.
- The Run button asks the runner to execute the selected `.js` or `.py` file and displays stdout/stderr.

The browser never connects directly to a runner. It connects to the stable gateway at `http://localhost:4000`, passing the `replId` in the Socket.IO handshake. The gateway resolves the runner through the orchestrator and proxies the existing events.

### Backend

- `backend/orchestrator/src/index.ts` loads `.env`, handles `POST /project`, copies the template, and starts an ECS Fargate task.
- `backend/orchestrator/src/aws.ts` copies S3 templates and starts an ECS runner, or registers `LOCAL_RUNNER_URL` for local testing.
- `execution-gateway/src/gateway.ts` resolves a repl through the orchestrator registry and proxies existing Socket.IO events to the runner.
- `backend/runner/src/index.ts` downloads `code/<replId>` into `/app/workspace` and starts the runner HTTP/Socket.IO server on port `8080`.
- `backend/runner/src/ws.ts` handles file, terminal, and run events.
- `backend/runner/src/pty.ts` starts a Bash PTY in the workspace.
- The runner image installs its own dependencies during Docker build; dependencies inside the downloaded user workspace are not installed automatically.

## Runtime flow

1. Open the frontend and choose a project id and language.
2. The frontend calls `POST /project` on the orchestrator.
3. The orchestrator maps `node-js` to the S3 prefix `base/node.js` and copies it to `code/<replId>`.
4. The orchestrator starts the ECS task using `ECS_TASK_DEFINITION_ARN` and waits for `RUNNING`.
5. The orchestrator registers the runner URL internally and returns only the `replId`.
6. The browser connects to the stable execution gateway with `replId` as a query parameter.
7. The gateway resolves the runner and opens a server-side Socket.IO connection.
8. The runner downloads `code/<replId>` and emits the initial file tree.
9. File reads, edits, terminal traffic, and run output are proxied without changing event names.
10. Editor changes are written to the runner workspace and uploaded to S3.

## Prerequisites

- Node.js and npm
- A shell available as `bash` on the backend host (the PTY currently hard-codes Bash)
- An AWS S3 bucket containing templates such as `base/node.js/` and `base/python/`
- AWS credentials with S3 and ECS permissions for local orchestrator use
- An ECR repository containing the runner image
- An ECS cluster, active task definition, subnets, and a security group allowing TCP `8080`
- A local execution gateway on port `4000` for development

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
- `VITE_EXECUTION_GATEWAY_URL=http://localhost:4000`

Do not commit AWS credentials. If credentials have ever been pushed, revoke and replace them, remove them from Git history, and use the replacement credentials locally or through an IAM role.

## Local development

There are two supported testing modes:

- **AWS runner mode:** run the frontend, orchestrator, and execution gateway locally. The orchestrator starts the runner from the active ECS task definition and registers its address. Do not start `backend/runner` separately.
- **Local runner mode:** run the frontend, orchestrator, execution gateway, and a manually started runner. Set `LOCAL_RUNNER_URL` in the orchestrator environment and use the same `REPL_ID` when testing.

Install and start the orchestrator:

```bash
cd backend/orchestrator
npm install
npm run dev
```

Install and start the execution gateway in a third terminal:

```bash
cd execution-gateway
npm install
npm run dev
```

For local-runner mode only, start a runner in a fourth terminal:

```bash
cd backend/runner
npm install
$env:REPL_ID="local-repl"
$env:PORT="5001"
npm run dev
```

Set this in `backend/orchestrator/.env`:

```env
LOCAL_RUNNER_URL=http://localhost:5001
```

Enter `local-repl` in the landing page before starting the project. The local runner still needs valid S3 settings to download `code/local-repl`.

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

## Execution Gateway

The gateway is the only Socket.IO endpoint used by the browser. It accepts `replId` in the connection query, asks the orchestrator for the matching runner URL, and forwards the existing file, terminal, and execution events. Runner addresses never appear in the frontend configuration or project response.

The local registry is an in-memory map owned by the orchestrator. The gateway accesses it through the orchestrator's internal HTTP endpoint. In AWS, replace this endpoint or its backing store with Redis, DynamoDB, or ECS service discovery without changing the browser protocol.

### Service endpoints

| Service | Local endpoint | Browser access |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | Directly opened by the user |
| Orchestrator | `http://localhost:3000` | Frontend HTTP requests only |
| Execution Gateway | `http://localhost:4000` | Browser Socket.IO endpoint |
| Local Runner | `http://localhost:5001` | Gateway only |
| ECS Runner | Address registered by the orchestrator | Gateway only |

For AWS runner mode, the browser does not need the ECS task IP, task ARN, ENI, or runner port. The current prototype still returns a public ECS runner address internally to the gateway; deploy the gateway inside the VPC and replace this with private networking or service discovery before production.

## Known limitations

- There is no authentication or authorization; the Socket.IO origin is `*`.
- Project ids are not checked for collisions or safe path characters.
- S3 operations and socket handlers have limited error handling and no clear lifecycle cleanup for temporary projects.
- Every editor update sends the full file and writes directly to S3; updates are not throttled or versioned.
- PTY and file execution run inside the ECS container but should still not be exposed to untrusted users without authentication and resource limits.
- User workspace dependencies are not installed automatically; the Run handler executes JavaScript with Node or Python files with Python 3.
- The runner currently exposes port `8080` for Socket.IO and runner HTTP health checks. A separate application preview port and ECS/network mapping are required for web previews.
- The gateway currently resolves runner URLs through the orchestrator's in-memory registry; use a shared durable registry when running multiple orchestrator instances.
- The current ECS implementation still obtains a public runner IP. Production should place runners privately behind the gateway or service discovery.
- ECS tasks shut down after five minutes without an active socket connection.
- The S3 copy operation is intended to support continuation tokens, but the recursive call currently passes the original token.

