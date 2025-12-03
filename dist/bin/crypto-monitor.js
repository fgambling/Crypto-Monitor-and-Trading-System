/**
 * CDK entrypoint for Crypto Monitor.
 *
 * Deployment:
 * npm i -D aws-cdk aws-cdk-lib constructs
 * npx cdk bootstrap
 * npx cdk deploy
 */
import { App } from "aws-cdk-lib";
import { CryptoMonitorStack } from "../lib/crypto-monitor-stack";
const app = new App();
new CryptoMonitorStack(app, "CryptoMonitorStack", {
    env: { region: "ap-southeast-2" }
});
