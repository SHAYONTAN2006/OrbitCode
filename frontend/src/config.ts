// URL of the Orchestrator API (runs continuously, manages ECS tasks)
export const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || "http://localhost:3000";

// Stable browser-facing gateway URL. The gateway resolves the private runner.
export const EXECUTION_GATEWAY_URL = import.meta.env.VITE_EXECUTION_GATEWAY_URL || "http://localhost:4000";