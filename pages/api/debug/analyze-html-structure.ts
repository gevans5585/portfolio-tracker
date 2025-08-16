import type { NextApiRequest, NextApiResponse } from 'next';
import { GmailService } from '@/lib/gmail';
import * as cheerio from 'cheerio';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Analyzing HTML table structure...');
    
    // Get today's emails
    const gmailService = new GmailService();
    const today = new Date().toISOString().split('T')[0];
    const emails = await gmailService.getPortfolioEmails(today, today);

    if (emails.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No emails found for analysis'
      });
    }

    const firstEmail = emails[0];
    const $ = cheerio.load(firstEmail.htmlBody);
    
    // Find all tables
    const tables = $('table');
    console.log(`Found ${tables.length} tables in email`);
    
    const tableAnalysis = [];
    
    for (let i = 0; i < tables.length; i++) {
      const table = $(tables[i]);
      const rows = table.find('tr');
      
      console.log(`\nTable ${i}: Found ${rows.length} rows`);
      
      const tableInfo: {
        tableIndex: number;
        rowCount: number;
        rows: Array<{
          rowIndex: number;
          cellCount: number;
          cells: Array<{
            cellIndex: number;
            text: string;
            html: string;
            hasNestedTable: boolean;
            colspan: string;
            rowspan: string;
          }>;
        }>;
      } = {
        tableIndex: i,
        rowCount: rows.length,
        rows: []
      };
      
      // Analyze each row
      for (let j = 0; j < Math.min(rows.length, 10); j++) { // Limit to first 10 rows
        const row = $(rows[j]);
        const cells = row.find('td, th');
        
        const rowInfo: {
          rowIndex: number;
          cellCount: number;
          cells: Array<{
            cellIndex: number;
            text: string;
            html: string;
            hasNestedTable: boolean;
            colspan: string;
            rowspan: string;
          }>;
        } = {
          rowIndex: j,
          cellCount: cells.length,
          cells: []
        };
        
        // Get cell contents
        for (let k = 0; k < cells.length; k++) {
          const cell = $(cells[k]);
          const cellText = cell.text().trim();
          const cellHtml = cell.html();
          
          rowInfo.cells.push({
            cellIndex: k,
            text: cellText,
            html: cellHtml ? cellHtml.substring(0, 200) : '', // Limit HTML length
            hasNestedTable: cell.find('table').length > 0,
            colspan: cell.attr('colspan') || '1',
            rowspan: cell.attr('rowspan') || '1'
          });
        }
        
        tableInfo.rows.push(rowInfo);
      }
      
      tableAnalysis.push(tableInfo);
    }
    
    // Also test the existing parsing logic
    const existingParsingResult = [];
    
    for (let i = 0; i < tables.length; i++) {
      const table = $(tables[i]);
      const rows = table.find('tr');
      
      if (rows.length < 2) continue;
      
      const headerRow = $(rows[0]);
      const headers = headerRow.find('th, td').map((_, el) => $(el).text().trim().toLowerCase()).get();
      
      console.log(`Table ${i} headers:`, headers);
      
      // Check if this looks like a holdings table
      const headerText = headers.join(' ');
      const keywords = ['symbol', 'quantity', 'price', 'value', 'shares', 'position', 'market value', 'name', 'model', 'fund name', 'security name'];
      const isHoldingsTable = keywords.some(keyword => headerText.includes(keyword));
      
      existingParsingResult.push({
        tableIndex: i,
        headers,
        headerText,
        isHoldingsTable,
        nameColumnIndex: headers.findIndex(h => h.includes('name') || h.includes('model') || h.includes('fund name') || h.includes('security name'))
      });
    }
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'HTML table structure analysis complete',
      data: {
        emailSubject: firstEmail.subject,
        emailDate: firstEmail.date,
        tablesFound: tables.length,
        tableAnalysis,
        existingParsingResult,
        htmlPreview: firstEmail.htmlBody.substring(0, 2000) // First 2000 chars of HTML
      }
    });

  } catch (error) {
    console.error('HTML structure analysis error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'HTML structure analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}