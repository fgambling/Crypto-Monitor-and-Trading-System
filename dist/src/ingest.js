import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
const REGION = process.env.AWS_REGION ?? "ap-southeast-2";
const TABLE_POSTS = process.env.TABLE_POSTS ?? "Posts";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
export const handler = async (event) => {
    let payload;
    try {
        payload = parsePayload(event);
    }
    catch (err) {
        return response(400, { ok: false, message: "Invalid JSON body", detail: serializeError(err) });
    }
    if (payload.length === 0) {
        return response(400, { ok: false, message: "Request body must contain at least one tweet" });
    }
    try {
        payload.forEach(validatePost);
    }
    catch (err) {
        return response(400, { ok: false, message: err.message });
    }
    let processed = 0;
    for (const post of payload) {
        await dynamo.send(new PutCommand({
            TableName: TABLE_POSTS,
            Item: {
                PK: `TWEET#${post.tweetId}`,
                SK: `TICKER#${post.ticker}`,
                GSI1PK: "POSTS",
                GSI1SK: post.createdAt,
                tweetId: post.tweetId,
                username: post.username,
                tweetContent: post.tweetContent,
                createdAt: post.createdAt,
                ticker: post.ticker,
                contractAddress: post.contractAddress,
                pairUrl: post.pairUrl
            }
        }));
        processed += 1;
    }
    return response(200, { ok: true, count: processed });
};
function parsePayload(event) {
    if (Array.isArray(event)) {
        return event;
    }
    if (isRecord(event)) {
        return [event];
    }
    const body = event?.body;
    if (typeof body === "string") {
        const parsed = body.trim() ? JSON.parse(body) : undefined;
        return normalizePosts(parsed);
    }
    return normalizePosts(body);
}
function normalizePosts(value) {
    if (!value) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}
function validatePost(post) {
    const record = post;
    const required = ["tweetId", "username", "tweetContent", "createdAt", "ticker", "contractAddress", "pairUrl"];
    const missing = required.filter((key) => record[key] === undefined || record[key] === null || record[key] === "");
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }
}
function isRecord(value) {
    return typeof value === "object" && !!value && "tweetId" in value && "ticker" in value;
}
function response(statusCode, payload) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify(payload)
    };
}
function serializeError(err) {
    if (err instanceof Error) {
        return { message: err.message };
    }
    return undefined;
}
