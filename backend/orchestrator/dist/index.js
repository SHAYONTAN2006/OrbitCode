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
const cors_1 = __importDefault(require("cors"));
const aws_1 = require("./aws");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post("/project", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // In a real app, hit a database to ensure this replId isn't taken
    const { replId, language } = req.body;
    if (!replId || !language) {
        res.status(400).send("Bad request: replId and language are required.");
        return;
    }
    try {
        console.log(`Creating project for replId: ${replId} with language: ${language}`);
        // 1. Copy base code for the selected language to the user's S3 code folder
        const baseLanguage = language === "node-js" ? "node.js" : language;
        yield (0, aws_1.copyS3Folder)(`base/${baseLanguage}`, `code/${replId}`);
        console.log("Base code copied to S3 successfully.");
        // 2. Spin up a new ECS Fargate container to act as the runner
        const runnerTaskInfo = yield (0, aws_1.startRunnerContainer)(replId);
        // 3. Return success and the task information to the frontend
        res.json({
            message: "Project created and Runner started successfully",
            replId: replId,
            taskInfo: runnerTaskInfo
        });
    }
    catch (error) {
        console.error("Error creating project:", error);
        res.status(500).send("Internal Server Error");
    }
}));
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Orchestrator API listening on port ${port}`);
});
