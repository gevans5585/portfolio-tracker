import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleSheetsService } from '@/lib/googleSheets';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Testing account mappings configuration...');

    const debug = {
      environmentCheck: {
        hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        hasServiceAccountKeyFile: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        hasSheetId: !!process.env.ACCOUNT_MAPPINGS_SHEET_ID,
        sheetId: process.env.ACCOUNT_MAPPINGS_SHEET_ID ? 
          process.env.ACCOUNT_MAPPINGS_SHEET_ID.substring(0, 20) + '...' : 'Not set',
        sheetRange: process.env.ACCOUNT_MAPPINGS_RANGE || 'Sheet1!A:D (default)',
      },
      testResults: {} as any
    };

    // Test Google Sheets service initialization
    try {
      const sheetsService = new GoogleSheetsService();
      debug.testResults.sheetsServiceInit = { success: true };
    } catch (error) {
      debug.testResults.sheetsServiceInit = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      return res.status(500).json({ debug, message: 'Failed to initialize Google Sheets service' });
    }

    // Test account mappings fetch
    try {
      const sheetsService = new GoogleSheetsService();
      const mappings = await sheetsService.getAccountMappings();
      
      debug.testResults.accountMappingsFetch = {
        success: true,
        mappingCount: mappings.length,
        firstMapping: mappings.length > 0 ? {
          emailAccount: mappings[0].emailAccount,
          displayName: mappings[0].displayName,
          accountNumber: mappings[0].accountNumber,
          category: mappings[0].category
        } : null
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      
      debug.testResults.accountMappingsFetch = { 
        success: false, 
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: errorStack
      };

      // Check if it's the specific decoder error
      if (errorMessage.includes('IE08010C:DECODER') || errorMessage.includes('unsupported')) {
        debug.testResults.decoderIssue = {
          detected: true,
          likelyCause: 'Google Service Account Key parsing issue',
          suggestedFix: 'Check GOOGLE_SERVICE_ACCOUNT_KEY format - should be valid JSON string'
        };
      }
    }

    // Test credential parsing if available
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        debug.testResults.credentialParsing = {
          success: true,
          hasRequiredFields: !!(parsed.type && parsed.project_id && parsed.private_key && parsed.client_email)
        };
      } catch (error) {
        debug.testResults.credentialParsing = {
          success: false,
          error: error instanceof Error ? error.message : 'JSON parsing failed',
          credentialLength: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.length
        };
      }
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      debug,
      message: 'Account mappings diagnostic complete'
    });

  } catch (error) {
    console.error('Diagnostic error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}