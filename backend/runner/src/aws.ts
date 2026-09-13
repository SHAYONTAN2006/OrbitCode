import { S3 } from "aws-sdk"
import fs from "fs";
import path from "path";

const s3 = new S3({
    region: process.env.AWS_REGION || "us-east-1"
});

export const fetchS3Folder = async (
    key: string,
    localPath: string
): Promise<void> => {
    const bucket = process.env.S3_BUCKET ?? "";
    const prefix = key.replace(/\/+$/, "") + "/";

    try {
        let continuationToken: string | undefined;

        do {
            const response = await s3.listObjectsV2({
                Bucket: bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken
            }).promise();

            await Promise.all((response.Contents ?? []).map(async (file) => {
                const fileKey = file.Key;

                if (!fileKey) {
                    return;
                }

                if (fileKey.endsWith("/")) {
                    console.log(`Skipping S3 directory marker: ${fileKey}`);
                    return;
                }

                const relativePath = fileKey.slice(prefix.length);
                const filePath = path.join(localPath, relativePath);
                const data = await s3.getObject({
                    Bucket: bucket,
                    Key: fileKey
                }).promise();

                if (data.Body) {
                    await writeFile(filePath, data.Body as Buffer);
                    console.log(`Downloaded ${fileKey} to ${filePath}`);
                }
            }));

            if (response.IsTruncated && !response.NextContinuationToken) {
                throw new Error("S3 pagination did not return a continuation token");
            }

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
    } catch (error) {
        console.error("Error fetching folder:", error);
        throw error;
    }
};

function writeFile(filePath: string, fileData: Buffer): Promise<void> {
    return new Promise(async (resolve, reject) => {
        await createFolder(path.dirname(filePath));

        fs.writeFile(filePath, fileData, (err) => {
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        })
    });
}

function createFolder(dirName: string) {
    return new Promise<void>((resolve, reject) => {
        fs.mkdir(dirName, { recursive: true }, (err) => {
            if (err) {
                return reject(err)
            }
            resolve()
        });
    })
}

export const saveToS3 = async (key: string, filePath: string, content: string): Promise<void> => {
    const params = {
        Bucket: process.env.S3_BUCKET ?? "",
        Key: `${key}${filePath}`,
        Body: content
    }

    await s3.putObject(params).promise()
}
