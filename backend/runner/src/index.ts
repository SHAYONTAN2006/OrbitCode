import dotenv from "dotenv"
dotenv.config()
import express from "express";
import { createServer } from "http";
import { initWs } from "./ws";
import cors from "cors";
import { fetchS3Folder } from "./aws";
import path from "path";

const app = express();
app.use(cors());
const httpServer = createServer(app);

const replId = process.env.REPL_ID;

// Basic health check endpoint for ECS
app.get("/health", (req: express.Request, res: express.Response) => {
    res.send("OK");
});

async function start() {
    if (!replId) {
        console.error("REPL_ID environment variable is missing!");
        process.exit(1);
    }

    console.log(`Starting Runner for Repl: ${replId}`);
    
    // 1. Fetch the user's code from S3 to the local workspace
    console.log("Fetching code from S3...");
    const workspacePath = path.join(__dirname, "../workspace");
    await fetchS3Folder(`code/${replId}`, workspacePath);
    console.log("Code fetched successfully.");

    // 2. Initialize WebSocket server
    initWs(httpServer);

    // 3. Start listening
    const port = process.env.PORT || 8080;
    httpServer.listen(port, () => {
        console.log(`Runner listening on port ${port}`);
    });
}

start();
