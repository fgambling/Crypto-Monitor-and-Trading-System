/**
 * CDK stack definition for Crypto Monitor.
 *
 * Deployment:
 * npm i -D aws-cdk aws-cdk-lib constructs
 * npx cdk bootstrap
 * npx cdk deploy
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Construct } from "constructs";
import {
  Stack,
  StackProps,
  Duration,
  CfnOutput
} from "aws-cdk-lib";
import {
  Table
} from "aws-cdk-lib/aws-dynamodb";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export class CryptoMonitorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Reuse existing DynamoDB tables instead of creating new ones.
    const postsTable = Table.fromTableName(this, "PostsTable", "Posts");
    const signalsTable = Table.fromTableName(this, "SignalsTable", "Signals");

    const extractQueue = new Queue(this, "ExtractQueue", {
      queueName: "ExtractQueue",
      visibilityTimeout: Duration.seconds(60)
    });

    const commonEnv = {
      TABLE_POSTS: postsTable.tableName,
      TABLE_SIGNALS: signalsTable.tableName,
      QUEUE_URL: extractQueue.queueUrl,
      MARKET_CAP_MIN: "500000",
      VOLUME_MIN: "100000"
    };

    const ingestFunction = new NodejsFunction(this, "IngestFunction", {
      entry: path.join(__dirname, "..", "src", "ingest.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      environment: commonEnv
    });

    const extractFunction = new NodejsFunction(this, "ExtractFunction", {
      entry: path.join(__dirname, "..", "src", "extract.ts"),
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(30),
      environment: commonEnv
    });

    postsTable.grantWriteData(ingestFunction);
    signalsTable.grantReadWriteData(extractFunction);

    extractQueue.grantSendMessages(ingestFunction);
    extractQueue.grantConsumeMessages(extractFunction);

    extractFunction.addEventSource(new SqsEventSource(extractQueue));

    const api = new RestApi(this, "CryptoMonitorApi", {
      restApiName: "CryptoMonitor",
      deployOptions: {
        stageName: "prod"
      }
    });

    const ingestResource = api.root.addResource("ingest");
    ingestResource.addMethod("POST", new LambdaIntegration(ingestFunction, {
      proxy: true
    }));

    new CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "Invoke URL for the ingest endpoint"
    });

    new CfnOutput(this, "ExtractQueueUrl", {
      value: extractQueue.queueUrl,
      description: "SQS queue URL for post ingestion"
    });
  }
}
