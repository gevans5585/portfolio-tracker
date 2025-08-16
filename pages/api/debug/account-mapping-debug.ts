import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleSheetsService } from '@/lib/googleSheets';
import { AccountPortfolioService } from '@/lib/accountPortfolioService';
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
    console.log('Debugging account mapping logic...');
    
    const sheetsService = new GoogleSheetsService();
    const gmailService = new GmailService();
    const emailParser = new EmailParser();
    
    // Step 1: Get ALL model-account mappings from Google Sheet
    console.log('Step 1: Getting model-account mappings from Google Sheet...');
    const mappings = await sheetsService.getModelAccountMappings();
    console.log(`Found ${mappings.length} mappings from Google Sheet`);
    
    // Step 2: Group mappings by account to see what should exist
    const expectedAccounts: { [accountName: string]: string[] } = {};
    for (const mapping of mappings) {
      if (!expectedAccounts[mapping.account]) {
        expectedAccounts[mapping.account] = [];
      }
      expectedAccounts[mapping.account].push(mapping.model);
    }
    
    console.log('Expected accounts from Google Sheet:', Object.keys(expectedAccounts));
    
    // Step 3: Get emails and parse them
    const today = new Date().toISOString().split('T')[0];
    console.log(`Step 3: Getting emails for ${today}...`);
    const emails = await gmailService.getPortfolioEmails(today, today);
    console.log(`Found ${emails.length} emails`);
    
    // Step 4: Parse all models from emails (without filtering)
    const allModelsFromEmails: string[] = [];
    const emailModelDetails: any[] = [];
    
    for (const email of emails) {
      console.log(`Parsing email: ${email.subject}`);
      
      // Parse without filtering to see ALL models in emails
      const parsedDataArray = emailParser.parseFilteredPortfolioEmail(
        email.htmlBody,
        email.subject,
        email.date,
        [] // Empty array means no filtering - get all models
      );
      
      for (const portfolioData of parsedDataArray) {
        for (const holding of portfolioData.holdings) {
          if (!allModelsFromEmails.includes(holding.name)) {
            allModelsFromEmails.push(holding.name);
            emailModelDetails.push({
              name: holding.name,
              symbol: holding.symbol,
              value: holding.value,
              email: email.subject
            });
          }
        }
      }
    }
    
    console.log(`Found ${allModelsFromEmails.length} unique models in emails`);
    
    // Step 5: Check which sheet models match email models
    const matchingAnalysis = [];
    const unmatchedSheetModels = [];
    const unmatchedEmailModels = [];
    
    for (const mapping of mappings) {
      const emailModel = allModelsFromEmails.find(em => 
        modelsMatch(em, mapping.model)
      );
      
      if (emailModel) {
        matchingAnalysis.push({
          sheetModel: mapping.model,
          emailModel: emailModel,
          account: mapping.account,
          matched: true
        });
      } else {
        unmatchedSheetModels.push(mapping);
      }
    }
    
    for (const emailModel of allModelsFromEmails) {
      const sheetModel = mappings.find(m => 
        modelsMatch(emailModel, m.model)
      );
      
      if (!sheetModel) {
        unmatchedEmailModels.push(emailModel);
      }
    }
    
    // Step 6: Test actual account portfolio creation
    console.log('Step 6: Testing account portfolio creation...');
    const accountPortfolioService = new AccountPortfolioService();
    const accountPortfolios = await accountPortfolioService.getAccountPortfolios(today);
    
    const actualAccounts = accountPortfolios.map(ap => ap.accountName);
    const missingAccounts = Object.keys(expectedAccounts).filter(
      account => !actualAccounts.includes(account)
    );
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Account mapping debug completed',
      data: {
        step1_googleSheetMappings: {
          totalMappings: mappings.length,
          mappings: mappings,
          expectedAccountsCount: Object.keys(expectedAccounts).length,
          expectedAccounts: Object.keys(expectedAccounts).sort(),
          expectedAccountsWithModels: expectedAccounts
        },
        step2_emailData: {
          emailsFound: emails.length,
          totalModelsInEmails: allModelsFromEmails.length,
          allEmailModels: allModelsFromEmails.sort(),
          emailModelDetails: emailModelDetails.slice(0, 10) // Show first 10 for brevity
        },
        step3_matchingAnalysis: {
          successfulMatches: matchingAnalysis.length,
          matchingAnalysis: matchingAnalysis,
          unmatchedSheetModelsCount: unmatchedSheetModels.length,
          unmatchedSheetModels: unmatchedSheetModels,
          unmatchedEmailModelsCount: unmatchedEmailModels.length,
          unmatchedEmailModels: unmatchedEmailModels
        },
        step4_actualResults: {
          actualAccountsCount: actualAccounts.length,
          actualAccounts: actualAccounts.sort(),
          missingAccountsCount: missingAccounts.length,
          missingAccounts: missingAccounts,
          accountPortfolios: accountPortfolios.map(ap => ({
            accountName: ap.accountName,
            modelCount: ap.models.length,
            totalValue: ap.totalValue,
            models: ap.models.map(m => m.name)
          }))
        },
        summary: {
          expectedAccounts: Object.keys(expectedAccounts).length,
          actualAccounts: actualAccounts.length,
          missingAccounts: missingAccounts.length,
          problemAccounts: missingAccounts
        }
      }
    });

  } catch (error) {
    console.error('Account mapping debug error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Account mapping debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}

// Helper function for model matching (copied from emailParser)
function modelsMatch(emailModel: string, sheetModel: string): boolean {
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