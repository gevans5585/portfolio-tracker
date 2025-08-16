import { AccountPortfolioService, AccountPortfolio, ModelData } from './accountPortfolioService';
import { ChangeDetectionService } from './changeDetectionService';
import cacheService from './cacheService';

export interface CurrencyPortfolio {
  currency: 'USD' | 'CAD';
  models: ModelData[];
  totalValue: number;
}

export interface CombinedAccountPortfolio {
  baseAccountName: string; // e.g., "Glen RRSP", "Anne TFSA"
  currencies: CurrencyPortfolio[];
  totalValueAllCurrencies: number;
  date: string;
  changes?: {
    addedHoldings: string[];
    removedHoldings: string[];
    hasChanges: boolean;
  };
}

export class CombinedAccountService {
  private accountService: AccountPortfolioService;
  private changeDetectionService: ChangeDetectionService;

  constructor() {
    this.accountService = new AccountPortfolioService();
    this.changeDetectionService = new ChangeDetectionService();
  }

  /**
   * Get combined account portfolios (USD/CAD grouped together)
   */
  async getCombinedAccountPortfolios(dateStr?: string): Promise<CombinedAccountPortfolio[]> {
    try {
      const date = dateStr || new Date().toISOString().split('T')[0];
      
      // Check cache first
      const cachedData = cacheService.getCombinedAccounts(date);
      if (cachedData) {
        console.log(`Returning cached combined accounts for ${date}`);
        return cachedData;
      }

      console.log(`Fetching fresh combined accounts for ${date}`);
      
      // Get individual account portfolios
      const accountPortfolios = await this.accountService.getAccountPortfolios(date);
      
      // Get change detection data
      const changeAlert = await this.changeDetectionService.detectChanges(date);
      
      // Group accounts by base name (removing currency suffix)
      const groupedAccounts = this.groupAccountsByCurrency(accountPortfolios);
      
      // Combine with change data
      const combinedAccounts = this.addChangeDataToCombinedAccounts(groupedAccounts, changeAlert.changes, date);
      
      // Cache the results
      cacheService.setCombinedAccounts(date, combinedAccounts);
      
      console.log(`Created and cached ${combinedAccounts.length} combined account portfolios`);
      return combinedAccounts.sort((a, b) => a.baseAccountName.localeCompare(b.baseAccountName));
      
    } catch (error) {
      console.error('Error getting combined account portfolios:', error);
      throw error;
    }
  }

  /**
   * Get a specific combined account by base name
   */
  async getCombinedAccountByName(baseAccountName: string, dateStr?: string): Promise<CombinedAccountPortfolio | null> {
    try {
      const combinedAccounts = await this.getCombinedAccountPortfolios(dateStr);
      return combinedAccounts.find(account => account.baseAccountName === baseAccountName) || null;
    } catch (error) {
      console.error(`Error getting combined account ${baseAccountName}:`, error);
      throw error;
    }
  }

  /**
   * Get list of all base account names (for navigation)
   */
  async getCombinedAccountNames(): Promise<string[]> {
    try {
      const combinedAccounts = await this.getCombinedAccountPortfolios();
      return combinedAccounts.map(account => account.baseAccountName);
    } catch (error) {
      console.error('Error getting combined account names:', error);
      throw error;
    }
  }

  private groupAccountsByCurrency(accountPortfolios: AccountPortfolio[]): CombinedAccountPortfolio[] {
    const groupedMap = new Map<string, CombinedAccountPortfolio>();

    for (const account of accountPortfolios) {
      const baseAccountName = this.extractBaseAccountName(account.accountName);
      const currency = this.extractCurrency(account.accountName);

      if (!groupedMap.has(baseAccountName)) {
        groupedMap.set(baseAccountName, {
          baseAccountName,
          currencies: [],
          totalValueAllCurrencies: 0,
          date: account.date
        });
      }

      const combinedAccount = groupedMap.get(baseAccountName)!;
      
      const currencyPortfolio: CurrencyPortfolio = {
        currency,
        models: account.models,
        totalValue: account.totalValue
      };

      combinedAccount.currencies.push(currencyPortfolio);
      combinedAccount.totalValueAllCurrencies += account.totalValue;
    }

    return Array.from(groupedMap.values());
  }

  private addChangeDataToCombinedAccounts(
    combinedAccounts: CombinedAccountPortfolio[], 
    changes: any[], 
    date: string
  ): CombinedAccountPortfolio[] {
    
    for (const combinedAccount of combinedAccounts) {
      const accountChanges = changes.filter(change => {
        const changeBaseAccountName = this.extractBaseAccountName(change.accountName);
        return changeBaseAccountName === combinedAccount.baseAccountName;
      });

      if (accountChanges.length > 0) {
        const allAddedHoldings = accountChanges.flatMap(change => change.addedHoldings);
        const allRemovedHoldings = accountChanges.flatMap(change => change.removedHoldings);

        combinedAccount.changes = {
          addedHoldings: [...new Set(allAddedHoldings)], // Remove duplicates
          removedHoldings: [...new Set(allRemovedHoldings)], // Remove duplicates
          hasChanges: allAddedHoldings.length > 0 || allRemovedHoldings.length > 0
        };
      } else {
        combinedAccount.changes = {
          addedHoldings: [],
          removedHoldings: [],
          hasChanges: false
        };
      }
    }

    return combinedAccounts;
  }

  /**
   * Extract base account name (remove currency suffix)
   * "Glen RRSP $USD" -> "Glen RRSP"
   */
  private extractBaseAccountName(fullAccountName: string): string {
    return fullAccountName.replace(/\s+\$(?:USD|CAD)$/i, '');
  }

  /**
   * Extract currency from account name
   * "Glen RRSP $USD" -> "USD"
   */
  private extractCurrency(fullAccountName: string): 'USD' | 'CAD' {
    const match = fullAccountName.match(/\$(?:USD|CAD)$/i);
    if (match) {
      return match[0].substring(1).toUpperCase() as 'USD' | 'CAD';
    }
    return 'USD'; // Default fallback
  }

  /**
   * Extract portfolio holdings with percentages from portfolio text
   */
  extractHoldingsWithPercentages(portfolioText: string): string[] {
    const holdings: string[] = [];
    
    if (!portfolioText) return holdings;

    // Parse holdings format like "NVDA (22%)\nAVGO (39%)\nDOW (25%)"
    const holdingMatches = portfolioText.match(/([A-Z\\.]+)\s*\((\d+%)\)/g);
    
    if (holdingMatches) {
      holdings.push(...holdingMatches.map(match => match.trim()));
    }

    return holdings;
  }
}