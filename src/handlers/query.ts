import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_POSTS } from "../lib/db";

/**
 * Lambda handler to query posts from DynamoDB.
 * Returns all posts sorted by createdAt (descending).
 * Supports optional query parameters:
 * - limit: max number of items to return (default: 100)
 */
export const handler = async (event: any) => {
  try {
    const limit = event?.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 100;

    const result = await ddb.send(new ScanCommand({
      TableName: TABLE_POSTS,
      Limit: Math.min(limit, 1000) // Cap at 1000 for safety
    }));

    const items = result.Items || [];
    
    // Sort by createdAt descending (most recent first)
    const sorted = items.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: JSON.stringify({
        ok: true,
        count: sorted.length,
        data: sorted
      })
    };
  } catch (error) {
    console.error("Error querying posts:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
      },
      body: JSON.stringify({
        ok: false,
        message: "Failed to query posts",
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
};
