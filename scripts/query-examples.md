# DynamoDB Console Checks

- **Posts table (`Posts`)**:  
  - Partition key: `PK = USER#u-demo-1`  
  - Sort key: `SK = TWEET#t-demo-1`  
  - Stored attributes: `text`, `username`, `createdAt`, `keywords`, `sentiment`

- **Signals table (`Signals`)**:  
  - Partition key: `PK = SYMBOL#DOGE`  
  - Sort key: starts with `TS#` followed by an ISO timestamp (e.g. `TS#2025-11-03T06:23:05.123Z`)  
  - Stored attributes: `tweetId`, `sentiment`, `price`, `symbol`, `keyword`

Steps:

1. Open the AWS Console → DynamoDB → Tables.  
2. Select `Posts`, then choose **Explore table items** and query by `PK = USER#u-demo-1`.  
3. Select `Signals`, query with `PK = SYMBOL#DOGE`. Sort descending on `SK` to view the most recent entry.  
4. If items are missing, confirm the Lambda executions in CloudWatch (`CryptoMonitorStack-IngestFunction`, `CryptoMonitorStack-ExtractFunction`).
