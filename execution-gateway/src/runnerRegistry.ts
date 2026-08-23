import axios from "axios";

export interface RunnerRegistration {
    replId: string;
    runnerUrl: string;
}

export async function resolveRunner(replId: string): Promise<RunnerRegistration> {
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || "http://localhost:3000";
    const response = await axios.get<RunnerRegistration>(
        `${orchestratorUrl}/internal/runners/${encodeURIComponent(replId)}`
    );
    return response.data;
}
