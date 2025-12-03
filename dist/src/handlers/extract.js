import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_SIGNALS } from "../lib/db";
import { extractSymbolsFromText } from "../lib/mapping";
import { buildSignal } from "../lib/trade";
// SQS handler expected: event.Records[].body is a PostEvent JSON string
// For local testing you can call handler({ Records: [{ body: JSON.stringify(post) }]})
export const handler = async (event) => {
    for (const record of event?.Records ?? []) {
        const post = JSON.parse(record.body);
        const symbols = extractSymbolsFromText(post.text);
        for (const sym of symbols) {
            const sig = await buildSignal({ tweetId: post.tweetId, symbol: sym, keyword: sym });
            await ddb.send(new PutCommand({
                TableName: TABLE_SIGNALS,
                Item: {
                    PK: `SYMBOL#${sig.symbol}`,
                    SK: `TS#${sig.decidedAt}`,
                    ...sig
                }
            }));
        }
    }
    return { statusCode: 200, body: "ok" };
};
