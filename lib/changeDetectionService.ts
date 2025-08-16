import { AccountPortfolioService, AccountPortfolio } from './accountPortfolioService';
import { PortfolioChange, ChangeAlert } from '../types';
import { GoogleSheetsService } from './googleSheets';

export class ChangeDetectionService {
  private accountService: AccountPortfolioService;
  private sheetsService: GoogleSheetsService;

  constructor() {
    this.accountService = new AccountPortfolioService();
    this.sheetsService = new GoogleSheetsService();
  }

  async detectChanges(todayDate?: string): Promise<ChangeAlert> {
    try {
      const today = todayDate || new Date().toISOString().split('T')[0];
      const yesterday = this.getYesterdayDate(today);

      console.log(`Detecting changes between ${yesterday} and ${today}`);

      // Get portfolio data for both days
      const [todayPortfolios, yesterdayPortfolios] = await Promise.all([
        this.accountService.getAccountPortfolios(today),
        this.accountService.getAccountPortfolios(yesterday)
      ]);

      console.log(`Today: ${todayPortfolios.length} accounts, Yesterday: ${yesterdayPortfolios.length} accounts`);

      const changes: PortfolioChange[] = [];
      const affectedAccounts: string[] = [];

      // Compare each account
      for (const todayAccount of todayPortfolios) {
        const yesterdayAccount = yesterdayPortfolios.find(ya => ya.accountName === todayAccount.accountName);

        // Check each model in today's account
        for (const todayModel of todayAccount.models) {
          const yesterdayModel = yesterdayAccount?.models.find(ym => ym.name === todayModel.name);

          // Detect changes for this model
          const modelChanges = this.compareModelHoldings(todayModel, yesterdayModel, todayAccount.accountName, today);
          
          if (modelChanges.addedHoldings.length > 0 || modelChanges.removedHoldings.length > 0) {
            changes.push(modelChanges);
            
            if (!affectedAccounts.includes(todayAccount.accountName)) {
              affectedAccounts.push(todayAccount.accountName);
            }
          }
        }

        // Also check for models that existed yesterday but not today (completely removed models)
        if (yesterdayAccount) {
          for (const yesterdayModel of yesterdayAccount.models) {
            const todayModelExists = todayAccount.models.find(tm => tm.name === yesterdayModel.name);
            
            if (!todayModelExists) {
              // Entire model was removed
              const allYesterdayHoldings = this.extractHoldingsFromPortfolio(yesterdayModel.performance.portfolio);
              
              changes.push({
                modelName: yesterdayModel.name,
                accountName: todayAccount.accountName,
                addedHoldings: [],
                removedHoldings: allYesterdayHoldings,
                date: today
              });
              
              if (!affectedAccounts.includes(todayAccount.accountName)) {
                affectedAccounts.push(todayAccount.accountName);
              }
            }
          }
        }
      }

      // Sort changes by account name and model name for consistent reporting
      changes.sort((a, b) => {
        if (a.accountName !== b.accountName) {
          return a.accountName.localeCompare(b.accountName);
        }
        return a.modelName.localeCompare(b.modelName);
      });

      const changeAlert: ChangeAlert = {
        changes,
        totalChanges: changes.length,
        affectedAccounts: affectedAccounts.sort(),
        date: today
      };

      console.log(`Change detection complete: ${changes.length} changes across ${affectedAccounts.length} accounts`);
      return changeAlert;

    } catch (error) {
      console.error('Error detecting changes:', error);
      throw error;
    }
  }

  private compareModelHoldings(
    todayModel: any,
    yesterdayModel: any,
    accountName: string,
    date: string
  ): PortfolioChange {
    const addedHoldings: string[] = [];
    const removedHoldings: string[] = [];

    // CRITICAL FIX: Compare only security symbols, not percentages
    // Extract security symbols (ignoring percentages) for proper comparison
    const todaySymbols = this.extractSecuritySymbols(todayModel.performance?.portfolio || '');
    const yesterdaySymbols = yesterdayModel ? 
      this.extractSecuritySymbols(yesterdayModel.performance?.portfolio || '') : [];

    console.log(`[CHANGE DEBUG] Model: ${todayModel.name}`);
    console.log(`[CHANGE DEBUG] Today symbols:`, todaySymbols);
    console.log(`[CHANGE DEBUG] Yesterday symbols:`, yesterdaySymbols);

    // Get full holdings (with percentages) for reporting purposes only
    const todayHoldings = this.extractHoldingsFromPortfolio(todayModel.performance?.portfolio || '');
    const yesterdayHoldings = yesterdayModel ? 
      this.extractHoldingsFromPortfolio(yesterdayModel.performance?.portfolio || '') : [];

    // Find securities that actually disappeared (compare symbols only)
    for (const yesterdaySymbol of yesterdaySymbols) {
      if (!todaySymbols.includes(yesterdaySymbol)) {
        // Security truly removed - find the full holding string for reporting
        const removedHolding = yesterdayHoldings.find(h => h.startsWith(yesterdaySymbol));
        if (removedHolding) {
          removedHoldings.push(removedHolding);
        }
      }
    }

    // Find securities that were actually added (compare symbols only)  
    for (const todaySymbol of todaySymbols) {
      if (!yesterdaySymbols.includes(todaySymbol)) {
        // New security added - find the full holding string for reporting
        const addedHolding = todayHoldings.find(h => h.startsWith(todaySymbol));
        if (addedHolding && !addedHoldings.includes(addedHolding)) {
          addedHoldings.push(addedHolding);
        }
      }
    }

    // Clean up duplicates
    const finalAddedHoldings = [...new Set(addedHoldings)];
    const finalRemovedHoldings = [...new Set(removedHoldings)];

    console.log(`[CHANGE DEBUG] Final changes - Added:`, finalAddedHoldings);
    console.log(`[CHANGE DEBUG] Final changes - Removed:`, finalRemovedHoldings);

    return {
      modelName: todayModel.name,
      accountName,
      addedHoldings: finalAddedHoldings,
      removedHoldings: finalRemovedHoldings,
      date
    };
  }

  private extractHoldingsFromPortfolio(portfolioText: string): string[] {
    const holdings: string[] = [];
    
    if (!portfolioText) return holdings;

    // Parse holdings format like "NVDA (22%)\nAVGO (39%)\nDOW (25%)"
    const holdingMatches = portfolioText.match(/([A-Z\.]+)\s*\((\d+%)\)/g);
    
    if (holdingMatches) {
      holdings.push(...holdingMatches.map(match => match.trim()));
    }

    return holdings;
  }

  /**
   * Extract only security symbols (without percentages) from portfolio text
   * This is used for change detection to compare securities, not percentages
   */
  private extractSecuritySymbols(portfolioText: string): string[] {
    const symbols: string[] = [];
    
    if (!portfolioText) return symbols;

    // Parse holdings format like "NVDA (22%)\nAVGO (39%)\nDOW (25%)"
    // Extract only the symbol part, ignore the percentage
    const holdingMatches = portfolioText.match(/([A-Z\.]+)\s*\(\d+%\)/g);
    
    if (holdingMatches) {
      holdingMatches.forEach(match => {
        const symbolMatch = match.match(/([A-Z\.]+)/);
        if (symbolMatch) {
          symbols.push(symbolMatch[1]);
        }
      });
    }

    return symbols;
  }

  private getYesterdayDate(todayDate: string): string {
    const today = new Date(todayDate);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
}