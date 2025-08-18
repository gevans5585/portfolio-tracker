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
        hasServiceAccountKeyBase64: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64,
        hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        hasServiceAccountKeyFile: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        hasSheetId: !!process.env.ACCOUNT_MAPPINGS_SHEET_ID,
        sheetId: process.env.ACCOUNT_MAPPINGS_SHEET_ID ? 
          process.env.ACCOUNT_MAPPINGS_SHEET_ID.substring(0, 20) + '...' : 'Not set',
        sheetRange: process.env.ACCOUNT_MAPPINGS_RANGE || 'Sheet1!A:D (default)',
        credentialMethod: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 ? 'Base64' :
                         process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? 'JSON String' :
                         process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ? 'File Path' : 'None'
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

    // Test credential parsing based on available method
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      try {
        const decodedKey = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
        const parsed = JSON.parse(decodedKey);
        debug.testResults.credentialParsing = {
          method: 'Base64',
          success: true,
          hasRequiredFields: !!(parsed.type && parsed.project_id && parsed.private_key && parsed.client_email),
          projectId: parsed.project_id,
          clientEmail: parsed.client_email
        };
      } catch (error) {
        debug.testResults.credentialParsing = {
          method: 'Base64',
          success: false,
          error: error instanceof Error ? error.message : 'Base64 decode or JSON parsing failed',
          base64Length: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64.length
        };
      }
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const cleanedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
          .replace(/\n/g, '')
          .replace(/\r/g, '')
          .trim();
        const parsed = JSON.parse(cleanedKey);
        debug.testResults.credentialParsing = {
          method: 'JSON String',
          success: true,
          hasRequiredFields: !!(parsed.type && parsed.project_id && parsed.private_key && parsed.client_email),
          projectId: parsed.project_id,
          clientEmail: parsed.client_email
        };
      } catch (error) {
        debug.testResults.credentialParsing = {
          method: 'JSON String',
          success: false,
          error: error instanceof Error ? error.message : 'JSON parsing failed',
          credentialLength: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.length,
          hasLineBreaks: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.includes('\n'),
          preview: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.substring(0, 100) + '...'
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