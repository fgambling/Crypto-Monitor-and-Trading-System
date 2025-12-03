import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { PostEvent } from "./shared/types";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const TABLE_POSTS = process.env.TABLE_POSTS ?? "Posts";
const QUEUE_URL = process.env.QUEUE_URL;

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const sqs = new SQSClient({ region: REGION });

interface ApiGatewayEvent {
  body?: string | PostEvent | PostEvent[];
}

export const handler = async (event: ApiGatewayEvent | PostEvent | PostEvent[]) => {
  let payload: PostEvent[];
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
    return response(400, { ok: false, message: (err as Error).message });
  }

  let processed = 0;

  for (const post of payload) {
    const keywords = Array.isArray(post.keywords) ? post.keywords : [];
    const enriched = { ...post, keywords };

    await dynamo.send(new PutCommand({
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

    await sqs.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(enriched)
    }));

    processed += 1;
  }

  return response(200, { ok: true, count: processed });
};

function parsePayload(event: ApiGatewayEvent | PostEvent | PostEvent[]): PostEvent[] {
  if (Array.isArray(event)) {
    return event;
  }

  if (isPostEvent(event)) {
    return [event];
  }

  const body = (event as ApiGatewayEvent)?.body;

  if (typeof body === "string") {
    const parsed = body.trim() ? JSON.parse(body) : undefined;
    return normalizePosts(parsed);
  }

  return normalizePosts(body);
}

function normalizePosts(value: unknown): PostEvent[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value as PostEvent[] : [value as PostEvent];
}

function validatePost(post: PostEvent) {
  const record = post as unknown as Record<string, unknown>;
  const required = ["tweetId", "userId", "username", "text", "createdAt"];
  const missing = required.filter((key) => record[key] === undefined || record[key] === null || record[key] === "");

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

function isPostEvent(value: unknown): value is PostEvent {
  return typeof value === "object" && !!value && "tweetId" in value && "userId" in value;
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
