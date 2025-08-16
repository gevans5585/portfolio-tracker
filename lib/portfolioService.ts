import { GmailService } from './gmail';
import { GmailIMAPService } from './gmailIMAP';
import { EmailParser } from './emailParser';
import { PortfolioComparisonService } from './portfolioComparison';
import { GoogleSheetsService } from './googleSheets';
import { PortfolioData, PortfolioComparison } from '@/types';

export class PortfolioService {
  private gmailService: GmailService;
  private gmailIMAPService: GmailIMAPService;
  private emailParser: EmailParser;
  private comparisonService: PortfolioComparisonService;
  private sheetsService: GoogleSheetsService;

  constructor() {
    this.gmailService = new GmailService();
    this.gmailIMAPService = new GmailIMAPService();
    this.emailParser = new EmailParser();
    this.comparisonService = new PortfolioComparisonService();
    this.sheetsService = new GoogleSheetsService();
  }

  async getLatestPortfolioData(): Promise<PortfolioData[]> {
    try {
      const today = this.formatDate(new Date());
      console.log(`Fetching latest portfolio data for date: ${today}`);
      
      // Get allowed model names from Google Sheets
      const allowedModels = await this.sheetsService.getPortfolioModels();
      console.log(`Using ${allowedModels.length} models for filtering:`, allowedModels);
      
      // Gmail service now handles IMAP-first logic internally
      const emails = await this.gmailService.getPortfolioEmails(today, today);
      console.log(`Found ${emails.length} emails for ${today}`);

      const portfolioData: PortfolioData[] = [];

      for (const email of emails) {
        console.log(`Processing email: ${email.subject} from ${email.from}`);
        
        // Use the new filtered parsing method
        const parsedDataArray = this.emailParser.parseFilteredPortfolioEmail(
          email.htmlBody,
          email.subject,
          email.date,
          allowedModels
        );

        if (parsedDataArray && parsedDataArray.length > 0) {
          console.log(`Successfully parsed ${parsedDataArray.length} filtered portfolio data objects`);
          portfolioData.push(...parsedDataArray);
        } else {
          console.log(`No matching portfolio data found in email: ${email.subject}`);
        }
      }

      console.log(`Total filtered portfolio data objects: ${portfolioData.length} for date ${today}`);
      return portfolioData;
    } catch (error) {
      console.error('Error getting latest portfolio data:', error);
      throw error;
    }
  }

  async getPortfolioDataForDate(date: string): Promise<PortfolioData[]> {
    try {
      console.log(`Fetching emails for date: ${date}`);
      
      // Get allowed model names from Google Sheets
      const allowedModels = await this.sheetsService.getPortfolioModels();
      console.log(`Using ${allowedModels.length} models for filtering:`, allowedModels);
      
      // Gmail service now handles IMAP-first logic internally
      const emails = await this.gmailService.getPortfolioEmails(date, date);
      console.log(`Found ${emails.length} emails for ${date}`);

      const portfolioData: PortfolioData[] = [];

      for (const email of emails) {
        console.log(`Processing email: ${email.subject} from ${email.from}`);
        
        // Use the new filtered parsing method
        const parsedDataArray = this.emailParser.parseFilteredPortfolioEmail(
          email.htmlBody,
          email.subject,
          email.date,
          allowedModels
        );

        if (parsedDataArray && parsedDataArray.length > 0) {
          console.log(`Successfully parsed ${parsedDataArray.length} filtered portfolio data objects`);
          portfolioData.push(...parsedDataArray);
        } else {
          console.log(`No matching portfolio data found in email: ${email.subject}`);
        }
      }

      console.log(`Total filtered portfolio data objects: ${portfolioData.length} for date ${date}`);
      return portfolioData;
    } catch (error) {
      console.error(`Error getting portfolio data for ${date}:`, error);
      throw error;
    }
  }

  async compareWithPreviousDay(): Promise<PortfolioComparison[]> {
    try {
      const today = this.formatDate(new Date());
      const yesterday = this.formatDate(this.getPreviousBusinessDay(new Date()));

      console.log(`Fetching portfolio data for comparison: today=${today}, yesterday=${yesterday}`);

      const [todayData, yesterdayData] = await Promise.all([
        this.getPortfolioDataForDate(today),
        this.getPortfolioDataForDate(yesterday),
      ]);

      console.log(`Data fetched: today=${todayData.length} portfolios, yesterday=${yesterdayData.length} portfolios`);

      const comparisons: PortfolioComparison[] = [];

      // Match portfolios by account number/name
      for (const todayPortfolio of todayData) {
        const yesterdayPortfolio = yesterdayData.find(
          p => p.accountNumber === todayPortfolio.accountNumber ||
               p.accountName === todayPortfolio.accountName
        );

        console.log(`Comparing portfolio: ${todayPortfolio.accountName} (${todayPortfolio.accountNumber}), found yesterday data: ${!!yesterdayPortfolio}`);

        const comparison = this.comparisonService.comparePortfolios(
          todayPortfolio,
          yesterdayPortfolio
        );

        comparisons.push(comparison);
      }

      console.log(`Generated ${comparisons.length} portfolio comparisons`);
      return comparisons;
    } catch (error) {
      console.error('Error comparing with previous day:', error);
      throw error;
    }
  }

  async getPortfolioSummary(): Promise<{
    totalAccounts: number;
    totalValue: number;
    totalDayChange: number;
    totalDayChangePercent: number;
    comparisons: PortfolioComparison[];
    alerts: string[];
    debug?: any;
  }> {
    const debug: any = {
      timestamp: new Date().toISOString(),
      steps: []
    };

    try {
      debug.steps.push({ step: 'starting_portfolio_summary', status: 'success', timestamp: new Date().toISOString() });
      
      const comparisons = await this.compareWithPreviousDay();
      debug.steps.push({ 
        step: 'comparisons_completed', 
        status: 'success', 
        timestamp: new Date().toISOString(),
        comparisonCount: comparisons.length 
      });
      
      const totalValue = comparisons.reduce((sum, comp) => sum + comp.today.totalValue, 0);
      const totalDayChange = comparisons.reduce((sum, comp) => sum + comp.today.dayChange, 0);
      const totalDayChangePercent = totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0;

      debug.steps.push({ 
        step: 'calculations_completed', 
        status: 'success', 
        timestamp: new Date().toISOString(),
        totalValue,
        totalDayChange,
        totalDayChangePercent
      });

      const allAlerts = comparisons.flatMap(comp => 
        this.comparisonService.generateAlerts(comp)
      );

      debug.steps.push({ 
        step: 'alerts_generated', 
        status: 'success', 
        timestamp: new Date().toISOString(),
        alertCount: allAlerts.length
      });

      const result = {
        totalAccounts: comparisons.length,
        totalValue,
        totalDayChange,
        totalDayChangePercent,
        comparisons,
        alerts: allAlerts,
      };

      // Add debug info in development
      if (process.env.NODE_ENV !== 'production') {
        (result as any).debug = debug;
      }

      return result;
    } catch (error) {
      debug.steps.push({ 
        step: 'error_occurred', 
        status: 'failed', 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      console.error('Error generating portfolio summary:', error);
      console.error('Debug info:', debug);
      throw error;
    }
  }

  async processPortfolioEmails(): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      const summary = await this.getPortfolioSummary();
      
      return {
        success: true,
        message: `Successfully processed ${summary.totalAccounts} portfolio accounts`,
        data: summary,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error processing portfolio emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getPreviousBusinessDay(date: Date): Date {
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);

    // If it's Monday, go back to Friday
    if (previousDay.getDay() === 0) { // Sunday
      previousDay.setDate(previousDay.getDate() - 2);
    } else if (previousDay.getDay() === 6) { // Saturday
      previousDay.setDate(previousDay.getDate() - 1);
    }

    return previousDay;
  }

  async getEmailsForDebugging(dateFrom?: string, dateTo?: string) {
    try {
      console.log(`Getting emails for debugging: dateFrom=${dateFrom}, dateTo=${dateTo}`);
      // Gmail service now handles IMAP-first logic internally
      const emails = await this.gmailService.getPortfolioEmails(dateFrom, dateTo);
      console.log(`Found ${emails.length} emails for debugging`);
      return emails;
    } catch (error) {
      console.error('Error getting emails for debugging:', error);
      throw error;
    }
  }
}