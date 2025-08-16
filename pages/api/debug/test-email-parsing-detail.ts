import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleSheetsService } from '@/lib/googleSheets';
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
    console.log('Testing detailed email parsing and filtering...');
    
    // Get portfolio models from Google Sheets
    const sheetsService = new GoogleSheetsService();
    const allowedModels = await sheetsService.getPortfolioModels();
    console.log(`Found ${allowedModels.length} allowed models:`, allowedModels);
    
    // Get today's emails
    const gmailService = new GmailService();
    const today = new Date().toISOString().split('T')[0];
    const emails = await gmailService.getPortfolioEmails(today, today);
    console.log(`Found ${emails.length} emails for ${today}`);

    if (emails.length === 0) {
      return res.status(200).json({
        timestamp: new Date().toISOString(),
        success: true,
        message: 'No emails found for today',
        allowedModels,
        emailCount: 0
      });
    }

    // Parse first email and show detailed breakdown
    const firstEmail = emails[0];
    console.log(`Parsing email: ${firstEmail.subject}`);
    
    // Use Cheerio to extract table data manually
    const cheerio = require('cheerio');
    const $ = cheerio.load(firstEmail.htmlBody);
    const tables = $('table');
    
    const tablesInfo = [];
    for (let i = 0; i < tables.length; i++) {
      const table = $(tables[i]);
      const rows = table.find('tr');
      
      if (rows.length < 2) continue;
      
      const headerRow = $(rows[0]);
      const headers = headerRow.find('th, td').map((_: number, el: any) => $(el).text().trim()).get();
      
      const tableData = {
        tableIndex: i,
        headers,
        rowCount: rows.length - 1,
        firstRowData: []
      };
      
      // Get first data row
      if (rows.length > 1) {
        const firstDataRow = $(rows[1]);
        const cells = firstDataRow.find('td, th').map((_: number, el: any) => $(el).text().trim()).get();
        tableData.firstRowData = cells;
      }
      
      tablesInfo.push(tableData);
    }
    
    // Now try parsing with the email parser
    const emailParser = new EmailParser();
    const parsedDataArray = emailParser.parseFilteredPortfolioEmail(
      firstEmail.htmlBody,
      firstEmail.subject,
      firstEmail.date,
      allowedModels
    );
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Detailed email parsing analysis complete',
      data: {
        allowedModels,
        emailSubject: firstEmail.subject,
        emailDate: firstEmail.date,
        tablesFound: tablesInfo.length,
        tablesInfo,
        parsedPortfolioObjects: parsedDataArray.length,
        totalHoldingsFound: parsedDataArray.reduce((sum, pd) => sum + pd.holdings.length, 0),
        parsedData: parsedDataArray.map(pd => ({
          accountName: pd.accountName,
          holdingsCount: pd.holdings.length,
          holdings: pd.holdings.map(h => ({
            name: h.name,
            symbol: h.symbol,
            quantity: h.quantity,
            value: h.value
          }))
        }))
      }
    });

  } catch (error) {
    console.error('Detailed email parsing test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Detailed email parsing test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}