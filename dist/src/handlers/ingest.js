import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_POSTS } from "../lib/db";
// Lambda/APIGW compatible handler.
// Accepts a single PostEvent or an array of PostEvent.
export const handler = async (event) => {
    const body = typeof event?.body === "string" ? JSON.parse(event.body) : (event?.body ?? event);
    const posts = Array.isArray(body) ? body : [body];
    for (const post of posts) {
        const item = {
            PK: `USER#${post.userId}`,
            SK: `TS#${post.createdAt}#ID#${post.tweetId}`,
            ...post,
            processed: false
        };
        // Idempotency: ignore if exists
        await ddb.send(new PutCommand({
            TableName: TABLE_POSTS,
            Item: item,
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        })).catch(() => { });
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, count: posts.length }) };
};
