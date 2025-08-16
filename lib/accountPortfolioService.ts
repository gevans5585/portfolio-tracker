import { GoogleSheetsService } from './googleSheets';
import { GmailService } from './gmail';
import { EmailParser } from './emailParser';
import { PortfolioData, Holding } from '../types';

export interface AccountPortfolio {
  accountName: string;
  models: ModelData[];
  totalValue: number;
  date: string;
}

export interface ModelData {
  name: string;
  symbol: string;
  performance: {
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
  };
}

export class AccountPortfolioService {
  private sheetsService: GoogleSheetsService;
  private gmailService: GmailService;
  private emailParser: EmailParser;

  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.gmailService = new GmailService();
    this.emailParser = new EmailParser();
  }

  async getAccountPortfolios(dateStr?: string): Promise<AccountPortfolio[]> {
    try {
      const date = dateStr || new Date().toISOString().split('T')[0];
      console.log(`Getting account portfolios for ${date}`);

      // Get model-to-account mappings from Google Sheets
      const mappings = await this.sheetsService.getModelAccountMappings();
      console.log(`Found ${mappings.length} model-account mappings`);

      // Get all allowed models for filtering
      const allowedModels = mappings.map(m => m.model);
      console.log(`Filtering for ${allowedModels.length} allowed models`);

      // Get emails and parse portfolio data
      const emails = await this.gmailService.getPortfolioEmails(date, date);
      console.log(`Found ${emails.length} emails for ${date}`);

      if (emails.length === 0) {
        console.log('No emails found, returning empty account portfolios');
        return [];
      }

      // Parse all portfolio data from emails
      const allPortfolioData: Holding[] = [];
      
      for (const email of emails) {
        console.log(`Processing email: ${email.subject}`);
        
        const parsedDataArray = this.emailParser.parseFilteredPortfolioEmail(
          email.htmlBody,
          email.subject,
          email.date,
          allowedModels
        );

        // Extract all holdings from parsed data
        for (const portfolioData of parsedDataArray) {
          allPortfolioData.push(...portfolioData.holdings);
        }
      }

      console.log(`Extracted ${allPortfolioData.length} total holdings`);

      // Group holdings by account based on model-to-account mappings
      const accountGroups: { [accountName: string]: ModelData[] } = {};

      for (const holding of allPortfolioData) {
        // Find ALL accounts for this model (not just the first one)
        const matchingMappings = mappings.filter(m => 
          this.modelsMatch(holding.name, m.model)
        );

        if (matchingMappings.length > 0) {
          console.log(`Model "${holding.name}" matches ${matchingMappings.length} account mappings`);
          
          // Assign this model to ALL matching accounts
          for (const mapping of matchingMappings) {
            const accountName = mapping.account;
            
            if (!accountGroups[accountName]) {
              accountGroups[accountName] = [];
            }

            // Convert holding to ModelData
            const modelData: ModelData = {
              name: holding.name,
              symbol: holding.symbol,
              performance: holding.performance || {
                finalEquity: holding.value,
                probabilityWin: 0,
                returnYTD: holding.dayChangePercent,
                return1Month: 0,
                return3Month: 0,
                return6Month: 0,
                return12Month: 0,
                tradesYTD: 0,
                maxDrawdown: 0,
                currentDrawdown: 0,
                sharpeRatio: 0,
                cagr: 0,
                volatility: 0,
                portfolio: '',
                mlAccuracies: ''
              }
            };

            accountGroups[accountName].push(modelData);
            console.log(`Assigned model "${holding.name}" to account "${accountName}"`);
          }
        } else {
          console.log(`Warning: No account mapping found for model "${holding.name}"`);
        }
      }

      // Convert to AccountPortfolio array
      const accountPortfolios: AccountPortfolio[] = [];

      for (const [accountName, models] of Object.entries(accountGroups)) {
        const totalValue = models.reduce((sum, model) => sum + model.performance.finalEquity, 0);
        
        accountPortfolios.push({
          accountName,
          models,
          totalValue,
          date
        });
      }

      console.log(`Created ${accountPortfolios.length} account portfolios:`, 
        accountPortfolios.map(ap => ({ account: ap.accountName, modelCount: ap.models.length, totalValue: ap.totalValue }))
      );

      return accountPortfolios.sort((a, b) => a.accountName.localeCompare(b.accountName));

    } catch (error) {
      console.error('Error getting account portfolios:', error);
      throw error;
    }
  }

  async getUniqueAccounts(): Promise<string[]> {
    try {
      const mappings = await this.sheetsService.getModelAccountMappings();
      const uniqueAccounts = [...new Set(mappings.map(m => m.account))];
      return uniqueAccounts.sort();
    } catch (error) {
      console.error('Error getting unique accounts:', error);
      throw error;
    }
  }

  private modelsMatch(emailModel: string, sheetModel: string): boolean {
    if (!emailModel || !sheetModel) return false;
    
    // Exact match (case insensitive)
    if (emailModel.toLowerCase() === sheetModel.toLowerCase()) {
      return true;
    }
    
    // Check if sheet model is contained in email model
    if (emailModel.toLowerCase().includes(sheetModel.toLowerCase()) || 
        sheetModel.toLowerCase().includes(emailModel.toLowerCase())) {
      return true;
    }
    
    // Remove common prefixes/suffixes and try again
    const cleanEmailModel = emailModel.replace(/^\d+\.\s*/, '').trim();
    const cleanSheetModel = sheetModel.replace(/^\d+\.\s*/, '').trim();
    
    if (cleanEmailModel.toLowerCase() === cleanSheetModel.toLowerCase()) {
      return true;
    }
    
    return false;
  }
}