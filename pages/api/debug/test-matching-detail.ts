import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleSheetsService } from '@/lib/googleSheets';
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
    console.log('Testing detailed model matching...');
    
    // Get portfolio models from Google Sheets
    const sheetsService = new GoogleSheetsService();
    const allowedModels = await sheetsService.getPortfolioModels();
    console.log(`Found ${allowedModels.length} allowed models from sheets:`, allowedModels);
    
    // Get today's emails
    const gmailService = new GmailService();
    const today = new Date().toISOString().split('T')[0];
    const emails = await gmailService.getPortfolioEmails(today, today);

    if (emails.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No emails found for matching test'
      });
    }

    const firstEmail = emails[0];
    const $ = cheerio.load(firstEmail.htmlBody);
    
    // Find the relevant table (Table 1 from our analysis)
    const table = $('table').eq(1); // Second table (index 1) has Glen's models
    const rows = table.find('tr');
    
    const matchingResults = [];
    
    // Check first 10 rows for model names
    for (let j = 1; j < Math.min(rows.length, 11); j++) {
      const row = $(rows[j]);
      const cells = row.find('td, th');
      
      if (cells.length === 0) continue;
      
      // Extract model name from first cell (index 0)
      const rawModelName = $(cells[0]).text().trim();
      
      // Apply HTML entity decoding manually here for testing
      const modelName = rawModelName
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');
      
      console.log(`Row ${j}: Raw="${rawModelName}", Decoded="${modelName}"`);
      
      // Check against each allowed model
      const matches = [];
      for (const allowedModel of allowedModels) {
        // Test exact match (case insensitive)
        const exactMatch = modelName.toLowerCase() === allowedModel.toLowerCase();
        
        // Test includes match
        const includesMatch = modelName.toLowerCase().includes(allowedModel.toLowerCase()) || 
                             allowedModel.toLowerCase().includes(modelName.toLowerCase());
        
        // Test cleaned match (remove number prefixes)
        const cleanEmailModel = modelName.replace(/^\d+\.\s*/, '').trim();
        const cleanSheetModel = allowedModel.replace(/^\d+\.\s*/, '').trim();
        const cleanMatch = cleanEmailModel.toLowerCase() === cleanSheetModel.toLowerCase();
        
        if (exactMatch || includesMatch || cleanMatch) {
          matches.push({
            allowedModel,
            exactMatch,
            includesMatch,
            cleanMatch,
            cleanEmailModel,
            cleanSheetModel
          });
        }
      }
      
      matchingResults.push({
        rowIndex: j,
        rawModelName,
        decodedModelName: modelName,
        matchCount: matches.length,
        matches
      });
    }
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Detailed model matching analysis complete',
      data: {
        allowedModels,
        emailSubject: firstEmail.subject,
        tableRowsAnalyzed: matchingResults.length,
        totalMatches: matchingResults.reduce((sum, r) => sum + r.matchCount, 0),
        matchingResults
      }
    });

  } catch (error) {
    console.error('Detailed matching test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Detailed matching test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}