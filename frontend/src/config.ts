// URL of the Orchestrator API (runs continuously, manages ECS tasks)
export const ORCHESTRATOR_URL = "/api";

// Stable browser-facing gateway URL. The gateway resolves the private runner.
export const EXECUTION_GATEWAY_URL = window.location.origin;