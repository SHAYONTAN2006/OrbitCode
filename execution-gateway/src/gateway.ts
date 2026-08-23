import { Server, Socket } from "socket.io";
import { io, Socket as ClientSocket } from "socket.io-client";
import { resolveRunner } from "./runnerRegistry";

const REPL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const PROXIED_EVENTS = [
    "fetchDir",
    "fetchContent",
    "updateContent",
    "requestTerminal",
    "terminalData",
    "run"
] as const;

export function initGateway(ioServer: Server): void {
    ioServer.on("connection", async (browserSocket: Socket) => {
        const replId = browserSocket.handshake.query.replId;

        if (typeof replId !== "string" || !REPL_ID_PATTERN.test(replId)) {
            browserSocket.emit("gatewayError", { error: "A valid replId is required" });
            browserSocket.disconnect(true);
            return;
        }

        console.log(`[Gateway] Browser connected for repl: ${replId}`);

        let registration;
        try {
            registration = await resolveRunner(replId);
            console.log(`[Gateway] Resolved runner: ${registration.runnerUrl}`);
        } catch {
            browserSocket.emit("gatewayError", { error: "Runner not found" });
            browserSocket.disconnect(true);
            return;
        }

        const runnerSocket: ClientSocket = io(registration.runnerUrl, {
            transports: ["websocket", "polling"]
        });

        runnerSocket.on("connect", () => {
            console.log(`[Gateway] Connected to runner for repl: ${replId}`);
        });

        runnerSocket.on("connect_error", () => {
            browserSocket.emit("gatewayError", { error: "Unable to connect to runner" });
        });

        runnerSocket.on("loaded", (payload) => browserSocket.emit("loaded", payload));
        runnerSocket.on("terminal", (payload) => browserSocket.emit("terminal", payload));
        runnerSocket.on("runOutput", (payload) => browserSocket.emit("runOutput", payload));

        for (const event of PROXIED_EVENTS) {
            browserSocket.on(event, (...args: unknown[]) => {
                const lastArg = args[args.length - 1];
                const hasCallback = typeof lastArg === "function";
                const eventArgs = hasCallback ? args.slice(0, -1) : args;

                if (hasCallback) {
                    runnerSocket.emit(event, ...eventArgs, (...response: unknown[]) => {
                        (lastArg as (...values: unknown[]) => void)(...response);
                    });
                } else {
                    runnerSocket.emit(event, ...eventArgs);
                }
            });
        }

        browserSocket.on("disconnect", () => {
            runnerSocket.disconnect();
            console.log(`[Gateway] Browser disconnected for repl: ${replId}`);
        });
    });
}
