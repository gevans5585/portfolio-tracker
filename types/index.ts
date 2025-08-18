export interface PortfolioData {
  accountName: string;
  accountNumber: string;
  holdings: Holding[];
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  date: string;
}

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  dayChange: number;
  dayChangePercent: number;
  // Extended performance data
  performance?: PerformanceData;
}

export interface PerformanceData {
  finalEquity: number;
  probabilityWin: number;
  returnYTD: number;
  return1Month: number;
  return3Month: number;
  return6Month: number;
  return12Month: number;
  tradesYTD: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  cagr: number;
  volatility: number;
  portfolio: string;
  mlAccuracies: string;
  greenHoldings?: string[]; // Holdings that appear in green text (new trades)
}

export interface PortfolioChange {
  modelName: string;
  accountName: string;
  addedHoldings: string[]; // Green holdings (new trades)
  removedHoldings: string[]; // Holdings that disappeared
  date: string;
}

export interface ChangeAlert {
  hasChanges: boolean;
  changes: PortfolioChange[];
  totalChanges: number;
  affectedAccounts: string[];
  date: string;
  comparisonDate: string | null; // The previous trading day we compared against, or null if no comparison
  message?: string; // Human-readable explanation (e.g., "Markets closed - Weekend")
}

export interface AccountMapping {
  emailAccount: string;
  displayName: string;
  accountNumber: string;
  category: string;
}

export interface PortfolioComparison {
  today: PortfolioData;
  yesterday?: PortfolioData;
  changes: {
    newHoldings: Holding[];
    removedHoldings: Holding[];
    quantityChanges: Array<{
      symbol: string;
      oldQuantity: number;
      newQuantity: number;
      difference: number;
    }>;
  };
}