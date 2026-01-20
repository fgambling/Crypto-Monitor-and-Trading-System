import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_POSTS } from "../lib/db";
import { IngestRecord } from "../shared/types";

// Lambda/APIGW compatible handler.
// Accepts a single IngestRecord or an array of IngestRecord.
export const handler = async (event: any) => {
  const body = typeof event?.body === "string" ? JSON.parse(event.body) : (event?.body ?? event);
  const posts: IngestRecord[] = Array.isArray(body) ? body : [body];

  for (const post of posts) {
    const item = {
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
    };
    // Idempotency: ignore if exists
    await ddb.send(new PutCommand({
      TableName: TABLE_POSTS,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
    })).catch(() => {});
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, count: posts.length }) };
};
