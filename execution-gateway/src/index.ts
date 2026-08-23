import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { initGateway } from "./gateway";

dotenv.config();

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const httpServer = createServer(app);
const ioServer = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
});

initGateway(ioServer);

const port = Number(process.env.GATEWAY_PORT || 4000);
httpServer.listen(port, () => {
    console.log(`[Gateway] Execution Gateway listening on port ${port}`);
});
