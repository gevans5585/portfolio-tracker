import { CombinedAccountService, CombinedAccountPortfolio } from './combinedAccountService';
import { ModelWatchListService, WatchListModel } from './modelWatchListService';

export interface SignificantMove {
  modelName: string;
  accountName: string;
  priceChange: number;
  valueChange: number;
  significance: 'high' | 'medium' | 'low';
}

export interface DailyModelMove {
  modelName: string;
  accountName: string;
  dailyChange: number;
  significance: 'high' | 'medium' | 'low';
}

export interface DailySecurityMove {
  securitySymbol: string;
  dailyChange: number;
  modelName: string;
  accountName: string;
  significance: 'high' | 'medium' | 'low';
}

export interface UnderperformingModel {
  modelName: string;
  accountName: string;
  return12Month: number;
  returnYTD: number;
  performanceGap: number; // How much below top 5 average
}

export interface PortfolioAnalysisData {
  totalValue: number;
  totalModels: number;
  currentDate: string;
  modelPerformanceData: string;
  top5Performers: WatchListModel[];
  top5NotOwned: WatchListModel[];
  significantMoves: SignificantMove[];
  dailyModelMoves: DailyModelMove[];
  dailySecurityMoves: DailySecurityMove[];
  underperformingModels: UnderperformingModel[];
  bestPerformer12Mo: { name: string; return12Month: number } | null;
  worstPerformer12Mo: { name: string; return12Month: number } | null;
}

export class PortfolioAnalysisService {
  private combinedAccountService: CombinedAccountService;
  private modelWatchListService: ModelWatchListService;

  constructor() {
    this.combinedAccountService = new CombinedAccountService();
    this.modelWatchListService = new ModelWatchListService();
  }

  /**
   * Generate comprehensive portfolio analysis for ChatGPT commentary
   */
  async generateAnalysisData(dateStr?: string): Promise<PortfolioAnalysisData> {
    try {
      const date = dateStr || new Date().toISOString().split('T')[0];
      console.log(`Generating portfolio analysis for ${date}`);

      // Get combined account portfolios and watch list
      const [combinedAccounts, watchListData] = await Promise.all([
        this.combinedAccountService.getCombinedAccountPortfolios(date),
        this.modelWatchListService.getModelWatchList(date)
      ]);

      // Calculate basic metrics
      const totalValue = combinedAccounts.reduce((sum, account) => sum + account.totalValueAllCurrencies, 0);
      const totalModels = combinedAccounts.reduce((sum, account) => 
        sum + account.currencies.reduce((currSum, curr) => currSum + curr.models.length, 0), 0
      );

      // Get all models for analysis
      const allModels = this.extractAllModels(combinedAccounts);

      // Generate model performance summary
      const modelPerformanceData = this.generateModelPerformanceString(allModels);

      // Find significant moves (>5% price change or >3% portfolio value change)
      const significantMoves = this.findSignificantMoves(allModels, totalValue);

      // Find daily movements
      const [dailyModelMoves, dailySecurityMoves] = await this.findDailyMovements(date);

      // Find underperforming models (>10% below top 5 performers)
      const underperformingModels = this.findUnderperformingModels(allModels, watchListData.topPerformers);

      // Find top 5 not owned
      const top5NotOwned = watchListData.topPerformers.filter(model => !model.isOwned);

      // Find best and worst performers (12-month focus)
      const performers = this.findBestAndWorstPerformers(allModels);

      return {
        totalValue,
        totalModels,
        currentDate: date,
        modelPerformanceData,
        top5Performers: watchListData.topPerformers,
        top5NotOwned,
        significantMoves,
        dailyModelMoves,
        dailySecurityMoves,
        underperformingModels,
        bestPerformer12Mo: performers.best12Mo,
        worstPerformer12Mo: performers.worst12Mo
      };

    } catch (error) {
      console.error('Error generating portfolio analysis:', error);
      throw error;
    }
  }

  /**
   * Extract all models from combined accounts
   */
  private extractAllModels(combinedAccounts: CombinedAccountPortfolio[]): any[] {
    const allModels: any[] = [];

    for (const account of combinedAccounts) {
      for (const currencyPortfolio of account.currencies) {
        for (const model of currencyPortfolio.models) {
          allModels.push({
            ...model,
            accountName: account.baseAccountName,
            currency: currencyPortfolio.currency
          });
        }
      }
    }

    return allModels;
  }

  /**
   * Generate model performance summary string
   */
  private generateModelPerformanceString(models: any[]): string {
    const summaryLines: string[] = [];

    models.forEach(model => {
      const perf = model.performance;
      if (perf) {
        summaryLines.push(
          `${model.name} (${model.accountName}): YTD: ${perf.returnYTD?.toFixed(1) || 0}%, ` +
          `12Mo: ${perf.return12Month?.toFixed(1) || 0}%, ` +
          `Value: $${perf.finalEquity?.toLocaleString() || 0}`
        );
      }
    });

    return summaryLines.join('\n');
  }

  /**
   * Find models with significant overnight moves
   */
  private findSignificantMoves(models: any[], totalValue: number): SignificantMove[] {
    const significantMoves: SignificantMove[] = [];

    models.forEach(model => {
      const perf = model.performance;
      if (!perf) return;

      // Check for significant price movements (using YTD as proxy for recent performance)
      const priceChangePercent = Math.abs(perf.returnYTD || 0);
      const valueChange = Math.abs(perf.finalEquity || 0);
      const portfolioPercentage = (valueChange / totalValue) * 100;

      let significance: 'high' | 'medium' | 'low' = 'low';

      // Determine significance
      if (priceChangePercent > 15 || portfolioPercentage > 5) {
        significance = 'high';
      } else if (priceChangePercent > 10 || portfolioPercentage > 3) {
        significance = 'medium';
      } else if (priceChangePercent > 5 || portfolioPercentage > 1) {
        significance = 'low';
      } else {
        return; // Skip insignificant moves
      }

      significantMoves.push({
        modelName: model.name,
        accountName: model.accountName,
        priceChange: priceChangePercent,
        valueChange: portfolioPercentage,
        significance
      });
    });

    // Sort by significance and magnitude
    return significantMoves.sort((a, b) => {
      const significanceOrder = { high: 3, medium: 2, low: 1 };
      if (significanceOrder[a.significance] !== significanceOrder[b.significance]) {
        return significanceOrder[b.significance] - significanceOrder[a.significance];
      }
      return b.priceChange - a.priceChange;
    });
  }

  /**
   * Find models underperforming vs top 5 performers
   */
  private findUnderperformingModels(models: any[], top5Performers: WatchListModel[]): UnderperformingModel[] {
    if (top5Performers.length === 0) return [];

    // Calculate average 12-month return of top 5
    const top5Average = top5Performers.reduce((sum, model) => sum + model.return12Month, 0) / top5Performers.length;
    const underperformanceThreshold = top5Average * 0.9; // 10% below top 5

    const underperformers: UnderperformingModel[] = [];

    models.forEach(model => {
      const perf = model.performance;
      if (!perf || !perf.return12Month) return;

      const performanceGap = top5Average - perf.return12Month;
      
      if (perf.return12Month < underperformanceThreshold && performanceGap > 5) {
        underperformers.push({
          modelName: model.name,
          accountName: model.accountName,
          return12Month: perf.return12Month,
          returnYTD: perf.returnYTD || 0,
          performanceGap
        });
      }
    });

    // Sort by performance gap (worst first)
    return underperformers.sort((a, b) => b.performanceGap - a.performanceGap);
  }

  /**
   * Find daily movements by comparing today vs yesterday portfolios
   */
  private async findDailyMovements(todayDate: string): Promise<[DailyModelMove[], DailySecurityMove[]]> {
    try {
      const yesterdayDate = this.getYesterdayDate(todayDate);
      console.log(`Analyzing daily movements: ${yesterdayDate} vs ${todayDate}`);

      // Get portfolios for both days
      const [todayAccounts, yesterdayAccounts] = await Promise.all([
        this.combinedAccountService.getCombinedAccountPortfolios(todayDate).catch(() => []),
        this.combinedAccountService.getCombinedAccountPortfolios(yesterdayDate).catch(() => [])
      ]);

      const dailyModelMoves: DailyModelMove[] = [];
      const dailySecurityMoves: DailySecurityMove[] = [];

      // Compare models day-over-day
      for (const todayAccount of todayAccounts) {
        const yesterdayAccount = yesterdayAccounts.find(acc => acc.baseAccountName === todayAccount.baseAccountName);
        if (!yesterdayAccount) continue;

        for (const todayCurrency of todayAccount.currencies) {
          const yesterdayCurrency = yesterdayAccount.currencies.find(curr => curr.currency === todayCurrency.currency);
          if (!yesterdayCurrency) continue;

          for (const todayModel of todayCurrency.models) {
            const yesterdayModel = yesterdayCurrency.models.find(model => model.name === todayModel.name);
            if (!yesterdayModel) continue;

            // Calculate model daily change
            const todayValue = todayModel.performance?.finalEquity || 0;
            const yesterdayValue = yesterdayModel.performance?.finalEquity || 0;
            
            if (yesterdayValue > 0) {
              const dailyChange = ((todayValue - yesterdayValue) / yesterdayValue) * 100;
              
              // Flag models with >3% daily change
              if (Math.abs(dailyChange) >= 3) {
                let significance: 'high' | 'medium' | 'low' = 'low';
                if (Math.abs(dailyChange) >= 10) significance = 'high';
                else if (Math.abs(dailyChange) >= 5) significance = 'medium';

                dailyModelMoves.push({
                  modelName: todayModel.name,
                  accountName: todayAccount.baseAccountName,
                  dailyChange,
                  significance
                });
              }
            }

            // Analyze individual securities within models - track actual percentage changes
            const todaySecuritiesWithPercentages = this.extractSecuritiesWithPercentages(todayModel.performance?.portfolio || '');
            const yesterdaySecuritiesWithPercentages = this.extractSecuritiesWithPercentages(yesterdayModel.performance?.portfolio || '');

            // Compare actual portfolio percentage changes for each security
            todaySecuritiesWithPercentages.forEach(todaySecurity => {
              const yesterdaySecurity = yesterdaySecuritiesWithPercentages.find(s => s.symbol === todaySecurity.symbol);
              
              if (yesterdaySecurity && yesterdaySecurity.percentage > 0) {
                // Calculate the change in portfolio allocation percentage
                const allocationChange = todaySecurity.percentage - yesterdaySecurity.percentage;
                
                // Estimate daily price change based on allocation change and model performance
                // If allocation increased significantly, it might indicate strong performance
                // This is still an approximation, but more realistic than pure simulation
                let estimatedDailyChange = allocationChange * 2; // Approximation factor
                
                // Add some correlation with model performance
                if (Math.abs(dailyChange) > 1) {
                  estimatedDailyChange += dailyChange * 0.3; // Partial correlation
                }
                
                if (Math.abs(estimatedDailyChange) >= 5) {
                  let significance: 'high' | 'medium' | 'low' = 'low';
                  if (Math.abs(estimatedDailyChange) >= 10) significance = 'high';
                  else if (Math.abs(estimatedDailyChange) >= 7) significance = 'medium';

                  dailySecurityMoves.push({
                    securitySymbol: todaySecurity.symbol,
                    dailyChange: estimatedDailyChange,
                    modelName: todayModel.name,
                    accountName: todayAccount.baseAccountName,
                    significance
                  });
                }
              }
            });
          }
        }
      }

      // Sort by significance and magnitude
      dailyModelMoves.sort((a, b) => {
        const significanceOrder = { high: 3, medium: 2, low: 1 };
        if (significanceOrder[a.significance] !== significanceOrder[b.significance]) {
          return significanceOrder[b.significance] - significanceOrder[a.significance];
        }
        return Math.abs(b.dailyChange) - Math.abs(a.dailyChange);
      });

      dailySecurityMoves.sort((a, b) => {
        const significanceOrder = { high: 3, medium: 2, low: 1 };
        if (significanceOrder[a.significance] !== significanceOrder[b.significance]) {
          return significanceOrder[b.significance] - significanceOrder[a.significance];
        }
        return Math.abs(b.dailyChange) - Math.abs(a.dailyChange);
      });

      console.log(`Daily analysis complete: ${dailyModelMoves.length} model moves, ${dailySecurityMoves.length} security moves`);
      return [dailyModelMoves, dailySecurityMoves];

    } catch (error) {
      console.error('Error analyzing daily movements:', error);
      return [[], []];
    }
  }

  /**
   * Extract security symbols from portfolio text
   */
  private extractSecuritiesFromPortfolio(portfolioText: string): string[] {
    const securities: string[] = [];
    
    if (!portfolioText) return securities;

    // Parse holdings format like "NVDA (22%)\nAVGO (39%)\nDOW (25%)"
    const holdingMatches = portfolioText.match(/([A-Z\.]+)\s*\(\d+%\)/g);
    
    if (holdingMatches) {
      holdingMatches.forEach(match => {
        const symbolMatch = match.match(/([A-Z\.]+)/);
        if (symbolMatch) {
          securities.push(symbolMatch[1]);
        }
      });
    }

    return securities;
  }

  /**
   * Extract securities with their percentages from portfolio text
   */
  private extractSecuritiesWithPercentages(portfolioText: string): { symbol: string, percentage: number }[] {
    const securities: { symbol: string, percentage: number }[] = [];
    
    if (!portfolioText) return securities;

    // Parse holdings format like "NVDA (22%)\nAVGO (39%)\nDOW (25%)"
    const holdingMatches = portfolioText.match(/([A-Z\.]+)\s*\((\d+)%\)/g);
    
    if (holdingMatches) {
      holdingMatches.forEach(match => {
        const matches = match.match(/([A-Z\.]+)\s*\((\d+)%\)/);
        if (matches && matches.length === 3) {
          securities.push({
            symbol: matches[1],
            percentage: parseInt(matches[2])
          });
        }
      });
    }

    return securities;
  }

  /**
   * Get yesterday's date
   */
  private getYesterdayDate(todayDate: string): string {
    const today = new Date(todayDate);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  /**
   * Find best and worst performing models (12-month focus)
   */
  private findBestAndWorstPerformers(models: any[]): {
    best12Mo: { name: string; return12Month: number } | null;
    worst12Mo: { name: string; return12Month: number } | null;
  } {
    const validModels = models.filter(m => m.performance);

    if (validModels.length === 0) {
      return { best12Mo: null, worst12Mo: null };
    }

    // 12-month performers (focus on 12-month only)
    const sortedBy12Mo = validModels.sort((a, b) => (b.performance?.return12Month || 0) - (a.performance?.return12Month || 0));
    const best12Mo = sortedBy12Mo.length > 0 ? {
      name: sortedBy12Mo[0].name,
      return12Month: sortedBy12Mo[0].performance?.return12Month || 0
    } : null;
    const worst12Mo = sortedBy12Mo.length > 0 ? {
      name: sortedBy12Mo[sortedBy12Mo.length - 1].name,
      return12Month: sortedBy12Mo[sortedBy12Mo.length - 1].performance?.return12Month || 0
    } : null;

    return { best12Mo, worst12Mo };
  }
}