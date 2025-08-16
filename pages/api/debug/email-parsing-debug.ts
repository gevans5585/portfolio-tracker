import type { NextApiRequest, NextApiResponse } from 'next';
import { GmailService } from '@/lib/gmail';
import { EmailParser } from '@/lib/emailParser';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Debugging email parsing logic...');
    
    const gmailService = new GmailService();
    const emailParser = new EmailParser();
    
    // Get today's emails
    const today = new Date().toISOString().split('T')[0];
    console.log(`Getting emails for ${today}...`);
    const emails = await gmailService.getPortfolioEmails(today, today);
    console.log(`Found ${emails.length} emails`);
    
    if (emails.length === 0) {
      return res.status(200).json({
        timestamp: new Date().toISOString(),
        success: true,
        message: `No emails found for ${today}`,
        data: {
          date: today,
          emailsFound: 0,
          reason: 'No emails returned from Gmail service'
        }
      });
    }

    // Debug each email
    const emailDebugInfo = [];
    
    for (const email of emails) {
      console.log(`\nDebugging email: ${email.subject}`);
      console.log(`Date: ${email.date}`);
      console.log(`HTML length: ${email.htmlBody.length} characters`);
      
      // Parse without any filtering (empty array = get all models)
      const parsedDataArray = emailParser.parseFilteredPortfolioEmail(
        email.htmlBody,
        email.subject,
        email.date,
        [] // Empty array means no filtering - get all models
      );
      
      // Also test with a sample of known models to see if filtering is the issue
      const testModels = ['Glen S&P 100', '1. Glen S&P 100', 'Anne S&P 100', 'Kate S&P 100'];
      const parsedWithFilter = emailParser.parseFilteredPortfolioEmail(
        email.htmlBody,
        email.subject,
        email.date,
        testModels
      );
      
      console.log(`Parsed ${parsedDataArray.length} portfolio data objects`);
      
      let totalHoldings = 0;
      let allModels: string[] = [];
      
      for (const portfolioData of parsedDataArray) {
        totalHoldings += portfolioData.holdings.length;
        for (const holding of portfolioData.holdings) {
          if (!allModels.includes(holding.name)) {
            allModels.push(holding.name);
          }
        }
      }
      
      // Also check raw HTML content for table presence
      const tableCount = (email.htmlBody.match(/<table/gi) || []).length;
      const hasPerformanceKeywords = [
        'final equity', 'ret. ytd', 'ret. 1mo', 'sharpe', 'cagr', 'portfolio'
      ].some(keyword => email.htmlBody.toLowerCase().includes(keyword.toLowerCase()));
      
      console.log(`Email ${email.subject}: ${totalHoldings} holdings, ${allModels.length} unique models`);
      console.log(`With test filter: ${parsedWithFilter.length} portfolio objects`);
      
      // Test table detection on actual email tables
      const $ = require('cheerio').load(email.htmlBody);
      const tables = $('table');
      const tableDetectionResults = [];
      
      for (let i = 0; i < Math.min(tables.length, 5); i++) { // Test first 5 tables
        const table = $(tables[i]);
        const rows = table.find('tr');
        if (rows.length >= 1) {
          const headerRow = $(rows[0]);
          const headers = headerRow.find('th, td').map((_: number, el: any) => 
            $(el).text().trim().toLowerCase()
          ).get();
          
          const headerText = headers.join(' ');
          const isHoldings = (emailParser as any).isHoldingsTable(headerText);
          const isPerformance = (emailParser as any).isPortfolioPerformanceTable(headerText);
          
          tableDetectionResults.push({
            tableIndex: i,
            headers,
            headerText,
            isHoldingsTable: isHoldings,
            isPortfolioPerformanceTable: isPerformance,
            shouldBeRecognized: isHoldings || isPerformance
          });
        }
      }
      
      emailDebugInfo.push({
        subject: email.subject,
        date: email.date,
        htmlLength: email.htmlBody.length,
        tableCount,
        hasPerformanceKeywords,
        parsedPortfolioCount: parsedDataArray.length,
        totalHoldings,
        uniqueModels: allModels.length,
        models: allModels,
        filteredParseResults: parsedWithFilter.length,
        tableDetectionResults,
        holdings: parsedDataArray.map(pd => ({
          accountName: pd.accountName,
          holdingsCount: pd.holdings.length,
          holdings: pd.holdings.map(h => ({
            name: h.name,
            symbol: h.symbol,
            value: h.value,
            hasPerformance: !!h.performance
          }))
        })),
        // Include first 500 chars of HTML for inspection
        htmlSample: email.htmlBody.substring(0, 500)
      });
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: `Email parsing debug completed for ${today}`,
      data: {
        date: today,
        emailsFound: emails.length,
        emailDebugInfo,
        summary: {
          totalEmails: emails.length,
          totalPortfolioDataObjects: emailDebugInfo.reduce((sum, info) => sum + info.parsedPortfolioCount, 0),
          totalHoldings: emailDebugInfo.reduce((sum, info) => sum + info.totalHoldings, 0),
          totalUniqueModels: emailDebugInfo.reduce((sum, info) => sum + info.uniqueModels, 0),
          hasAnyTables: emailDebugInfo.some(info => info.tableCount > 0),
          hasAnyPerformanceData: emailDebugInfo.some(info => info.hasPerformanceKeywords)
        }
      }
    });

  } catch (error) {
    console.error('Email parsing debug error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Email parsing debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}