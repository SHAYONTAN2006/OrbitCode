// URL of the Orchestrator API (runs continuously, manages ECS tasks)
export const ORCHESTRATOR_URL = "http://orchestrator-api-alb-189120613.us-east-1.elb.amazonaws.com";

// Stable browser-facing gateway URL. The gateway resolves the private runner.
export const EXECUTION_GATEWAY_URL = "http://execution-alb-1512369658.us-east-1.elb.amazonaws.com";