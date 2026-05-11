import { Asset } from './types';

export const MOCK_ASSETS: Asset[] = [
  // Fallback-цены (RUB, ~90 RUB/USD) — показываются мгновенно при первом визите,
  // пока не придут реальные котировки из API. priceUnavailable=false чтобы UI не фильтровал.
  { id: '1', ticker: 'BTC', name: 'Bitcoin', price: 9_000_000, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '2', ticker: 'ETH', name: 'Ethereum', price: 300_000, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '3', ticker: 'SOL', name: 'Solana', price: 15_000, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '4', ticker: 'TON', name: 'Toncoin', price: 500, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '5', ticker: 'USDT', name: 'Tether', price: 90, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '6', ticker: 'XRP', name: 'Ripple', price: 25, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '7', ticker: 'DOGE', name: 'Dogecoin', price: 1.8, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '8', ticker: 'ADA', name: 'Cardano', price: 7, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '9', ticker: 'AVAX', name: 'Avalanche', price: 2_000, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '10', ticker: 'DOT', name: 'Polkadot', price: 40, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '11', ticker: 'LINK', name: 'Chainlink', price: 1_300, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '12', ticker: 'MATIC', name: 'Polygon', price: 50, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
];

export const MARKET_ASSETS: Asset[] = [
  ...MOCK_ASSETS,
  // Криптовалюты — fallback-цены (RUB) для мгновенного отображения
  { id: '13', ticker: 'SHIB', name: 'Shiba Inu', price: 0.0018, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '14', ticker: 'LTC', name: 'Litecoin', price: 9_000, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '15', ticker: 'TRX', name: 'Tron', price: 2.5, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '16', ticker: 'BCH', name: 'Bitcoin Cash', price: 4_500, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '17', ticker: 'NEAR', name: 'NEAR Protocol', price: 280, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '18', ticker: 'APT', name: 'Aptos', price: 500, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '19', ticker: 'ATOM', name: 'Cosmos', price: 90, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '20', ticker: 'XLM', name: 'Stellar', price: 4, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '21', ticker: 'ARB', name: 'Arbitrum', price: 40, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '22', ticker: 'OP', name: 'Optimism', price: 80, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '23', ticker: 'INJ', name: 'Injective', price: 1_000, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '24', ticker: 'RNDR', name: 'Render', price: 450, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '25', ticker: 'PEPE', name: 'Pepe', price: 0.0012, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '26', ticker: 'FIL', name: 'Filecoin', price: 50, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '27', ticker: 'HBAR', name: 'Hedera', price: 18, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '28', ticker: 'KAS', name: 'Kaspa', price: 12, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '29', ticker: 'VET', name: 'VeChain', price: 2.5, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '30', ticker: 'ICP', name: 'Internet Computer', price: 90, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '31', ticker: 'SUI', name: 'Sui', price: 280, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '32', ticker: 'SEI', name: 'Sei', price: 25, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '33', ticker: 'WIF', name: 'dogwifhat', price: 70, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '34', ticker: 'BONK', name: 'Bonk', price: 0.0018, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '35', ticker: 'FLOKI', name: 'Floki', price: 0.0012, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '36', ticker: 'STX', name: 'Stacks', price: 80, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '37', ticker: 'TIA', name: 'Celestia', price: 50, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '38', ticker: 'IMX', name: 'Immutable X', price: 130, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '39', ticker: 'FET', name: 'Fetch.ai', price: 70, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '40', ticker: 'RUNE', name: 'THORChain', price: 110, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '41', ticker: 'AAVE', name: 'Aave', price: 1_500, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '42', ticker: 'MKR', name: 'Maker', price: 1_400_000, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '43', ticker: 'CRV', name: 'Curve DAO', price: 35, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '44', ticker: 'UNI', name: 'Uniswap', price: 70, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '45', ticker: 'SAND', name: 'The Sandbox', price: 30, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '46', ticker: 'MANA', name: 'Decentraland', price: 35, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '47', ticker: 'AXS', name: 'Axie Infinity', price: 50, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '48', ticker: 'EGLD', name: 'MultiversX', price: 2_000, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '49', ticker: 'FTM', name: 'Fantom', price: 40, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },
  { id: '50', ticker: 'ALGO', name: 'Algorand', price: 18, volume24h: 0, change24h: 0, category: 'crypto', priceUnavailable: false },

];

/** US-акции: fallback-цены (RUB) для мгновенного отображения, обновляются из Finnhub. */
export const STOCK_MARKET_ASSETS: Asset[] = [
  { id: 'st1', ticker: 'NVDA', name: 'NVIDIA Corporation', price: 10_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/nvidia--600.png', tagline: 'Лидер AI и чипов, самая активная акция' },
  { id: 'st2', ticker: 'TSLA', name: 'Tesla, Inc.', price: 25_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/tesla--600.png', tagline: 'Высокий объём торгов, волатильность' },
  { id: 'st3', ticker: 'AAPL', name: 'Apple Inc.', price: 18_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/apple--600.png', tagline: 'Классика, огромная капитализация' },
  { id: 'st4', ticker: 'MSFT', name: 'Microsoft Corporation', price: 39_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/microsoft--600.png', tagline: 'Лидер облаков и AI' },
  { id: 'st5', ticker: 'AMZN', name: 'Amazon.com, Inc.', price: 17_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/amazon--600.png', tagline: 'E-commerce + облако' },
  { id: 'st6', ticker: 'GOOGL', name: 'Alphabet Inc.', price: 15_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/alphabet--600.png', tagline: 'Google, YouTube, AI' },
  { id: 'st7', ticker: 'META', name: 'Meta Platforms', price: 50_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/meta-platforms--600.png', tagline: 'Соцсети + реклама + метавселенная' },
  { id: 'st8', ticker: 'AVGO', name: 'Broadcom Inc.', price: 17_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/broadcom--600.png', tagline: 'Полупроводники, AI' },
  { id: 'st9', ticker: 'PLTR', name: 'Palantir Technologies', price: 9_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/palantir--600.png', tagline: 'Очень популярна в 2025–2026 среди розницы' },
  { id: 'st10', ticker: 'AMD', name: 'Advanced Micro Devices', price: 9_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/advanced-micro-devices--600.png', tagline: 'Конкурент NVIDIA' },
  { id: 'st11', ticker: 'INTC', name: 'Intel Corporation', price: 2_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/intel--600.png', tagline: 'Высокий объём торгов в 2026' },
  { id: 'st12', ticker: 'SMCI', name: 'Super Micro Computer', price: 3_200, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/super-micro-computer--600.png', tagline: 'Серверы для AI' },
  { id: 'st13', ticker: 'ARM', name: 'Arm Holdings', price: 11_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/arm--600.png', tagline: 'Дизайн чипов' },
  { id: 'st14', ticker: 'COIN', name: 'Coinbase Global', price: 18_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/coinbase--600.png', tagline: 'Крипто-биржа, коррелирует с биткоином' },
  { id: 'st15', ticker: 'HOOD', name: 'Robinhood Markets', price: 4_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/robinhood--600.png', tagline: 'Популярна среди розничных трейдеров' },
  { id: 'st16', ticker: 'SOFI', name: 'SoFi Technologies', price: 1_100, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/sofi--600.png', tagline: 'Финтех, высокая активность' },
  { id: 'st17', ticker: 'NFLX', name: 'Netflix, Inc.', price: 90_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/netflix--600.png', tagline: 'Стриминг' },
  { id: 'st18', ticker: 'MU', name: 'Micron Technology', price: 9_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, logoUrl: 'https://s3-symbol-logo.tradingview.com/micron-technology--600.png', tagline: 'Память для AI' },
  { id: 'st19', ticker: 'ORCL', name: 'Oracle Corporation', price: 14_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, tradingViewSymbol: 'NYSE:ORCL', logoUrl: 'https://etoro-cdn.etorostatic.com/market-avatars/orcl/150x150.png', tagline: 'Облачные технологии и базы данных' },
  { id: 'st20', ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', price: 43_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, tradingViewSymbol: 'NYSE:BRK.B', logoUrl: 'https://porti.ru/resource/img/company/logo/29302.png', tagline: 'Холдинг Уоррена Баффета' },
  { id: 'st21', ticker: 'JPM', name: 'JPMorgan Chase & Co.', price: 22_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, tradingViewSymbol: 'NYSE:JPM', logoUrl: 'https://s3-symbol-logo.tradingview.com/jpmorgan-chase--600.png', tagline: 'Крупнейший банк США' },
  { id: 'st22', ticker: 'XOM', name: 'Exxon Mobil Corporation', price: 9_500, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, tradingViewSymbol: 'NYSE:XOM', logoUrl: 'https://s3-symbol-logo.tradingview.com/exxon--600.png', tagline: 'Нефть и газ' },
  { id: 'st23', ticker: 'TSM', name: 'Taiwan Semiconductor', price: 15_000, volume24h: 0, change24h: 0, category: 'stock', priceUnavailable: false, tradingViewSymbol: 'NYSE:TSM', logoUrl: 'https://s3-symbol-logo.tradingview.com/taiwan-semiconductor--600.png', tagline: 'Контрактное производство чипов' },
];

/** Локальный логотип из `public/mexc-logo.png` — без внешних CDN */
export const ETORO_LOGO_URL = `${import.meta.env.BASE_URL}mexc-logo.png`;

// CHART_DATA удалён: график рендерится по реальным котировкам провайдера (TradingView).