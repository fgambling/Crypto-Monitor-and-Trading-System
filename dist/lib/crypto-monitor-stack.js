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
import { Stack, Duration, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
export class CryptoMonitorStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const postsTable = new Table(this, "PostsTable", {
            tableName: "Posts",
            partitionKey: { name: "PK", type: AttributeType.STRING },
            sortKey: { name: "SK", type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY
        });
        const signalsTable = new Table(this, "SignalsTable", {
            tableName: "Signals",
            partitionKey: { name: "PK", type: AttributeType.STRING },
            sortKey: { name: "SK", type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY
        });
        const extractQueue = new Queue(this, "ExtractQueue", {
            queueName: "ExtractQueue",
            visibilityTimeout: Duration.seconds(60)
        });
        const commonEnv = {
            TABLE_POSTS: postsTable.tableName,
            TABLE_SIGNALS: signalsTable.tableName,
            QUEUE_URL: extractQueue.queueUrl
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
