export interface PostEvent {
  tweetId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string; // ISO
  keywords?: string[];
  sentiment?: string;
}

export interface TradeSignal {
  id: string;                // `${tweetId}:${symbol}`
  symbol: string;            // e.g. DOGEUSDT
  keyword: string;           // matched alias
  sourceTweetId: string;
  decidedAt: string;         // ISO
  mode: 'SIM' | 'LIVE';
  decision: 'SKIP' | 'BUY' | 'SELL';
  pricing: { ref: 'bookTicker' | 'ticker'; bid?: number; ask?: number; last?: number };
  qty?: number;
  fee?: number;
  entryPrice?: number;
  pnl?: number;
  strategyVersion: string;
}
