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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("./ws");
const cors_1 = __importDefault(require("cors"));
const aws_1 = require("./aws");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const httpServer = (0, http_1.createServer)(app);
app.get("/", (req, res) => {
    res.send("Runner is online");
});
const replId = process.env.REPL_ID;
// Basic health check endpoint for ECS
app.get("/health", (req, res) => {
    res.send("OK");
});
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!replId) {
            console.error("REPL_ID environment variable is missing!");
            process.exit(1);
        }
        console.log(`Starting Runner for Repl: ${replId}`);
        // 1. Fetch the user's code from S3 to the local workspace
        console.log("Fetching code from S3...");
        const workspacePath = path_1.default.join(__dirname, "../workspace");
        yield (0, aws_1.fetchS3Folder)(`code/${replId}`, workspacePath);
        console.log("Code fetched successfully.");
        // 2. Initialize WebSocket server
        (0, ws_1.initWs)(httpServer);
        // 3. Start listening
        const port = process.env.PORT || 8080;
        httpServer.listen(port, () => {
            console.log(`Runner listening on port ${port}`);
        });
    });
}
start();
