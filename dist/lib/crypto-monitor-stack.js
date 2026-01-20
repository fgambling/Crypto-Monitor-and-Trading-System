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
import { Stack, Duration, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { LambdaIntegration, RestApi, Cors } from "aws-cdk-lib/aws-apigateway";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Distribution, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
export class CryptoMonitorStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // Reuse existing DynamoDB table instead of creating a new one.
        const postsTable = Table.fromTableName(this, "PostsTable", "Posts");
        const commonEnv = {
            TABLE_POSTS: postsTable.tableName
        };
        // === Lambda Functions ===
        const ingestFunction = new NodejsFunction(this, "IngestFunction", {
            entry: path.join(__dirname, "..", "src", "ingest.ts"),
            handler: "handler",
            runtime: Runtime.NODEJS_20_X,
            timeout: Duration.seconds(10),
            environment: commonEnv
        });
        const postsFunction = new NodejsFunction(this, "PostsFunction", {
            entry: path.join(__dirname, "..", "src", "posts.ts"),
            handler: "handler",
            runtime: Runtime.NODEJS_20_X,
            timeout: Duration.seconds(10),
            environment: {
                ...commonEnv,
                POSTS_LIMIT: "10"
            }
        });
        postsTable.grantWriteData(ingestFunction);
        postsTable.grantReadData(postsFunction);
        // === API Gateway ===
        const api = new RestApi(this, "CryptoMonitorApi", {
            restApiName: "CryptoMonitor",
            deployOptions: {
                stageName: "prod"
            },
            defaultCorsPreflightOptions: {
                allowOrigins: Cors.ALL_ORIGINS,
                allowMethods: Cors.ALL_METHODS,
                allowHeaders: ["Content-Type", "Authorization"]
            }
        });
        const ingestResource = api.root.addResource("ingest");
        ingestResource.addMethod("POST", new LambdaIntegration(ingestFunction, {
            proxy: true
        }));
        const postsResource = api.root.addResource("posts");
        postsResource.addMethod("GET", new LambdaIntegration(postsFunction, {
            proxy: true
        }));
        // === S3 Bucket for Dashboard ===
        const dashboardBucket = new Bucket(this, "DashboardBucket", {
            websiteIndexDocument: "index.html",
            websiteErrorDocument: "index.html",
            publicReadAccess: false,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });
        // === CloudFront Distribution ===
        const distribution = new Distribution(this, "DashboardDistribution", {
            defaultBehavior: {
                origin: S3BucketOrigin.withOriginAccessControl(dashboardBucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            },
            defaultRootObject: "index.html",
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: "/index.html"
                }
            ]
        });
        // === Deploy Dashboard Files ===
        new BucketDeployment(this, "DeployDashboard", {
            sources: [Source.asset(path.join(__dirname, "..", "dashboard"))],
            destinationBucket: dashboardBucket,
            distribution,
            distributionPaths: ["/*"]
        });
        // === Outputs ===
        new CfnOutput(this, "ApiUrl", {
            value: api.url,
            description: "API Gateway endpoint URL"
        });
        new CfnOutput(this, "DashboardUrl", {
            value: `https://${distribution.distributionDomainName}`,
            description: "CloudFront dashboard URL"
        });
        new CfnOutput(this, "IngestEndpoint", {
            value: `${api.url}ingest`,
            description: "POST endpoint for ingesting tweets"
        });
        new CfnOutput(this, "PostsEndpoint", {
            value: `${api.url}posts`,
            description: "GET endpoint for querying posts"
        });
    }
}
