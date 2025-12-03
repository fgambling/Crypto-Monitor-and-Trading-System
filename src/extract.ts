import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import axios from "axios";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const TABLE_SIGNALS = process.env.TABLE_SIGNALS ?? "Signals";
const MARKET_CAP_MIN = Number(process.env.MARKET_CAP_MIN ?? 0); // USD threshold to ignore tiny tokens
const VOLUME_MIN = Number(process.env.VOLUME_MIN ?? 0); // optional volume floor in USD

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

console.log("[extract] Lambda cold start", {
  REGION,
  TABLE_SIGNALS,
  MARKET_CAP_MIN,
  VOLUME_MIN,
});

interface TokenSearchResult {
  tokenAddress: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
}

export const handler = async (event: any) => {
  console.log("[extract] handler invoked, raw event:", JSON.stringify(event));

  const records = event?.Records ?? [];
  console.log("[extract] record count:", records.length);

  for (const [idx, record] of records.entries()) {
    console.log(`[extract] processing record #${idx}`, {
      hasBody: !!record.body,
    });

    if (!record.body) {
      console.warn("[extract] record has no body, skipping");
      continue;
    }

    let payload: any;
    try {
      payload = JSON.parse(record.body);
      console.log("[extract] parsed payload:", payload);
    } catch (err) {
      console.warn("[extract] Skipping record with invalid JSON body", err);
      continue;
    }

    const keywords: unknown = payload?.keywords;
    console.log("[extract] keywords from payload:", keywords);

    if (!Array.isArray(keywords) || keywords.length === 0) {
      console.log("[extract] no keywords array or empty, skipping payload");
      continue;
    }

    const seen = new Set<string>(); // dedupe by token address

    for (const keyword of keywords) {
      console.log("[extract] checking keyword:", keyword);

      if (typeof keyword !== "string" || keyword.trim() === "") {
        console.log("[extract] keyword is not a non-empty string, skip");
        continue;
      }

      const trimmed = keyword.trim();

      let token: TokenSearchResult | undefined;
      try {
        token = await findTokenOnBSC(trimmed);
      } catch (err) {
        console.warn("[extract] findTokenOnBSC threw for keyword", trimmed, err);
        continue;
      }

      if (!token) {
        console.log("[extract] no valid BSC token found for keyword", trimmed);
        continue;
      }

      console.log("[extract] candidate token found:", token);

      if (seen.has(token.tokenAddress)) {
        console.log("[extract] token already processed in this batch, dedupe", token.tokenAddress);
        continue;
      }
      seen.add(token.tokenAddress);

      const isoNow = new Date().toISOString();

      try {
        await dynamo.send(new PutCommand({
          TableName: TABLE_SIGNALS,
          Item: {
            PK: `TOKEN#${token.tokenAddress}`,
            SK: `TS#${isoNow}`,
            tweetId: payload?.tweetId,
            tokenAddress: token.tokenAddress,
            symbol: token.symbol,
            name: token.name,
            priceUsd: token.priceUsd,
            marketCapUsd: token.marketCapUsd,
            volume24hUsd: token.volume24hUsd,
          },
        }));
        console.log("[extract] saved signal to DynamoDB", {
          tweetId: payload?.tweetId,
          tokenAddress: token.tokenAddress,
          symbol: token.symbol,
          at: isoNow,
        });
      } catch (err) {
        console.warn("[extract] failed to save signal to DynamoDB", {
          tweetId: payload?.tweetId,
          tokenAddress: token.tokenAddress,
        }, err);
      }
    }
  }

  console.log("[extract] handler finished");
};

async function findTokenOnBSC(keyword: string): Promise<TokenSearchResult | undefined> {
  console.log("[extract] findTokenOnBSC called with keyword:", keyword);

  try {
    const response = await axios.get("https://api.dexscreener.com/latest/dex/search", {
      params: { q: keyword },
      timeout: 5000,
    });

    const pairs: any[] = Array.isArray(response.data?.pairs) ? response.data.pairs : [];
    console.log("[extract] DexScreener pairs length:", pairs.length);

    const bscPairs = pairs.filter((pair) => pair?.chainId === "bsc");
    console.log("[extract] DexScreener BSC pairs length:", bscPairs.length);

    if (bscPairs.length === 0) {
      console.log("[extract] no BSC pairs found for keyword", keyword);
      return undefined;
    }

    // pick the BSC pair with highest 24h volume
    const top = bscPairs.reduce((max, pair) => {
      const vol = Number(pair?.volume?.h24 ?? 0);
      return vol > Number(max?.volume?.h24 ?? 0) ? pair : max;
    }, bscPairs[0]);

    const baseToken = top?.baseToken;
    const priceUsdRaw = Number(top?.priceUsd);
    const marketCapRaw = Number(top?.fdv ?? top?.marketCap);
    const volume24hRaw = Number(top?.volume?.h24);

    console.log("[extract] top pair summary:", {
      baseToken,
      priceUsdRaw,
      marketCapRaw,
      volume24hRaw,
    });

    if (!baseToken?.address || !baseToken?.symbol || !baseToken?.name) {
      console.log("[extract] baseToken missing core fields, skip");
      return undefined;
    }
    if (!Number.isFinite(priceUsdRaw)) {
      console.log("[extract] priceUsdRaw not finite, skip");
      return undefined;
    }

    if (Number.isFinite(MARKET_CAP_MIN) && MARKET_CAP_MIN > 0 && Number.isFinite(marketCapRaw) && marketCapRaw < MARKET_CAP_MIN) {
      console.log("[extract] marketCap below threshold, skip", {
        marketCapRaw,
        MARKET_CAP_MIN,
      });
      return undefined;
    }

    if (Number.isFinite(VOLUME_MIN) && VOLUME_MIN > 0 && Number.isFinite(volume24hRaw) && volume24hRaw < VOLUME_MIN) {
      console.log("[extract] volume24h below threshold, skip", {
        volume24hRaw,
        VOLUME_MIN,
      });
      return undefined;
    }

    const result: TokenSearchResult = {
      tokenAddress: String(baseToken.address),
      symbol: String(baseToken.symbol),
      name: String(baseToken.name),
      priceUsd: priceUsdRaw,
      marketCapUsd: Number.isFinite(marketCapRaw) ? marketCapRaw : undefined,
      volume24hUsd: Number.isFinite(volume24hRaw) ? volume24hRaw : undefined,
    };

    console.log("[extract] findTokenOnBSC returning token:", result);
    return result;
  } catch (err) {
    console.warn("[extract] DexScreener search failed for keyword", keyword, err);
    return undefined;
  }
}
