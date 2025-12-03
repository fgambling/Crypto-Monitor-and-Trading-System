import axios from "axios";

const API_URL = process.env.API_URL;

if (!API_URL) {
  console.error("Set API_URL to the CryptoMonitorStack.ApiUrl output (without /ingest).");
  process.exit(1);
}

const payload = {
  tweetId: "t-demo-1",
  userId: "u-demo-1",
  username: "demo",
  text: "DOGE to the moon!",
  createdAt: "2025-11-03T06:22:54.000Z",
  keywords: ["doge"],
  sentiment: "bullish"
};

async function main() {
  const endpoint = `${API_URL.replace(/\/$/, "")}/ingest`;

  const response = await axios.post(endpoint, payload, {
    headers: { "Content-Type": "application/json" }
  });

  console.log("Response:", response.data);
}

main().catch((err) => {
  if (axios.isAxiosError(err)) {
    console.error("Request failed:", err.response?.status, err.response?.data ?? err.message);
  } else {
    console.error("Unexpected error:", err);
  }
  process.exit(1);
});
