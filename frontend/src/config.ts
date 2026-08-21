// URL of the Orchestrator API (runs continuously, manages ECS tasks)
export const ORCHESTRATOR_URL = process.env.VITE_ORCHESTRATOR_URL || "http://localhost:3000";

// Base WebSocket URL for runner containers.
// In the new architecture this is dynamically set per user from the Orchestrator response.
export const EXECUTION_ENGINE_URI = process.env.VITE_EXECUTION_ENGINE_URI || "ws://localhost:8080";