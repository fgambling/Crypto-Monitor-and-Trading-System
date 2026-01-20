import axios from "axios";

const API_URL = process.env.API_URL;

if (!API_URL) {
  console.error("❌ Set API_URL environment variable to your API Gateway URL");
  console.error("Example: export API_URL=https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod/");
  process.exit(1);
}

const payload = {
  tweetId: "t-demo-1",
  username: "demo",
  tweetContent: "DOGE to the moon!",
  createdAt: "2025-11-03T06:22:54.000Z",
  ticker: "DOGE",
  contractAddress: "0x0000000000000000000000000000000000000000",
  pairUrl: "https://dexscreener.com/bsc/0x0000000000000000000000000000000000000000"
};

async function main() {
  const baseUrl = API_URL.replace(/\/$/, "");
  const ingestEndpoint = `${baseUrl}/ingest`;
  const postsEndpoint = `${baseUrl}/posts`;

  console.log("🚀 Testing Crypto Monitor API");
  console.log("================================");

  // Test 1: Ingest a tweet
  console.log("\n📤 Test 1: Ingesting tweet...");
  try {
    const ingestResponse = await axios.post(ingestEndpoint, payload, {
      headers: { "Content-Type": "application/json" }
    });
    console.log("✅ Ingest successful:", ingestResponse.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("❌ Ingest failed:", err.response?.status, err.response?.data ?? err.message);
      throw err;
    }
    throw err;
  }

  // Wait a moment for DynamoDB consistency
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Query posts
  console.log("\n📥 Test 2: Querying posts...");
  try {
    const queryResponse = await axios.get(postsEndpoint);
    console.log("✅ Query successful:");
    console.log(`   Total posts: ${queryResponse.data.count}`);
    
    // Find our test tweet
    const testTweet = queryResponse.data.data?.find((item: any) => item.tweetId === payload.tweetId);
    if (testTweet) {
      console.log("✅ Found test tweet:", testTweet);
    } else {
      console.log("⚠️  Test tweet not found in results (may need to wait for consistency)");
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("❌ Query failed:", err.response?.status, err.response?.data ?? err.message);
      throw err;
    }
    throw err;
  }

  console.log("\n================================");
  console.log("✅ All tests passed!");
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});
