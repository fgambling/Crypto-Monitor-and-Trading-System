# Real-time Crypto Monitor and Trading System

Serverless ingest + visualization pipeline that turns social posts into structured crypto signals in real time. Built with AWS CDK, Lambda, API Gateway, DynamoDB, and a static dashboard on S3 + CloudFront.

## Live architecture & demo post

This project and its architecture are showcased in the following LinkedIn post (with screenshots of the system and dashboard):

- [Real-time crypto monitoring and signal engine (LinkedIn post)](https://www.linkedin.com/posts/extrememind-studio_we-built-a-real-time-crypto-monitoring-and-activity-7419320674000855040-znv-?utm_source=share&utm_medium=member_desktop&rcm=ACoAAC9QnsoBWik7UWTkco0uCyp2phS2hRRvRG8)

## What it does
- Ingest tweets/posts via `/ingest` and store in DynamoDB.
- Query posts via `/posts` with pagination (`limit`, `nextToken`).
- Render a live dashboard (S3 + CloudFront) with search, filtering, and “Load more”.
- Single-table DynamoDB design for downstream consumption; local Express server for quick dev.

## Architecture
- **API Gateway + Lambda (ingest):** Validate payloads and write to `Posts`.
- **API Gateway + Lambda (posts):** Read from `Posts` using GSI1, supports pagination.
- **DynamoDB:** Table `Posts` with GSI1; PK `TWEET#tweetId`, SK `TICKER#ticker`.
- **S3 + CloudFront:** Host the React dashboard.
- **CDK:** `lib/crypto-monitor-stack.ts` provisions API, Lambdas, S3, CloudFront, and IAM.

```
n8n / External Source
         ↓
    POST /ingest
         ↓
   API Gateway → Ingest Lambda → DynamoDB (Posts)

    GET /posts
         ↓
   API Gateway → Posts Lambda → DynamoDB (GSI1)
         ↓
   Dashboard (S3 + CloudFront)
```

## Local quick start
1) `cp .env.example .env` and set `AWS_REGION`, `TABLE_POSTS`.
2) Install deps: `npm install`.
3) Run local API: `npm run dev` (serves `/ingest` and `/posts` on :3000).
4) Test ingest:
   ```bash
   curl -X POST http://localhost:3000/ingest \
     -H "Content-Type: application/json" \
     -d '{
       "tweetId": "123",
       "username": "satoshi",
       "tweetContent": "Buying $DOGE and PEPE today",
       "createdAt": "2024-01-01T00:00:00.000Z",
       "ticker": "DOGE",
       "contractAddress": "0x0000000000000000000000000000000000000000",
       "pairUrl": "https://dexscreener.com/bsc/0x0000000000000000000000000000000000000000"
     }'
   ```

## Deploy to AWS (CDK)

### Prerequisites
- Node.js 20 (ts-node/esm is unstable on newer majors)
- DynamoDB table `Posts` with GSI1 (`GSI1PK`, `GSI1SK`)
- AWS credentials configured
- CDK toolchain: `npm i -D aws-cdk aws-cdk-lib constructs`
- Bootstrap once per account/region: `npx cdk bootstrap`

### Full deployment
```bash
npm run build             # tsc -p .
npm run deploy:dashboard  # cdk deploy (API + Lambdas + S3 + CloudFront)
```
Creates:
- API Gateway: `/ingest` (POST), `/posts` (GET)
- Lambdas: Ingest, Posts (pagination)
- S3 bucket for dashboard, CloudFront distribution

Outputs to note:
```
ApiUrl:          https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod/
DashboardUrl:    https://d1234567890.cloudfront.net
IngestEndpoint:  https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod/ingest
PostsEndpoint:   https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod/posts
```

### Configure dashboard after deploy
```bash
./scripts/update-dashboard-config.sh https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod/
npm run deploy   # redeploy to push updated config.js to S3/CloudFront
```

### Environment variables (Lambdas)
- `AWS_REGION` (default `ap-southeast-2`)
- `TABLE_POSTS` (default `Posts`)
- `POSTS_LIMIT` (default `10`, server-side clamp 1–100)

### IAM and DynamoDB
- Table: `Posts`
- GSI: `GSI1` (PK `GSI1PK`, SK `GSI1SK`)
- Posts Lambda must have `dynamodb:Query` on `table/Posts/index/*` (CDK now adds this policy).

## API reference

### POST /ingest
Ingest one or many posts.
```json
{
  "tweetId": "123",
  "username": "satoshi",
  "tweetContent": "Buying $DOGE today",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "ticker": "DOGE",
  "contractAddress": "0x0000000000000000000000000000000000000000",
  "pairUrl": "https://dexscreener.com/bsc/0x0000"
}
```
Response:
```json
{ "ok": true, "count": 1 }
```

### GET /posts
Query posts with pagination.
- `limit` (1–100, default 10)
- `nextToken` (base64 of DynamoDB LastEvaluatedKey)

Response:
```json
{
  "ok": true,
  "count": 20,
  "items": [...],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextToken": "eyJ..."
  }
}
```

## Dashboard
- `dashboard/config.js`: set `API_BASE_URL` to your ApiUrl (must end with `/prod/`).
- Fetches `/posts?limit=20` with pagination (“Load more”).
- UI: search, ticker/address badges, address links to `pairUrl`.
- Hosted on S3 + CloudFront; wait 1–2 minutes after deploy or hard-refresh (Cmd+Shift+R / Ctrl+F5).

## Project structure
- `src/ingest.ts`: Ingest Lambda (direct entry).
- `src/posts.ts`: Posts Lambda with pagination.
- `src/handlers/ingest.ts`, `src/handlers/posts.ts`: CDK entrypoints for Lambdas.
- `src/handlers/trade.ts`: placeholder.
- `src/lib/*`: DynamoDB client, helpers.
- `src/local/server.ts`: local Express mirror of `/ingest` + `/posts`.
- `lib/crypto-monitor-stack.ts`: CDK stack (API, Lambdas, S3, CloudFront, IAM).
- `dashboard/*`: React dashboard (htm + CDN React) with pagination.
- `scripts/*`: Deploy/test helpers.

## Testing
- `npm run build`
- `npx tsx scripts/test-ingest.ts`
- `npx tsx scripts/test-query.ts`
- `npm test` (Vitest; minimal tests, extend as needed)

## Troubleshooting
- **Internal server error on /posts:** ensure Posts Lambda has `dynamodb:Query` on `table/Posts/index/*`; confirm GSI1 exists and TABLE_POSTS is correct.
- **CORS in browser:** API responses must include `Access-Control-Allow-Origin:*`; avoid Lambda errors that fall back to API Gateway 4xx/5xx (those lack CORS by default). Add GatewayResponse CORS if needed.
- **CloudFront still serving old assets:** wait 1–2 minutes or hard refresh; redeploy after updating `dashboard/config.js`.

## Features
- ✅ Real-time tweet ingestion with validation
- ✅ Single-table DynamoDB design with composite keys
- ✅ RESTful API for ingest and query operations
- ✅ Pagination support (limit + nextToken)
- ✅ Dashboard with search, filtering, and load-more
- ✅ CloudFront CDN for global low-latency access
- ✅ Idempotent writes to prevent duplicates
- ✅ CORS-enabled for cross-origin requests
- ✅ Infrastructure as code with AWS CDK

## Roadmap
- Implement trade signal generation in `trade.ts`.
- Add date-range filtering and richer analytics.
- Add auth (API keys or Cognito).
- Add CloudWatch dashboards/alarms.
- WebSocket / real-time updates.
