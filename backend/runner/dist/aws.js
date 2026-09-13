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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveToS3 = exports.fetchS3Folder = void 0;
const aws_sdk_1 = require("aws-sdk");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const s3 = new aws_sdk_1.S3({
    region: process.env.AWS_REGION || "us-east-1"
});
const fetchS3Folder = (key, localPath) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const bucket = (_a = process.env.S3_BUCKET) !== null && _a !== void 0 ? _a : "";
    const prefix = key.replace(/\/+$/, "") + "/";
    try {
        let continuationToken;
        do {
            const response = yield s3.listObjectsV2({
                Bucket: bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken
            }).promise();
            yield Promise.all(((_b = response.Contents) !== null && _b !== void 0 ? _b : []).map((file) => __awaiter(void 0, void 0, void 0, function* () {
                const fileKey = file.Key;
                if (!fileKey) {
                    return;
                }
                if (fileKey.endsWith("/")) {
                    console.log(`Skipping S3 directory marker: ${fileKey}`);
                    return;
                }
                const relativePath = fileKey.slice(prefix.length);
                const filePath = path_1.default.join(localPath, relativePath);
                const data = yield s3.getObject({
                    Bucket: bucket,
                    Key: fileKey
                }).promise();
                if (data.Body) {
                    yield writeFile(filePath, data.Body);
                    console.log(`Downloaded ${fileKey} to ${filePath}`);
                }
            })));
            if (response.IsTruncated && !response.NextContinuationToken) {
                throw new Error("S3 pagination did not return a continuation token");
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
    }
    catch (error) {
        console.error("Error fetching folder:", error);
        throw error;
    }
});
exports.fetchS3Folder = fetchS3Folder;
function writeFile(filePath, fileData) {
    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
        yield createFolder(path_1.default.dirname(filePath));
        fs_1.default.writeFile(filePath, fileData, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    }));
}
function createFolder(dirName) {
    return new Promise((resolve, reject) => {
        fs_1.default.mkdir(dirName, { recursive: true }, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}
const saveToS3 = (key, filePath, content) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const params = {
        Bucket: (_a = process.env.S3_BUCKET) !== null && _a !== void 0 ? _a : "",
        Key: `${key}${filePath}`,
        Body: content
    };
    yield s3.putObject(params).promise();
});
exports.saveToS3 = saveToS3;
