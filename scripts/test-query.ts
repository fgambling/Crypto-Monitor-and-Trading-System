import axios from "axios";

const API_URL = process.env.API_URL;

if (!API_URL) {
  console.error("❌ Set API_URL environment variable to your API Gateway URL");
  console.error("Example: export API_URL=https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod/");
  process.exit(1);
}

async function main() {
  const baseUrl = API_URL.replace(/\/$/, "");
  const postsEndpoint = `${baseUrl}/posts`;

  console.log("🔍 Testing Query API");
  console.log("================================");
  console.log(`Endpoint: ${postsEndpoint}\n`);

  try {
    // Test with default limit
    console.log("📥 Fetching posts (default limit)...");
    const response = await axios.get(postsEndpoint);
    
    console.log(`✅ Success!`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Count: ${response.data.count}`);
    
    if (response.data.data && Array.isArray(response.data.data)) {
      console.log(`\n📊 Sample posts (showing first 3):\n`);
      response.data.data.slice(0, 3).forEach((post: any, idx: number) => {
        console.log(`${idx + 1}. Tweet ID: ${post.tweetId}`);
        console.log(`   User: @${post.username}`);
        console.log(`   Ticker: $${post.ticker}`);
        console.log(`   Content: "${post.tweetContent}"`);
        console.log(`   Created: ${post.createdAt}\n`);
      });
    }

    // Test with custom limit
    console.log("📥 Fetching posts (limit=5)...");
    const limitResponse = await axios.get(`${postsEndpoint}?limit=5`);
    console.log(`✅ Limited query returned ${limitResponse.data.count} items`);

    console.log("\n================================");
    console.log("✅ Query tests passed!");
    
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("❌ Query failed:", err.response?.status, err.response?.data ?? err.message);
    } else {
      console.error("❌ Unexpected error:", err);
    }
    process.exit(1);
  }
}

main();
