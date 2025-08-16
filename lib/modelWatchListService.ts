import { GmailService } from './gmail';
import { EmailParser } from './emailParser';
import { CombinedAccountService } from './combinedAccountService';
import { Holding } from '@/types';
import cacheService from './cacheService';

export interface WatchListModel {
  name: string;
  symbol: string;
  return12Month: number;
  returnYTD: number;
  finalEquity: number;
  sharpeRatio: number;
  maxDrawdown: number;
  portfolio: string;
  isOwned: boolean; // ✅ = true (we own it), ⚠️ = false (opportunity)
}

export interface ModelWatchListData {
  topPerformers: WatchListModel[];
  totalModelsAnalyzed: number;
  ownedModelsCount: number;
  opportunityModelsCount: number;
  date: string;
}

export class ModelWatchListService {
  private gmailService: GmailService;
  private emailParser: EmailParser;
  private combinedAccountService: CombinedAccountService;

  constructor() {
    this.gmailService = new GmailService();
    this.emailParser = new EmailParser();
    this.combinedAccountService = new CombinedAccountService();
  }

  /**
   * Get top 5 performing models by 12-month return from ALL models in the email
   */
  async getModelWatchList(dateStr?: string): Promise<ModelWatchListData> {
    try {
      const date = dateStr || new Date().toISOString().split('T')[0];
      
      // Check cache first
      const cachedData = cacheService.getModelWatchList(date);
      if (cachedData) {
        console.log(`Returning cached model watch list for ${date}`);
        return cachedData;
      }

      console.log(`Generating fresh model watch list for ${date}`);

      // Get ALL models from email (no filtering)
      const allModels = await this.getAllModelsFromEmail(date);
      console.log(`Found ${allModels.length} total models in email`);

      // Get our current holdings for ownership comparison
      const ourHoldings = await this.getOurCurrentHoldings(date);
      console.log(`Found ${ourHoldings.length} models in our portfolios`);

      // Convert to WatchListModel format with ownership indicators
      const watchListModels = this.convertToWatchListModels(allModels, ourHoldings);

      // Filter out models without 12-month data and sort by 12-month performance
      const rankedModels = watchListModels
        .filter(model => model.return12Month !== 0) // Only include models with 12-month data
        .sort((a, b) => b.return12Month - a.return12Month); // Highest to lowest

      // Get top 5 performers
      const topPerformers = rankedModels.slice(0, 5);

      const ownedModelsCount = watchListModels.filter(m => m.isOwned).length;
      const opportunityModelsCount = watchListModels.filter(m => !m.isOwned).length;

      console.log(`Top 5 performers by 12-month return:`);
      topPerformers.forEach((model, index) => {
        console.log(`${index + 1}. ${model.name}: ${model.return12Month}% (${model.isOwned ? 'OWNED ✅' : 'OPPORTUNITY ⚠️'})`);
      });

      const result: ModelWatchListData = {
        topPerformers,
        totalModelsAnalyzed: watchListModels.length,
        ownedModelsCount,
        opportunityModelsCount,
        date
      };

      // Cache the results
      cacheService.setModelWatchList(date, result);

      return result;

    } catch (error) {
      console.error('Error getting model watch list:', error);
      throw error;
    }
  }

  /**
   * Parse ALL models from email without any filtering
   */
  private async getAllModelsFromEmail(date: string): Promise<Holding[]> {
    try {
      // Get emails for the date
      const emails = await this.gmailService.getPortfolioEmails(date, date);
      console.log(`Found ${emails.length} emails for ${date}`);

      if (emails.length === 0) {
        console.log('No emails found for the date');
        return [];
      }

      const allModels: Holding[] = [];

      for (const email of emails) {
        console.log(`Processing email: ${email.subject}`);
        
        // Parse WITHOUT filtering (pass empty array for allowedModels)
        const parsedDataArray = this.emailParser.parseFilteredPortfolioEmail(
          email.htmlBody,
          email.subject,
          email.date,
          [] // Empty array = no filtering, get ALL models
        );

        // Extract all holdings from parsed data
        for (const portfolioData of parsedDataArray) {
          allModels.push(...portfolioData.holdings);
        }
      }

      console.log(`Extracted ${allModels.length} total models from emails`);
      return allModels;

    } catch (error) {
      console.error('Error getting all models from email:', error);
      throw error;
    }
  }

  /**
   * Get all models currently in our portfolios
   */
  private async getOurCurrentHoldings(date: string): Promise<string[]> {
    try {
      const combinedAccounts = await this.combinedAccountService.getCombinedAccountPortfolios(date);
      const ourHoldings: string[] = [];

      for (const account of combinedAccounts) {
        for (const currencyPortfolio of account.currencies) {
          for (const model of currencyPortfolio.models) {
            // Add model name to our holdings list
            ourHoldings.push(model.name);
          }
        }
      }

      // Remove duplicates and return unique model names
      return [...new Set(ourHoldings)];

    } catch (error) {
      console.error('Error getting our current holdings:', error);
      return [];
    }
  }

  /**
   * Convert email holdings to WatchListModel format with ownership indicators
   */
  private convertToWatchListModels(allModels: Holding[], ourHoldings: string[]): WatchListModel[] {
    const watchListModels: WatchListModel[] = [];

    for (const model of allModels) {
      // Skip if no performance data
      if (!model.performance) continue;

      // Check if we own this model
      const isOwned = ourHoldings.some(ownedModel => this.modelsMatch(model.name, ownedModel));

      const watchListModel: WatchListModel = {
        name: model.name,
        symbol: model.symbol,
        return12Month: model.performance.return12Month || 0,
        returnYTD: model.performance.returnYTD || 0,
        finalEquity: model.performance.finalEquity || 0,
        sharpeRatio: model.performance.sharpeRatio || 0,
        maxDrawdown: model.performance.maxDrawdown || 0,
        portfolio: model.performance.portfolio || '',
        isOwned
      };

      watchListModels.push(watchListModel);
    }

    // Remove duplicates based on model name
    const uniqueModels = this.removeDuplicateModels(watchListModels);
    
    console.log(`Converted ${allModels.length} raw models to ${uniqueModels.length} unique watch list models`);
    return uniqueModels;
  }

  /**
   * Remove duplicate models (keep the one with better performance data)
   */
  private removeDuplicateModels(models: WatchListModel[]): WatchListModel[] {
    const uniqueMap = new Map<string, WatchListModel>();

    for (const model of models) {
      const key = model.name.toLowerCase();
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, model);
      } else {
        // If duplicate, keep the one with better 12-month data
        const existing = uniqueMap.get(key)!;
        if (model.return12Month > existing.return12Month || 
            (model.return12Month === existing.return12Month && model.finalEquity > existing.finalEquity)) {
          uniqueMap.set(key, model);
        }
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Check if two model names match (with fuzzy matching)
   */
  private modelsMatch(modelName1: string, modelName2: string): boolean {
    if (!modelName1 || !modelName2) return false;
    
    // Exact match (case insensitive)
    if (modelName1.toLowerCase() === modelName2.toLowerCase()) {
      return true;
    }
    
    // Remove common prefixes and try again
    const clean1 = modelName1.replace(/^\d+\.\s*/, '').trim();
    const clean2 = modelName2.replace(/^\d+\.\s*/, '').trim();
    
    if (clean1.toLowerCase() === clean2.toLowerCase()) {
      return true;
    }
    
    // Check if one contains the other
    if (clean1.toLowerCase().includes(clean2.toLowerCase()) || 
        clean2.toLowerCase().includes(clean1.toLowerCase())) {
      return true;
    }
    
    return false;
  }
}