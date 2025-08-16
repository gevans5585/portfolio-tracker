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
    console.log('Testing portfolio service components individually...');
    
    const debug = {
      timestamp: new Date().toISOString(),
      steps: [] as any[]
    };

    // Step 1: Test Google Sheets portfolio models
    debug.steps.push({ step: 'starting_sheets_test', status: 'in_progress', timestamp: new Date().toISOString() });
    
    try {
      const sheetsService = new GoogleSheetsService();
      const allowedModels = await sheetsService.getPortfolioModels();
      debug.steps.push({ 
        step: 'sheets_models_fetched', 
        status: 'success', 
        timestamp: new Date().toISOString(),
        modelCount: allowedModels.length,
        models: allowedModels.slice(0, 5) // Show first 5 for brevity
      });
      
      // Step 2: Test Gmail service
      debug.steps.push({ step: 'starting_gmail_test', status: 'in_progress', timestamp: new Date().toISOString() });
      
      const gmailService = new GmailService();
      const today = new Date().toISOString().split('T')[0];
      const emails = await gmailService.getPortfolioEmails(today, today);
      
      debug.steps.push({ 
        step: 'gmail_emails_fetched', 
        status: 'success', 
        timestamp: new Date().toISOString(),
        emailCount: emails.length,
        date: today
      });

      // Step 3: Test email parsing with filtering
      debug.steps.push({ step: 'starting_parsing_test', status: 'in_progress', timestamp: new Date().toISOString() });
      
      const emailParser = new EmailParser();
      let totalParsedData = 0;
      
      for (const email of emails.slice(0, 3)) { // Test first 3 emails only
        console.log(`Processing email: ${email.subject}`);
        const parsedDataArray = emailParser.parseFilteredPortfolioEmail(
          email.htmlBody,
          email.subject,
          email.date,
          allowedModels
        );
        totalParsedData += parsedDataArray.length;
      }
      
      debug.steps.push({ 
        step: 'parsing_completed', 
        status: 'success', 
        timestamp: new Date().toISOString(),
        totalParsedDataObjects: totalParsedData
      });

      return res.status(200).json({
        timestamp: new Date().toISOString(),
        success: true,
        message: 'Portfolio service components test completed successfully',
        debug,
        summary: {
          modelsFromSheets: allowedModels.length,
          emailsFromGmail: emails.length,
          parsedPortfolioObjects: totalParsedData,
          allComponentsWorking: true
        }
      });

    } catch (error) {
      debug.steps.push({ 
        step: 'component_error', 
        status: 'failed', 
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }

  } catch (error) {
    console.error('Portfolio service test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Portfolio service test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}