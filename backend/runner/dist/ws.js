"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWs = initWs;
const socket_io_1 = require("socket.io");
const aws_1 = require("./aws");
const path_1 = __importDefault(require("path"));
const fs_1 = require("./fs");
const pty_1 = require("./pty");
const child_process_1 = require("child_process");
const terminalManager = new pty_1.TerminalManager();
const replId = process.env.REPL_ID;
// Auto-shutdown mechanism to save ECS costs
let idleTimeout = null;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
function resetIdleTimeout() {
    if (idleTimeout)
        clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        console.log("Idle timeout reached. Shutting down container to save costs.");
        process.exit(0);
    }, IDLE_TIMEOUT_MS);
}
function initWs(httpServer) {
    if (!replId) {
        console.error("REPL_ID environment variable not set. Exiting.");
        process.exit(1);
    }
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    // Start the idle timer immediately in case no one connects
    resetIdleTimeout();
    io.on("connection", (socket) => __awaiter(this, void 0, void 0, function* () {
        console.log(`User connected to Repl: ${replId}`);
        // Reset timeout on new connection
        if (idleTimeout)
            clearTimeout(idleTimeout);
        initHandlers(socket, replId);
        socket.emit("loaded", {
            rootContent: yield (0, fs_1.fetchDir)(path_1.default.join(__dirname, `../workspace`), "")
        });
    }));
}
function initHandlers(socket, replId) {
    socket.on("disconnect", () => {
        console.log("User disconnected");
        // Start idle timer when user leaves
        resetIdleTimeout();
    });
    socket.on("fetchDir", (dir, callback) => __awaiter(this, void 0, void 0, function* () {
        const dirPath = path_1.default.join(__dirname, `../workspace/${dir}`);
        const contents = yield (0, fs_1.fetchDir)(dirPath, dir);
        callback(contents);
    }));
    socket.on("fetchContent", (_a, callback_1) => __awaiter(this, [_a, callback_1], void 0, function* ({ path: filePath }, callback) {
        const fullPath = path_1.default.join(__dirname, `../workspace/${filePath}`);
        const data = yield (0, fs_1.fetchFileContent)(fullPath);
        callback(data);
    }));
    socket.on("updateContent", (_a) => __awaiter(this, [_a], void 0, function* ({ path: filePath, content }) {
        const fullPath = path_1.default.join(__dirname, `../workspace/${filePath}`);
        yield (0, fs_1.saveFile)(fullPath, content);
        yield (0, aws_1.saveToS3)(`code/${replId}`, filePath, content);
    }));
    socket.on("requestTerminal", () => __awaiter(this, void 0, void 0, function* () {
        terminalManager.createPty(socket.id, replId, (data, id) => {
            socket.emit('terminal', {
                data: Buffer.from(data, "utf-8")
            });
        });
    }));
    socket.on("terminalData", (_a) => __awaiter(this, [_a], void 0, function* ({ data }) {
        terminalManager.write(socket.id, data);
    }));
    socket.on("run", ({ path: filePath }) => {
        const extension = path_1.default.extname(filePath);
        const command = extension === ".py" ? "python3" : "node";
        const workspacePath = path_1.default.join(__dirname, "../workspace");
        const relativePath = filePath.replace(/^\/+/, "");
        const resolvedPath = path_1.default.resolve(workspacePath, relativePath);
        if (!resolvedPath.startsWith(`${workspacePath}${path_1.default.sep}`)) {
            socket.emit("runOutput", { output: "Invalid file path" });
            return;
        }
        (0, child_process_1.execFile)(command, [relativePath], { cwd: workspacePath, timeout: 30000 }, (error, stdout, stderr) => {
            var _a;
            const output = `${stdout}${stderr}` || ((_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : "Process finished with no output");
            socket.emit("runOutput", { output });
        });
    });
}
