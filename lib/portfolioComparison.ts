import { PortfolioData, Holding, PortfolioComparison } from '@/types';

export class PortfolioComparisonService {
  comparePortfolios(today: PortfolioData, yesterday?: PortfolioData): PortfolioComparison {
    if (!yesterday) {
      return {
        today,
        yesterday: undefined,
        changes: {
          newHoldings: today.holdings,
          removedHoldings: [],
          quantityChanges: [],
        },
      };
    }

    const changes = this.calculateChanges(today.holdings, yesterday.holdings);

    return {
      today,
      yesterday,
      changes,
    };
  }

  private calculateChanges(
    todayHoldings: Holding[],
    yesterdayHoldings: Holding[]
  ): PortfolioComparison['changes'] {
    const todayMap = new Map(todayHoldings.map(h => [h.symbol, h]));
    const yesterdayMap = new Map(yesterdayHoldings.map(h => [h.symbol, h]));

    const newHoldings: Holding[] = [];
    const removedHoldings: Holding[] = [];
    const quantityChanges: Array<{
      symbol: string;
      oldQuantity: number;
      newQuantity: number;
      difference: number;
    }> = [];

    // Find new holdings
    for (const [symbol, holding] of todayMap) {
      if (!yesterdayMap.has(symbol)) {
        newHoldings.push(holding);
      }
    }

    // Find removed holdings and quantity changes
    for (const [symbol, yesterdayHolding] of yesterdayMap) {
      const todayHolding = todayMap.get(symbol);

      if (!todayHolding) {
        removedHoldings.push(yesterdayHolding);
      } else if (todayHolding.quantity !== yesterdayHolding.quantity) {
        quantityChanges.push({
          symbol,
          oldQuantity: yesterdayHolding.quantity,
          newQuantity: todayHolding.quantity,
          difference: todayHolding.quantity - yesterdayHolding.quantity,
        });
      }
    }

    return {
      newHoldings,
      removedHoldings,
      quantityChanges,
    };
  }

  generateChangesSummary(comparison: PortfolioComparison): string {
    const { changes } = comparison;
    let summary = '';

    if (changes.newHoldings.length > 0) {
      summary += `New Holdings (${changes.newHoldings.length}):\n`;
      changes.newHoldings.forEach(holding => {
        summary += `  • ${holding.symbol} (${holding.name}): ${holding.quantity} shares @ $${holding.price.toFixed(2)}\n`;
      });
      summary += '\n';
    }

    if (changes.removedHoldings.length > 0) {
      summary += `Removed Holdings (${changes.removedHoldings.length}):\n`;
      changes.removedHoldings.forEach(holding => {
        summary += `  • ${holding.symbol} (${holding.name}): ${holding.quantity} shares\n`;
      });
      summary += '\n';
    }

    if (changes.quantityChanges.length > 0) {
      summary += `Quantity Changes (${changes.quantityChanges.length}):\n`;
      changes.quantityChanges.forEach(change => {
        const direction = change.difference > 0 ? 'increased' : 'decreased';
        const absChange = Math.abs(change.difference);
        summary += `  • ${change.symbol}: ${direction} by ${absChange} shares (${change.oldQuantity} → ${change.newQuantity})\n`;
      });
      summary += '\n';
    }

    if (summary === '') {
      summary = 'No changes detected in portfolio holdings.\n';
    }

    return summary;
  }

  calculatePerformanceMetrics(comparison: PortfolioComparison): {
    totalValueChange: number;
    totalValueChangePercent: number;
    dayChange: number;
    dayChangePercent: number;
    topGainers: Holding[];
    topLosers: Holding[];
  } {
    const { today, yesterday } = comparison;

    let totalValueChange = 0;
    let totalValueChangePercent = 0;

    if (yesterday) {
      totalValueChange = today.totalValue - yesterday.totalValue;
      totalValueChangePercent = yesterday.totalValue > 0 
        ? (totalValueChange / yesterday.totalValue) * 100 
        : 0;
    }

    // Sort holdings by day change to find top gainers and losers
    const sortedByChange = [...today.holdings].sort((a, b) => b.dayChange - a.dayChange);
    const topGainers = sortedByChange.slice(0, 3).filter(h => h.dayChange > 0);
    const topLosers = sortedByChange.slice(-3).filter(h => h.dayChange < 0).reverse();

    return {
      totalValueChange,
      totalValueChangePercent,
      dayChange: today.dayChange,
      dayChangePercent: today.dayChangePercent,
      topGainers,
      topLosers,
    };
  }

  identifySignificantChanges(
    comparison: PortfolioComparison,
    thresholds: {
      newHoldingMinValue?: number;
      quantityChangeMinPercent?: number;
      priceChangeMinPercent?: number;
    } = {}
  ): {
    significantNewHoldings: Holding[];
    significantQuantityChanges: Array<{
      symbol: string;
      oldQuantity: number;
      newQuantity: number;
      difference: number;
      changePercent: number;
    }>;
    significantPriceChanges: Holding[];
  } {
    const {
      newHoldingMinValue = 1000,
      quantityChangeMinPercent = 10,
      priceChangeMinPercent = 5,
    } = thresholds;

    // Significant new holdings (above threshold value)
    const significantNewHoldings = comparison.changes.newHoldings.filter(
      holding => holding.value >= newHoldingMinValue
    );

    // Significant quantity changes (above threshold percentage)
    const significantQuantityChanges = comparison.changes.quantityChanges
      .map(change => ({
        ...change,
        changePercent: change.oldQuantity > 0 
          ? Math.abs(change.difference / change.oldQuantity) * 100 
          : 100,
      }))
      .filter(change => change.changePercent >= quantityChangeMinPercent);

    // Significant price changes (day change percentage above threshold)
    const significantPriceChanges = comparison.today.holdings.filter(
      holding => Math.abs(holding.dayChangePercent) >= priceChangeMinPercent
    );

    return {
      significantNewHoldings,
      significantQuantityChanges,
      significantPriceChanges,
    };
  }

  generateAlerts(comparison: PortfolioComparison): string[] {
    const alerts: string[] = [];
    const metrics = this.calculatePerformanceMetrics(comparison);
    const significant = this.identifySignificantChanges(comparison);

    // Portfolio value alerts
    if (Math.abs(metrics.totalValueChangePercent) > 5) {
      const direction = metrics.totalValueChange > 0 ? 'increased' : 'decreased';
      alerts.push(
        `🚨 Portfolio value ${direction} by ${Math.abs(metrics.totalValueChangePercent).toFixed(2)}% (${metrics.totalValueChange > 0 ? '+' : ''}$${metrics.totalValueChange.toFixed(2)})`
      );
    }

    // New significant holdings
    if (significant.significantNewHoldings.length > 0) {
      alerts.push(
        `📈 ${significant.significantNewHoldings.length} new significant holdings added (value > $1,000)`
      );
    }

    // Large quantity changes
    if (significant.significantQuantityChanges.length > 0) {
      alerts.push(
        `🔄 ${significant.significantQuantityChanges.length} holdings with significant quantity changes (>10%)`
      );
    }

    // Major price movements
    const majorMovements = significant.significantPriceChanges.filter(
      h => Math.abs(h.dayChangePercent) > 10
    );
    if (majorMovements.length > 0) {
      alerts.push(
        `⚡ ${majorMovements.length} holdings with major price movements (>10%)`
      );
    }

    return alerts;
  }
}