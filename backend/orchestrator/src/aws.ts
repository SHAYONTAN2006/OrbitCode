import { S3 } from "aws-sdk";
import { EC2 } from "aws-sdk";
import { ECSClient, RunTaskCommand, DescribeTasksCommand } from "@aws-sdk/client-ecs";

const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1"
});

const ecsClient = new ECSClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
    }
});

const ec2 = new EC2({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1"
});

const runnerContainerName = process.env.ECS_CONTAINER_NAME || "Main";

export async function copyS3Folder(sourcePrefix: string, destinationPrefix: string, continuationToken?: string): Promise<void> {
    try {
        const listParams = {
            Bucket: process.env.S3_BUCKET ?? "",
            Prefix: sourcePrefix,
            ContinuationToken: continuationToken
        };

        const listedObjects = await s3.listObjectsV2(listParams).promise();

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            if (!continuationToken) {
                throw new Error(`No S3 base files found for prefix: ${sourcePrefix}`);
            }
            return;
        }
        
        await Promise.all(listedObjects.Contents.map(async (object) => {
            if (!object.Key) return;
            let destinationKey = object.Key.replace(sourcePrefix, destinationPrefix);
            let copyParams = {
                Bucket: process.env.S3_BUCKET ?? "",
                CopySource: `${process.env.S3_BUCKET}/${object.Key}`,
                Key: destinationKey
            };

            await s3.copyObject(copyParams).promise();
            console.log(`Copied ${object.Key} to ${destinationKey}`);
        }));

        if (listedObjects.IsTruncated) {
            listParams.ContinuationToken = listedObjects.NextContinuationToken;
            await copyS3Folder(sourcePrefix, destinationPrefix, continuationToken);
        }
    } catch (error) {
        console.error('Error copying folder:', error);
        throw error;
    }
}

export async function startRunnerContainer(replId: string): Promise<string> {
    try {
        const localRunnerUrl = process.env.LOCAL_RUNNER_URL;
        if (localRunnerUrl) {
            console.log(`[Orchestrator] Using local runner: ${localRunnerUrl}`);
            return localRunnerUrl;
        }

        // 1. Run the ECS Task
        const runCommand = new RunTaskCommand({
            cluster: process.env.ECS_CLUSTER_NAME,
            taskDefinition: process.env.ECS_TASK_DEFINITION_ARN,
            launchType: "FARGATE",
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: process.env.ECS_SUBNETS?.split(",") || [],
                    securityGroups: process.env.ECS_SECURITY_GROUPS?.split(",") || [],
                    // With S3 VPC Endpoint + private subnet, no public IP needed
                    // Gateway connects via private IP within VPC
                    assignPublicIp: "DISABLED"
                }
            },
            overrides: {
                containerOverrides: [
                    {
                        name: runnerContainerName,
                        environment: [
                            { name: "REPL_ID", value: replId },
                            { name: "S3_BUCKET", value: process.env.S3_BUCKET || "" },
                            { name: "AWS_REGION", value: process.env.AWS_REGION || "us-east-1" },
                            // Note: We don't pass AWS keys here; the Task Role handles permissions natively!
                        ]
                    }
                ]
            }
        });

        const runResponse = await ecsClient.send(runCommand);
        const taskArn = runResponse.tasks?.[0]?.taskArn;

        if (!taskArn) {
            throw new Error("Failed to start ECS task: No task ARN returned");
        }

        console.log(`Started ECS Task: ${taskArn}. Waiting for it to reach RUNNING state...`);

        // 2. Poll until the task is RUNNING and gets an IP Address
        return await waitForTaskIp(taskArn);

    } catch (error) {
        console.error("Error starting runner container:", error);
        throw error;
    }
}

async function waitForTaskIp(taskArn: string): Promise<string> {
    const maxRetries = 30; // 30 retries * 2 seconds = 60 seconds
    const delayMs = 2000;

    for (let i = 0; i < maxRetries; i++) {
        const describeCommand = new DescribeTasksCommand({
            cluster: process.env.ECS_CLUSTER_NAME,
            tasks: [taskArn]
        });

        const describeResponse = await ecsClient.send(describeCommand);
        const task = describeResponse.tasks?.[0];

        if (task?.lastStatus === "RUNNING") {
            const eniAttachment = task.attachments?.find(a => a.type === "ElasticNetworkInterface");
            const eniIdDetail = eniAttachment?.details?.find(d => d.name === "networkInterfaceId");
            const privateIpDetail = eniAttachment?.details?.find(d => d.name === "privateIpv4Address");

            if (!eniIdDetail?.value) {
                throw new Error("Runner task is RUNNING but has no network interface yet");
            }

            // If private IP is in attachment details, use it directly (more reliable)
            if (privateIpDetail?.value) {
                const privateIp = privateIpDetail.value;
                console.log(`Runner task acquired private IP: ${privateIp}`);
                return `http://${privateIp}:${process.env.RUNNER_PORT || "8080"}`;
            }

            // Fallback: query ENI for private IP
            const networkInterfaces = await ec2.describeNetworkInterfaces({
                NetworkInterfaceIds: [eniIdDetail.value]
            }).promise();
            const privateIp = networkInterfaces.NetworkInterfaces?.[0]?.PrivateIpAddress;

            if (!privateIp) {
                throw new Error("Runner task is RUNNING but has no private IP");
            }

            console.log(`Runner task acquired private IP: ${privateIp}`);
            return `http://${privateIp}:${process.env.RUNNER_PORT || "8080"}`;
        }

        if (task?.lastStatus === "STOPPED") {
            throw new Error(`Task stopped unexpectedly. Reason: ${task.stoppedReason}`);
        }

        console.log(`Runner task status: ${task?.lastStatus || "NOT_FOUND"}`);

        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error("Timeout waiting for ECS task to start.");
}
