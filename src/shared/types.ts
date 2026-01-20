export interface IngestRecord {
  tweetId: string;
  username: string;
  tweetContent: string;
  createdAt: string; // ISO
  ticker: string;
  contractAddress: string;
  pairUrl: string;
  [key: string]: unknown;
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
