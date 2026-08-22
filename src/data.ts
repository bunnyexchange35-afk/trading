export type Asset = {
  symbol: string;
  name: string;
  color: string;
  soft: string;
  mark: string;
  stakingApy?: number;
};

export type MarketQuote = Asset & {
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
};

export const ASSETS: Asset[] = [
  { symbol: 'BTC', name: 'Bitcoin', color: '#f7931a', soft: '#fff4e4', mark: '₿', stakingApy: 2.8 },
  { symbol: 'ETH', name: 'Ethereum', color: '#627eea', soft: '#eef1ff', mark: 'Ξ', stakingApy: 4.7 },
  { symbol: 'BNB', name: 'BNB', color: '#f3ba2f', soft: '#fff9df', mark: 'B', stakingApy: 3.4 },
  { symbol: 'SOL', name: 'Solana', color: '#7657ff', soft: '#f2efff', mark: 'S', stakingApy: 6.9 },
  { symbol: 'XRP', name: 'XRP', color: '#23292f', soft: '#edf0f2', mark: 'X', stakingApy: 2.2 },
  { symbol: 'ETC', name: 'Ethereum Classic', color: '#3ab83a', soft: '#eaf9ea', mark: 'E', stakingApy: 3.8 },
  { symbol: 'ADA', name: 'Cardano', color: '#316bd6', soft: '#edf4ff', mark: 'A', stakingApy: 5.1 },
  { symbol: 'DOGE', name: 'Dogecoin', color: '#c3a634', soft: '#fff9df', mark: 'Ð', stakingApy: 1.8 },
];

const fallbackPrices: Record<string, [number, number]> = {
  BTC: [116430.2, 2.84],
  ETH: [4284.51, 1.47],
  BNB: [873.22, -0.64],
  SOL: [184.76, 4.92],
  XRP: [2.18, -1.23],
  ETC: [23.74, 0.82],
  ADA: [0.728, 3.16],
  DOGE: [0.2184, -0.42],
};

export const FALLBACK_QUOTES: MarketQuote[] = ASSETS.map((asset) => {
  const [price, change] = fallbackPrices[asset.symbol];
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
