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

// src/handlers/ingest.ts
var ingest_exports = {};
__export(ingest_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(ingest_exports);
var import_lib_dynamodb2 = require("@aws-sdk/lib-dynamodb");

// src/lib/db.ts
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var REGION = process.env.AWS_REGION || "ap-southeast-2";
var client = new import_client_dynamodb.DynamoDBClient({ region: REGION });
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});
var TABLE_POSTS = process.env.TABLE_POSTS || "Posts";
var TABLE_SIGNALS = process.env.TABLE_SIGNALS || "Signals";

// src/handlers/ingest.ts
var handler = async (event) => {
  const body = typeof event?.body === "string" ? JSON.parse(event.body) : event?.body ?? event;
  const posts = Array.isArray(body) ? body : [body];
  for (const post of posts) {
    const item = {
      PK: `USER#${post.userId}`,
      SK: `TS#${post.createdAt}#ID#${post.tweetId}`,
      ...post,
      processed: false
    };
    await ddb.send(new import_lib_dynamodb2.PutCommand({
      TableName: TABLE_POSTS,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
    })).catch(() => {
    });
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true, count: posts.length }) };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
