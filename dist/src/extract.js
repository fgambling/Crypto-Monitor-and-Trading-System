import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import axios from "axios";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const TABLE_SIGNALS = process.env.TABLE_SIGNALS ?? "Signals";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } });
const SYMBOL_CACHE = new Map();
export const handler = async (event) => {
    const records = event?.Records ?? [];
    for (const record of records) {
        if (!record.body) {
            continue;
        }
        let payload;
        try {
            payload = JSON.parse(record.body);
        }
        catch (err) {
            console.warn("Skipping record with invalid JSON body", err);
            continue;
        }
        const keywords = payload?.keywords;
        if (!Array.isArray(keywords) || keywords.length === 0) {
            continue;
        }
        const seen = new Set();
        for (const keyword of keywords) {
            if (typeof keyword !== "string" || keyword.trim() === "") {
                continue;
            }
            const base = keyword.toUpperCase();
            const symbol = `${base}USDT`;
            if (seen.has(symbol)) {
                continue;
            }
            seen.add(symbol);
            const valid = await ensureSymbol(symbol);
            if (!valid) {
                continue;
            }
            const price = await fetchPrice(symbol);
            if (price === undefined) {
                continue;
            }
            const isoNow = new Date().toISOString();
            await dynamo.send(new PutCommand({
                TableName: TABLE_SIGNALS,
                Item: {
                    PK: `SYMBOL#${base}`,
                    SK: `TS#${isoNow}`,
                    tweetId: payload?.tweetId,
                    sentiment: payload?.sentiment,
                    price,
                    symbol,
                    keyword: base
                }
            }));
        }
    }
};
async function ensureSymbol(symbol) {
    if (SYMBOL_CACHE.has(symbol)) {
        return SYMBOL_CACHE.get(symbol) ?? false;
    }
    try {
        const response = await axios.get("https://api.binance.com/api/v3/exchangeInfo", {
            params: { symbol },
            timeout: 5000
        });
        const exists = Array.isArray(response.data?.symbols) && response.data.symbols.length > 0;
        SYMBOL_CACHE.set(symbol, exists);
        return exists;
    }
    catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 400) {
            SYMBOL_CACHE.set(symbol, false);
            return false;
        }
        console.warn("Failed to verify symbol", symbol, err);
        return false;
    }
}
async function fetchPrice(symbol) {
    try {
        const response = await axios.get("https://api.binance.com/api/v3/ticker/price", {
            params: { symbol },
            timeout: 5000
        });
        const price = Number(response.data?.price);
        return Number.isFinite(price) ? price : undefined;
    }
    catch (err) {
        console.warn("Failed to fetch price for", symbol, err);
        return undefined;
    }
}
