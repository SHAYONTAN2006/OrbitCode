import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { copyS3Folder, startRunnerContainer } from "./aws";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/project", async (req, res) => {
    // In a real app, hit a database to ensure this replId isn't taken
    const { replId, language } = req.body;

    if (!replId || !language) {
        res.status(400).send("Bad request: replId and language are required.");
        return;
    }

    try {
        console.log(`Creating project for replId: ${replId} with language: ${language}`);
        
        // 1. Copy base code for the selected language to the user's S3 code folder
        await copyS3Folder(`base/${language}`, `code/${replId}`);
        console.log("Base code copied to S3 successfully.");

        // 2. Spin up a new ECS Fargate container to act as the runner
        const runnerTaskInfo = await startRunnerContainer(replId);

        // 3. Return success and the task information to the frontend
        res.json({
            message: "Project created and Runner started successfully",
            replId: replId,
            taskInfo: runnerTaskInfo
        });

    } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).send("Internal Server Error");
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Orchestrator API listening on port ${port}`);
});
