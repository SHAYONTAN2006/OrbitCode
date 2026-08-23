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
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyS3Folder = copyS3Folder;
exports.startRunnerContainer = startRunnerContainer;
const aws_sdk_1 = require("aws-sdk");
const aws_sdk_2 = require("aws-sdk");
const client_ecs_1 = require("@aws-sdk/client-ecs");
const s3 = new aws_sdk_1.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1"
});
const ecsClient = new client_ecs_1.ECSClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
    }
});
const ec2 = new aws_sdk_2.EC2({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1"
});
const runnerContainerName = process.env.ECS_CONTAINER_NAME || "Main";
function copyS3Folder(sourcePrefix, destinationPrefix, continuationToken) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const listParams = {
                Bucket: (_a = process.env.S3_BUCKET) !== null && _a !== void 0 ? _a : "",
                Prefix: sourcePrefix,
                ContinuationToken: continuationToken
            };
            const listedObjects = yield s3.listObjectsV2(listParams).promise();
            if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
                if (!continuationToken) {
                    throw new Error(`No S3 base files found for prefix: ${sourcePrefix}`);
                }
                return;
            }
            yield Promise.all(listedObjects.Contents.map((object) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (!object.Key)
                    return;
                let destinationKey = object.Key.replace(sourcePrefix, destinationPrefix);
                let copyParams = {
                    Bucket: (_a = process.env.S3_BUCKET) !== null && _a !== void 0 ? _a : "",
                    CopySource: `${process.env.S3_BUCKET}/${object.Key}`,
                    Key: destinationKey
                };
                yield s3.copyObject(copyParams).promise();
                console.log(`Copied ${object.Key} to ${destinationKey}`);
            })));
            if (listedObjects.IsTruncated) {
                listParams.ContinuationToken = listedObjects.NextContinuationToken;
                yield copyS3Folder(sourcePrefix, destinationPrefix, continuationToken);
            }
        }
        catch (error) {
            console.error('Error copying folder:', error);
            throw error;
        }
    });
}
function startRunnerContainer(replId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            const localRunnerUrl = process.env.LOCAL_RUNNER_URL;
            if (localRunnerUrl) {
                console.log(`[Orchestrator] Using local runner: ${localRunnerUrl}`);
                return localRunnerUrl;
            }
            // 1. Run the ECS Task
            const runCommand = new client_ecs_1.RunTaskCommand({
                cluster: process.env.ECS_CLUSTER_NAME,
                taskDefinition: process.env.ECS_TASK_DEFINITION_ARN,
                launchType: "FARGATE",
                networkConfiguration: {
                    awsvpcConfiguration: {
                        subnets: ((_a = process.env.ECS_SUBNETS) === null || _a === void 0 ? void 0 : _a.split(",")) || [],
                        securityGroups: ((_b = process.env.ECS_SECURITY_GROUPS) === null || _b === void 0 ? void 0 : _b.split(",")) || [],
                        assignPublicIp: "ENABLED" // Required for Fargate to pull images from ECR if no NAT gateway
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
            const runResponse = yield ecsClient.send(runCommand);
            const taskArn = (_d = (_c = runResponse.tasks) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.taskArn;
            if (!taskArn) {
                throw new Error("Failed to start ECS task: No task ARN returned");
            }
            console.log(`Started ECS Task: ${taskArn}. Waiting for it to reach RUNNING state...`);
            // 2. Poll until the task is RUNNING and gets an IP Address
            return yield waitForTaskIp(taskArn);
        }
        catch (error) {
            console.error("Error starting runner container:", error);
            throw error;
        }
    });
}
function waitForTaskIp(taskArn) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const maxRetries = 30; // 30 retries * 2 seconds = 60 seconds
        const delayMs = 2000;
        for (let i = 0; i < maxRetries; i++) {
            const describeCommand = new client_ecs_1.DescribeTasksCommand({
                cluster: process.env.ECS_CLUSTER_NAME,
                tasks: [taskArn]
            });
            const describeResponse = yield ecsClient.send(describeCommand);
            const task = (_a = describeResponse.tasks) === null || _a === void 0 ? void 0 : _a[0];
            if ((task === null || task === void 0 ? void 0 : task.lastStatus) === "RUNNING") {
                const eniAttachment = (_b = task.attachments) === null || _b === void 0 ? void 0 : _b.find(a => a.type === "ElasticNetworkInterface");
                const publicIpDetail = (_c = eniAttachment === null || eniAttachment === void 0 ? void 0 : eniAttachment.details) === null || _c === void 0 ? void 0 : _c.find(d => d.name === "networkInterfaceId");
                if (!(publicIpDetail === null || publicIpDetail === void 0 ? void 0 : publicIpDetail.value)) {
                    throw new Error("Runner task is RUNNING but has no network interface yet");
                }
                const networkInterfaces = yield ec2.describeNetworkInterfaces({
                    NetworkInterfaceIds: [publicIpDetail.value]
                }).promise();
                const publicIp = (_f = (_e = (_d = networkInterfaces.NetworkInterfaces) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.Association) === null || _f === void 0 ? void 0 : _f.PublicIp;
                if (!publicIp) {
                    throw new Error("Runner task is RUNNING but has no public IP");
                }
                return `http://${publicIp}:${process.env.RUNNER_PORT || "8080"}`;
            }
            if ((task === null || task === void 0 ? void 0 : task.lastStatus) === "STOPPED") {
                throw new Error(`Task stopped unexpectedly. Reason: ${task.stoppedReason}`);
            }
            console.log(`Runner task status: ${(task === null || task === void 0 ? void 0 : task.lastStatus) || "NOT_FOUND"}`);
            // Wait before polling again
            yield new Promise(resolve => setTimeout(resolve, delayMs));
        }
        throw new Error("Timeout waiting for ECS task to start.");
    });
}
