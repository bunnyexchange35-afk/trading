export type Asset = {
  symbol: string;
  name: string;
  color: string;
  soft: string;
  mark: string;
  /** Flexible vault APY (A tier) */
  stakingApy?: number;
  /** Locked 30-day vault APY (B tier) */
  stakingApyLocked?: number;
  /** Market category for filters */
  category: string;
};

export type MarketQuote = Asset & {
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
};

/**
 * Mudrexx Earn asset universe.
 *
 * Every symbol maps to a live Coinbase Exchange product (public endpoints):
 * the provider prefers `USDT` pairs, then `USD`, then `USDC` — resolved at
 * runtime against the products list so the listing never drifts.
 */
export const ASSETS: Asset[] = [
  { symbol: 'BTC', name: 'Bitcoin', color: '#F7931A', soft: '#2A1E0A', mark: '₿', stakingApy: 2.8, stakingApyLocked: 3.6, category: 'Store of Value' },
  { symbol: 'ETH', name: 'Ethereum', color: '#8A9BFF', soft: '#1B1E38', mark: 'Ξ', stakingApy: 4.7, stakingApyLocked: 6.2, category: 'DeFi' },
  { symbol: 'SOL', name: 'Solana', color: '#14F195', soft: '#0B2E22', mark: '◎', stakingApy: 6.9, stakingApyLocked: 8.4, category: 'Layer 1' },
  { symbol: 'XRP', name: 'XRP', color: '#4DA7FF', soft: '#101D33', mark: '✕', stakingApy: 2.2, stakingApyLocked: 3.1, category: 'Payments' },
  { symbol: 'DOGE', name: 'Dogecoin', color: '#D9B23C', soft: '#2C2408', mark: 'Ð', stakingApy: 1.8, stakingApyLocked: 2.6, category: 'Meme' },
  { symbol: 'ADA', name: 'Cardano', color: '#2F7CF6', soft: '#0E1D3A', mark: '₳', stakingApy: 5.1, stakingApyLocked: 6.4, category: 'Layer 1' },
  { symbol: 'LTC', name: 'Litecoin', color: '#8FA3C4', soft: '#151B26', mark: 'Ł', stakingApy: 2.4, stakingApyLocked: 3.2, category: 'Payments' },
  { symbol: 'LINK', name: 'Chainlink', color: '#3A6EF5', soft: '#0F1A3A', mark: '⬡', stakingApy: 4.3, stakingApyLocked: 5.7, category: 'Infra' },
  { symbol: 'AVAX', name: 'Avalanche', color: '#E84142', soft: '#331012', mark: '▲', stakingApy: 7.1, stakingApyLocked: 9.2, category: 'Layer 1' },
  { symbol: 'DOT', name: 'Polkadot', color: '#E6007A', soft: '#300B22', mark: '●', stakingApy: 8.4, stakingApyLocked: 11.6, category: 'Layer 1' },
  { symbol: 'POL', name: 'Polygon', color: '#9A5BFF', soft: '#20113A', mark: '◆', stakingApy: 4.9, stakingApyLocked: 6.3, category: 'Scaling' },
  { symbol: 'UNI', name: 'Uniswap', color: '#FF5DA2', soft: '#331019', mark: 'U', stakingApy: 3.7, stakingApyLocked: 4.9, category: 'DeFi' },
  { symbol: 'AAVE', name: 'Aave', color: '#4DE3D4', soft: '#0D2624', mark: 'A', stakingApy: 4.1, stakingApyLocked: 5.4, category: 'DeFi' },
  { symbol: 'ATOM', name: 'Cosmos', color: '#8E8FE8', soft: '#1A1A38', mark: '⚛', stakingApy: 9.6, stakingApyLocked: 12.4, category: 'Layer 1' },
  { symbol: 'XLM', name: 'Stellar', color: '#7FD8F5', soft: '#0E252E', mark: '✦', stakingApy: 2.6, stakingApyLocked: 3.5, category: 'Payments' },
  { symbol: 'SHIB', name: 'Shiba Inu', color: '#FF9E2C', soft: '#2E1B07', mark: 'S', stakingApy: 3.2, stakingApyLocked: 4.4, category: 'Meme' },
  { symbol: 'NEAR', name: 'NEAR Protocol', color: '#3DE1B4', soft: '#0B2A22', mark: 'N', stakingApy: 8.7, stakingApyLocked: 11.2, category: 'Layer 1' },
  { symbol: 'APT', name: 'Aptos', color: '#3CD6F5', soft: '#0C2630', mark: 'A', stakingApy: 6.4, stakingApyLocked: 8.1, category: 'Layer 1' },
  { symbol: 'ARB', name: 'Arbitrum', color: '#3FA9FF', soft: '#0E1F33', mark: 'A', stakingApy: 3.4, stakingApyLocked: 4.6, category: 'Scaling' },
  { symbol: 'OP', name: 'Optimism', color: '#FF4F4F', soft: '#301010', mark: 'O', stakingApy: 3.9, stakingApyLocked: 5.1, category: 'Scaling' },
  { symbol: 'SUI', name: 'Sui', color: '#6FB8FF', soft: '#101E30', mark: 'S', stakingApy: 5.3, stakingApyLocked: 6.9, category: 'Layer 1' },
  { symbol: 'PEPE', name: 'Pepe', color: '#4FA344', soft: '#12260F', mark: 'P', stakingApy: 2.1, stakingApyLocked: 3.0, category: 'Meme' },
  { symbol: 'BONK', name: 'Bonk', color: '#F7A600', soft: '#2E2006', mark: 'B', stakingApy: 2.9, stakingApyLocked: 4.0, category: 'Meme' },
  { symbol: 'FIL', name: 'Filecoin', color: '#2E9BF5', soft: '#0D1D33', mark: '⨎', stakingApy: 4.4, stakingApyLocked: 5.8, category: 'Storage' },
  { symbol: 'TON', name: 'Toncoin', color: '#38A9F5', soft: '#0D2030', mark: 'T', stakingApy: 3.6, stakingApyLocked: 4.8, category: 'Layer 1' },
  { symbol: 'INJ', name: 'Injective', color: '#3DF0FF', soft: '#0B2830', mark: 'I', stakingApy: 10.8, stakingApyLocked: 14.2, category: 'DeFi' },
  { symbol: 'RENDER', name: 'Render', color: '#F5584A', soft: '#301410', mark: 'R', stakingApy: 4.2, stakingApyLocked: 5.6, category: 'AI' },
  { symbol: 'SEI', name: 'Sei', color: '#E85D8E', soft: '#30111E', mark: 'S', stakingApy: 5.8, stakingApyLocked: 7.5, category: 'Layer 1' },
  { symbol: 'ONDO', name: 'Ondo', color: '#4FA8F5', soft: '#0F2033', mark: 'O', stakingApy: 5.5, stakingApyLocked: 7.1, category: 'RWA' },
  { symbol: 'ENA', name: 'Ethena', color: '#6FD8F0', soft: '#0E262E', mark: 'E', stakingApy: 6.1, stakingApyLocked: 8.0, category: 'DeFi' },
  { symbol: 'HBAR', name: 'Hedera', color: '#A3A9B8', soft: '#171A20', mark: 'ℏ', stakingApy: 3.3, stakingApyLocked: 4.4, category: 'Layer 1' },
  { symbol: 'FET', name: 'Fetch.ai', color: '#9A5BFF', soft: '#1C1233', mark: 'F', stakingApy: 5.2, stakingApyLocked: 6.8, category: 'AI' },
];

/** Categories present in the universe, in display order. */
export const CATEGORIES: string[] = [...new Set(ASSETS.map((asset) => asset.category))];

/** Quote-currency preference used to resolve live Coinbase products per asset. */
export const COINBASE_QUOTES = ['USDT', 'USD', 'USDC'] as const;

/** Builds the candidate Coinbase product ids for a symbol (best quote first). */
export function coinbaseCandidates(symbol: string): string[] {
  return COINBASE_QUOTES.map((quote) => `${symbol}-${quote}`);
}

/**
 * Last-known prices (USD) per symbol. These are used ONLY as a warm cache /
 * demo fallback while the live Coinbase feed is unreachable — the live feed
 * overrides them within seconds of the page loading.
 */
const fallbackPrices: Record<string, [number, number]> = {
  BTC: [116430.2, 2.84], ETH: [4284.51, 1.47], SOL: [184.76, 4.92], XRP: [2.18, -1.23],
  DOGE: [0.2184, -0.42], ADA: [0.728, 3.16], LTC: [92.4, 1.05], LINK: [17.85, 2.3],
  AVAX: [26.3, 5.4], DOT: [6.42, -0.85], POL: [0.51, 1.7], UNI: [9.85, -1.4],
  AAVE: [178.4, 2.9], ATOM: [6.85, 0.64], XLM: [0.372, 1.3], SHIB: [0.0000218, -2.1],
  NEAR: [5.6, 3.4], APT: [8.9, -0.75], ARB: [0.94, 2.2], OP: [1.72, 1.1],
  SUI: [2.85, 4.6], PEPE: [0.0000124, -3.2], BONK: [0.000021, 2.8], FIL: [4.85, -0.9],
  TON: [5.3, 0.45], INJ: [18.2, 6.1], RENDER: [7.6, 3.9], SEI: [0.42, -1.8],
  ONDO: [0.98, 2.5], ENA: [0.62, 4.1], HBAR: [0.182, 1.9], FET: [1.26, 5.2],
};

/** Deterministic demo 24h change so the warm cache never jitters. */
function seededChange(symbol: string): number {
  let hash = 0;
  for (const char of symbol) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return Number(((hash % 800) / 100 - 3.5).toFixed(2));
}

export const FALLBACK_QUOTES: MarketQuote[] = ASSETS.map((asset) => {
  const [price, change] = fallbackPrices[asset.symbol] ?? [1, seededChange(asset.symbol)];
  return {
    ...asset,
    price,
    change,
    high: price * 1.035,
    low: price * 0.968,
    volume: price * 28435,
  };
});

export const INR_RATE = 88.5;

export function money(value: number, currency: 'USD' | 'INR' = 'USD', digits?: number) {
  const maximumFractionDigits = digits ?? (value < 1 ? 4 : value < 100 ? 2 : 0);
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(value);
}

export function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}
