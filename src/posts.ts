import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION ?? "ap-southeast-2";
const TABLE_POSTS = process.env.TABLE_POSTS ?? "Posts";
const LIMIT = Number(process.env.POSTS_LIMIT ?? 10);

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

export const handler = async (event: any = {}) => {
  // Parse query parameters
  const queryParams = event.queryStringParameters || {};
  const requestedLimit = queryParams.limit 
    ? parseInt(queryParams.limit, 10) 
    : LIMIT;
  const nextToken = queryParams.nextToken;

  // Validate and clamp limit (1-100)
  const limit = Math.min(Math.max(1, requestedLimit), 100);

  // Build query command
  const queryCommand: any = {
    TableName: TABLE_POSTS,
    IndexName: "GSI1",
    KeyConditionExpression: "GSI1PK = :pk",
    ExpressionAttributeValues: {
      ":pk": "POSTS"
    },
    ScanIndexForward: false,
    Limit: limit
  };

  // Add pagination token if provided
  if (nextToken) {
    try {
      queryCommand.ExclusiveStartKey = JSON.parse(
        Buffer.from(nextToken, "base64").toString("utf-8")
      );
    } catch (e) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*"
        },
        body: JSON.stringify({
          ok: false,
          message: "Invalid nextToken"
        })
      };
    }
  }

  const result = await dynamo.send(new QueryCommand(queryCommand));

  // Encode next token if there are more items
  let encodedNextToken: string | undefined;
  if (result.LastEvaluatedKey) {
    encodedNextToken = Buffer.from(
      JSON.stringify(result.LastEvaluatedKey)
    ).toString("base64");
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ok: true,
      count: result.Items?.length ?? 0,
      items: result.Items ?? [],
      pagination: {
        limit,
        hasMore: !!result.LastEvaluatedKey,
        nextToken: encodedNextToken
      }
    })
  };
};
