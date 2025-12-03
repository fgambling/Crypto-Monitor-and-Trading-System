"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/handlers/extract.ts
var extract_exports = {};
__export(extract_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(extract_exports);
var import_lib_dynamodb2 = require("@aws-sdk/lib-dynamodb");

// src/lib/db.ts
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var REGION = process.env.AWS_REGION || "ap-southeast-2";
var client = new import_client_dynamodb.DynamoDBClient({ region: REGION });
var ddb = import_lib_dynamodb.DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});
var TABLE_POSTS = process.env.TABLE_POSTS || "Posts";
var TABLE_SIGNALS = process.env.TABLE_SIGNALS || "Signals";

// src/lib/mapping.ts
var aliases = {
  "doge": "DOGEUSDT",
  "pepe": "PEPEUSDT",
  "arb": "ARBUSDT",
  "btc": "BTCUSDT",
  "eth": "ETHUSDT"
};
function extractSymbolsFromText(text) {
  const lower = text.toLowerCase();
  const hits = Object.entries(aliases).filter(([k]) => lower.includes(k)).map(([, sym]) => sym);
  return Array.from(new Set(hits));
}

// src/lib/trade.ts
async function priceNow(symbol) {
  return 1.23;
}
async function simulateBuy(symbol, price) {
  const budgetUSD = 100;
  const qty = budgetUSD / price;
  const fee = 1e-3 * budgetUSD;
  return { qty, entryPrice: price, fee };
}
async function buildSignal(params) {
  const p = await priceNow(params.symbol);
  const sim = await simulateBuy(params.symbol, p);
  return {
    id: `${params.tweetId}:${params.symbol}`,
    symbol: params.symbol,
    keyword: params.keyword,
    sourceTweetId: params.tweetId,
    decidedAt: (/* @__PURE__ */ new Date()).toISOString(),
    mode: "SIM",
    decision: "BUY",
    pricing: { ref: "ticker", last: p },
    qty: sim.qty,
    fee: sim.fee,
    entryPrice: sim.entryPrice,
    strategyVersion: "v0.1"
  };
}

// src/handlers/extract.ts
var handler = async (event) => {
  for (const record of event?.Records ?? []) {
    const post = JSON.parse(record.body);
    const symbols = extractSymbolsFromText(post.text);
    for (const sym of symbols) {
      const sig = await buildSignal({ tweetId: post.tweetId, symbol: sym, keyword: sym });
      await ddb.send(new import_lib_dynamodb2.PutCommand({
        TableName: TABLE_SIGNALS,
        Item: {
          PK: `SYMBOL#${sig.symbol}`,
          SK: `TS#${sig.decidedAt}`,
          ...sig
        }
      }));
    }
  }
  return { statusCode: 200, body: "ok" };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
