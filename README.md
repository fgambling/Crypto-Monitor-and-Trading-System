# Read-time Crypto Monitor and Trading System

Serverless ingest + signal generation pipeline that turns social posts into simulated crypto trade signals in real time. Built to showcase event-driven architecture, AWS services, and TypeScript Lambda handlers.

## What it does
- Accepts tweets/posts via an API Gateway-style `/ingest` endpoint and stores them in DynamoDB.
- Publishes each post to SQS, where an extractor looks up matching tokens (DexScreener) and emits trade signals.
- Writes normalized signals to DynamoDB for downstream consumption (dashboards, trading engine).
- Includes a local Express server for quick iteration and a CDK stack to deploy Lambdas, API Gateway, SQS, and table bindings.

## System design
- **API Gateway + Lambda (ingest):** Validates posts, saves to `Posts` table, pushes to SQS for async processing.
- **SQS queue:** Buffers work to decouple ingest from extraction.
- **Lambda (extract):** Parses keywords, queries DexScreener, filters by market cap/volume thresholds, and stores signals in `Signals` table.
- **DynamoDB:** Two tables: `Posts` (PK: `USER#id`, SK: `TS#iso#ID#tweetId`) and `Signals` (PK: `TOKEN#address` or `SYMBOL#sym`, SK: `TS#iso`).
- **Local dev server:** Express mirror of `/ingest` to test without API Gateway.
- **Infrastructure as code:** `lib/crypto-monitor-stack.ts` provisions Lambdas, API, SQS, and connects to existing DynamoDB tables.

## Quick start (local)
1) `cp .env.example .env` and set: `AWS_REGION`, `TABLE_POSTS`, `TABLE_SIGNALS`, `QUEUE_URL` (for local use, any string), optional `MARKET_CAP_MIN`, `VOLUME_MIN`.
2) Install: `npm install`.
3) Run local API: `npm run dev` (listens on `:3000`).
4) Send a post:
   ```bash
   curl -X POST http://localhost:3000/ingest \
     -H "Content-Type: application/json" \
     -d '{
       "tweetId": "123",
       "userId": "42",
       "username": "satoshi",
       "text": "Buying $DOGE and PEPE today",
       "createdAt": "2024-01-01T00:00:00.000Z",
       "keywords": ["doge", "pepe"]
     }'
   ```

## Deploy (CDK)
1) Install CDK toolchain: `npm i -D aws-cdk aws-cdk-lib constructs`.
2) Bootstrap once per account/region: `npx cdk bootstrap`.
3) Deploy: `npx cdk deploy`.
   - Stack expects existing DynamoDB tables named `Posts` and `Signals`.
   - Outputs include the ingest API URL and the SQS queue URL.

## Configuration
Environment variables used by Lambdas:
- `AWS_REGION` (default `us-east-1` or `ap-southeast-2` locally)
- `TABLE_POSTS`, `TABLE_SIGNALS` (DynamoDB table names)
- `QUEUE_URL` (SQS queue for extract stage)
- `MARKET_CAP_MIN` (USD floor to ignore micro-caps)
- `VOLUME_MIN` (USD 24h volume floor)

## Project structure
- `src/ingest.ts`: Ingest Lambda (direct).
- `src/extract.ts`: Extract Lambda with DexScreener lookup and filtering.
- `src/handlers/*`: Lambda entrypoints packaged by CDK/tsup.
- `src/lib/*`: DynamoDB client, symbol mapping, trade signal builder.
- `src/local/server.ts`: Express wrapper for local `/ingest`.
- `lib/crypto-monitor-stack.ts`: CDK stack wiring API Gateway, SQS, Lambdas, and table permissions.

## Testing
- `npm test` (Vitest). Tests are minimal; extend with unit coverage around mapping, DexScreener integration mocks, and DynamoDB persistence.

## Roadmap ideas
- Add real price discovery and live trading adapter (e.g., Binance).
- Expand sentiment/NER to improve keyword-to-token matching.
- Add dashboards for signals and PnL, plus alerts.
- Harden idempotency, retries, and observability (metrics/traces).
