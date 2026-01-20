import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { IngestRecord } from "./shared/types";

const REGION = process.env.AWS_REGION ?? "ap-southeast-2";
const TABLE_POSTS = process.env.TABLE_POSTS ?? "Posts";

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

interface ApiGatewayEvent {
  body?: string | IngestRecord | IngestRecord[];
}

export const handler = async (event: ApiGatewayEvent | IngestRecord | IngestRecord[]) => {
  let payload: IngestRecord[];
  try {
    payload = parsePayload(event);
  } catch (err) {
    return response(400, { ok: false, message: "Invalid JSON body", detail: serializeError(err) });
  }

  if (payload.length === 0) {
    return response(400, { ok: false, message: "Request body must contain at least one tweet" });
  }

  try {
    payload.forEach(validatePost);
  } catch (err) {
    return response(400, { ok: false, message: (err as Error).message });
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

function parsePayload(event: ApiGatewayEvent | IngestRecord | IngestRecord[]): IngestRecord[] {
  if (Array.isArray(event)) {
    return event;
  }

  if (isRecord(event)) {
    return [event];
  }

  const body = (event as ApiGatewayEvent)?.body;

  if (typeof body === "string") {
    const parsed = body.trim() ? JSON.parse(body) : undefined;
    return normalizePosts(parsed);
  }

  return normalizePosts(body);
}

function normalizePosts(value: unknown): IngestRecord[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value as IngestRecord[] : [value as IngestRecord];
}

function validatePost(post: IngestRecord) {
  const record = post as unknown as Record<string, unknown>;
  const required = ["tweetId", "username", "tweetContent", "createdAt", "ticker", "contractAddress", "pairUrl"];
  const missing = required.filter((key) => record[key] === undefined || record[key] === null || record[key] === "");

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

function isRecord(value: unknown): value is IngestRecord {
  return typeof value === "object" && !!value && "tweetId" in value && "ticker" in value;
}

function response(statusCode: number, payload: unknown) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*"
    },
    body: JSON.stringify(payload)
  };
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { message: err.message };
  }
  return undefined;
}
