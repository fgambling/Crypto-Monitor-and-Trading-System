import { TradeSignal } from "../shared/types";

export async function priceNow(symbol: string): Promise<number> {
  // MVP stub: replace with /api/v3/ticker/price or bookTicker later.
  return 1.23;
}

export async function simulateBuy(symbol: string, price: number) {
  const budgetUSD = 100;
  const qty = budgetUSD / price;
  const fee = 0.001 * budgetUSD; // 0.1% fee
  return { qty, entryPrice: price, fee };
}

export async function shouldTrade(_symbol: string): Promise<boolean> {
  // Placeholder for cooldown/limits. Return true for MVP.
  return true;
}

export async function buildSignal(params: {
  tweetId: string;
  symbol: string;
  keyword: string;
}): Promise<TradeSignal> {
  const p = await priceNow(params.symbol);
  const sim = await simulateBuy(params.symbol, p);
  return {
    id: `${params.tweetId}:${params.symbol}`,
    symbol: params.symbol,
    keyword: params.keyword,
    sourceTweetId: params.tweetId,
    decidedAt: new Date().toISOString(),
    mode: "SIM",
    decision: "BUY",
    pricing: { ref: "ticker", last: p },
    qty: sim.qty,
    fee: sim.fee,
    entryPrice: sim.entryPrice,
    strategyVersion: "v0.1"
  };
}
