import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleSheetsService } from '@/lib/googleSheets';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      hasSheetId: !!process.env.ACCOUNT_MAPPINGS_SHEET_ID,
      hasRange: !!process.env.ACCOUNT_MAPPINGS_RANGE,
      serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || 'Not set',
      sheetId: process.env.ACCOUNT_MAPPINGS_SHEET_ID || 'Not set',
      range: process.env.ACCOUNT_MAPPINGS_RANGE || 'Sheet1!A:D (default)',
    },
    tests: {}
  };

  try {
    // Test 1: Service instantiation
    results.tests.serviceInstantiation = { status: 'testing' };
    try {
      const sheetsService = new GoogleSheetsService();
      results.tests.serviceInstantiation = {
        status: 'success',
        message: 'GoogleSheetsService instantiated successfully'
      };

      // Test 2: Check if service account key file exists
      results.tests.keyFileCheck = { status: 'testing' };
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
        try {
          const fs = require('fs');
          const keyExists = fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
          results.tests.keyFileCheck = {
            status: keyExists ? 'success' : 'failed',
            message: keyExists ? 'Service account key file found' : 'Service account key file not found',
            path: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
          };

          if (keyExists) {
            // Try to read and parse the key file
            try {
              const keyContent = fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE, 'utf8');
              const keyData = JSON.parse(keyContent);
              results.tests.keyFileValidation = {
                status: 'success',
                message: 'Service account key file is valid JSON',
                hasClientEmail: !!keyData.client_email,
                hasPrivateKey: !!keyData.private_key,
                clientEmail: keyData.client_email || 'Not found'
              };
            } catch (parseError) {
              results.tests.keyFileValidation = {
                status: 'failed',
                message: 'Service account key file is not valid JSON',
                error: parseError instanceof Error ? parseError.message : 'Unknown error'
              };
            }
          }
        } catch (error) {
          results.tests.keyFileCheck = {
            status: 'failed',
            message: 'Error checking service account key file',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      } else {
        results.tests.keyFileCheck = {
          status: 'failed',
          message: 'GOOGLE_SERVICE_ACCOUNT_KEY_FILE environment variable not set'
        };
      }

      // Test 3: Try to fetch account mappings (if we have the basics)
      if (results.tests.keyFileCheck.status === 'success' && process.env.ACCOUNT_MAPPINGS_SHEET_ID) {
        results.tests.sheetsConnection = { status: 'testing' };
        try {
          const mappings = await sheetsService.getAccountMappings();
          results.tests.sheetsConnection = {
            status: 'success',
            message: `Successfully fetched ${mappings.length} account mappings`,
            mappingCount: mappings.length,
            firstMapping: mappings[0] || null
          };
        } catch (error) {
          results.tests.sheetsConnection = {
            status: 'failed',
            message: 'Failed to fetch account mappings',
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          };
        }
      } else {
        results.tests.sheetsConnection = {
          status: 'skipped',
          message: 'Skipped due to missing prerequisites (key file or sheet ID)'
        };
      }

      // Test 4: Get mapping summary (if connection worked)
      if (results.tests.sheetsConnection.status === 'success') {
        results.tests.mappingSummary = { status: 'testing' };
        try {
          const summary = await sheetsService.getMappingSummary();
          results.tests.mappingSummary = {
            status: 'success',
            message: 'Successfully generated mapping summary',
            summary
          };
        } catch (error) {
          results.tests.mappingSummary = {
            status: 'failed',
            message: 'Failed to generate mapping summary',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      } else {
        results.tests.mappingSummary = {
          status: 'skipped',
          message: 'Skipped due to failed sheets connection'
        };
      }

    } catch (error) {
      results.tests.serviceInstantiation = {
        status: 'failed',
        message: 'Failed to instantiate GoogleSheetsService',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };
    }

    // Overall status
    const allTests = Object.values(results.tests);
    const failedTests = allTests.filter((test: any) => test.status === 'failed');
    const successTests = allTests.filter((test: any) => test.status === 'success');
    const skippedTests = allTests.filter((test: any) => test.status === 'skipped');

    results.summary = {
      totalTests: allTests.length,
      successful: successTests.length,
      failed: failedTests.length,
      skipped: skippedTests.length,
      overallStatus: failedTests.length === 0 && successTests.length > 0 ? 'success' : 'failed'
    };

    return res.status(200).json(results);

  } catch (error) {
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: 'Unexpected error during testing',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      environment: results.environment
    });
  }
}