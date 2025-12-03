// Simple alias map: text → *USDT symbol
const aliases: Record<string, string> = {
  "doge": "DOGEUSDT",
  "pepe": "PEPEUSDT",
  "arb":  "ARBUSDT",
  "btc":  "BTCUSDT",
  "eth":  "ETHUSDT"
};

export function extractSymbolsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const hits = Object.entries(aliases)
    .filter(([k]) => lower.includes(k))
    .map(([, sym]) => sym);
  return Array.from(new Set(hits));
}
