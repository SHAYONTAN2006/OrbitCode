import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { saveToS3 } from "./aws";
import path from "path";
import { fetchDir, fetchFileContent, saveFile } from "./fs";
import { TerminalManager } from "./pty";

const terminalManager = new TerminalManager();
const replId = process.env.REPL_ID;

// Auto-shutdown mechanism to save ECS costs
let idleTimeout: NodeJS.Timeout | null = null;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function resetIdleTimeout() {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        console.log("Idle timeout reached. Shutting down container to save costs.");
        process.exit(0);
    }, IDLE_TIMEOUT_MS);
}

export function initWs(httpServer: HttpServer) {
    if (!replId) {
        console.error("REPL_ID environment variable not set. Exiting.");
        process.exit(1);
    }

    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    // Start the idle timer immediately in case no one connects
    resetIdleTimeout();

    io.on("connection", async (socket) => {
        console.log(`User connected to Repl: ${replId}`);
        // Reset timeout on new connection
        if (idleTimeout) clearTimeout(idleTimeout);

        socket.emit("loaded", {
            rootContent: await fetchDir(path.join(__dirname, `../workspace`), "")
        });

        initHandlers(socket, replId);
    });
}

function initHandlers(socket: Socket, replId: string) {
    socket.on("disconnect", () => {
        console.log("User disconnected");
        // Start idle timer when user leaves
        resetIdleTimeout();
    });

    socket.on("fetchDir", async (dir: string, callback) => {
        const dirPath = path.join(__dirname, `../workspace/${dir}`);
        const contents = await fetchDir(dirPath, dir);
        callback(contents);
    });

    socket.on("fetchContent", async ({ path: filePath }: { path: string }, callback) => {
        const fullPath = path.join(__dirname, `../workspace/${filePath}`);
        const data = await fetchFileContent(fullPath);
        callback(data);
    });

    socket.on("updateContent", async ({ path: filePath, content }: { path: string, content: string }) => {
        const fullPath = path.join(__dirname, `../workspace/${filePath}`);
        await saveFile(fullPath, content);
        await saveToS3(`code/${replId}`, filePath, content);
    });

    socket.on("requestTerminal", async () => {
        terminalManager.createPty(socket.id, replId, (data, id) => {
            socket.emit('terminal', {
                data: Buffer.from(data, "utf-8")
            });
        });
    });
    
    socket.on("terminalData", async ({ data }: { data: string, terminalId: number }) => {
        terminalManager.write(socket.id, data);
    });
}
