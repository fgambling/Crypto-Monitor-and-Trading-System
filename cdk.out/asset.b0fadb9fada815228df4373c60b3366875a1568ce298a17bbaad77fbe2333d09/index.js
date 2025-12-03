"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ingest.ts
var ingest_exports = {};
__export(ingest_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(ingest_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_sqs = require("@aws-sdk/client-sqs");
var REGION = process.env.AWS_REGION ?? "us-east-1";
var TABLE_POSTS = process.env.TABLE_POSTS ?? "Posts";
var QUEUE_URL = process.env.QUEUE_URL;
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(
  new import_client_dynamodb.DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);
var sqs = new import_client_sqs.SQSClient({ region: REGION });
var handler = async (event) => {
  let payload;
  try {
    payload = parsePayload(event);
  } catch (err) {
    return response(400, { ok: false, message: "Invalid JSON body", detail: serializeError(err) });
  }
  if (!QUEUE_URL) {
    throw new Error("QUEUE_URL environment variable is not set");
  }
  if (payload.length === 0) {
    return response(400, { ok: false, message: "Request body must contain at least one tweet" });
  }
  try {
    payload.forEach(validatePost);
  } catch (err) {
    return response(400, { ok: false, message: err.message });
  }
  let processed = 0;
  for (const post of payload) {
    const keywords = Array.isArray(post.keywords) ? post.keywords : [];
    const enriched = { ...post, keywords };
    await dynamo.send(new import_lib_dynamodb.PutCommand({
      TableName: TABLE_POSTS,
      Item: {
        PK: `USER#${post.userId}`,
        SK: `TWEET#${post.tweetId}`,
        tweetId: enriched.tweetId,
        userId: enriched.userId,
        username: enriched.username,
        text: enriched.text,
        createdAt: enriched.createdAt,
        keywords: enriched.keywords,
        sentiment: enriched.sentiment
      }
    }));
    await sqs.send(new import_client_sqs.SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(enriched)
    }));
    processed += 1;
  }
  return response(200, { ok: true, count: processed });
};
function parsePayload(event) {
  if (Array.isArray(event)) {
    return event;
  }
  if (isPostEvent(event)) {
    return [event];
  }
  const body = event?.body;
  if (typeof body === "string") {
    const parsed = body.trim() ? JSON.parse(body) : void 0;
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
  const required = ["tweetId", "userId", "username", "text", "createdAt"];
  const missing = required.filter((key) => record[key] === void 0 || record[key] === null || record[key] === "");
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}
function isPostEvent(value) {
  return typeof value === "object" && !!value && "tweetId" in value && "userId" in value;
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
  return void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
