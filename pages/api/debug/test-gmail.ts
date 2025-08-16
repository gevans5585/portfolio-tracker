import type { NextApiRequest, NextApiResponse } from 'next';
import { GmailService } from '@/lib/gmail';
import { PortfolioService } from '@/lib/portfolioService';

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
      // Gmail API credentials
      hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      hasGmailUserEmail: !!process.env.GMAIL_USER_EMAIL,
      serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || 'Not set',
      gmailUserEmail: process.env.GMAIL_USER_EMAIL || 'Not set',
      // IMAP credentials
      hasGmailUser: !!(process.env.GMAIL_USER || process.env.GMAIL_USER_EMAIL),
      hasGmailAppPassword: !!(process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD),
      gmailUser: (process.env.GMAIL_USER || process.env.GMAIL_USER_EMAIL || 'Not set'),
      // Determine which service will be used
      willUseIMAP: !!((process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD) && (process.env.GMAIL_USER || process.env.GMAIL_USER_EMAIL))
    },
    tests: {}
  };

  try {
    // Test 1: Service instantiation
    results.tests.serviceInstantiation = { status: 'testing' };
    try {
      const gmailService = new GmailService();
      results.tests.serviceInstantiation = {
        status: 'success',
        message: 'GmailService instantiated successfully'
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
                clientEmail: keyData.client_email || 'Not found',
                projectId: keyData.project_id || 'Not found'
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

      // Test 3: Try a simple Gmail API call (get user profile)
      if (results.tests.keyFileCheck.status === 'success') {
        results.tests.gmailConnection = { status: 'testing' };
        try {
          // Try to get user profile (minimal Gmail API call)
          const { google } = require('googleapis');
          const authOptions: any = {
            keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
          };

          if (process.env.GMAIL_USER_EMAIL) {
            authOptions.subject = process.env.GMAIL_USER_EMAIL;
          }

          const auth = new google.auth.GoogleAuth(authOptions);
          const gmail = google.gmail({ version: 'v1', auth });

          const profile = await gmail.users.getProfile({ userId: 'me' });
          
          results.tests.gmailConnection = {
            status: 'success',
            message: 'Successfully connected to Gmail API',
            emailAddress: profile.data.emailAddress,
            messagesTotal: profile.data.messagesTotal,
            threadsTotal: profile.data.threadsTotal
          };
        } catch (error) {
          results.tests.gmailConnection = {
            status: 'failed',
            message: 'Failed to connect to Gmail API',
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          };
        }
      } else {
        results.tests.gmailConnection = {
          status: 'skipped',
          message: 'Skipped due to missing prerequisites (key file)'
        };
      }

      // Test 4: Try to search for emails (if connection worked)
      if (results.tests.gmailConnection.status === 'success') {
        results.tests.emailSearch = { status: 'testing' };
        try {
          const emails = await gmailService.getPortfolioEmails();
          results.tests.emailSearch = {
            status: 'success',
            message: `Successfully searched for portfolio emails`,
            emailCount: emails.length,
            hasEmails: emails.length > 0,
            firstEmailSubject: emails[0]?.subject || null
          };
        } catch (error) {
          results.tests.emailSearch = {
            status: 'failed',
            message: 'Failed to search for portfolio emails',
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          };
        }
      } else {
        results.tests.emailSearch = {
          status: 'skipped',
          message: 'Skipped due to failed Gmail connection'
        };
      }

      // Test 5: Test debug email fetching with date range
      if (results.tests.gmailConnection.status === 'success') {
        results.tests.debugEmailFetch = { status: 'testing' };
        try {
          const today = new Date().toISOString().split('T')[0];
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const portfolioService = new PortfolioService();
          const debugEmails = await portfolioService.getEmailsForDebugging(yesterday, today);
          results.tests.debugEmailFetch = {
            status: 'success',
            message: `Successfully fetched debug emails for date range`,
            emailCount: debugEmails.length,
            dateRange: `${yesterday} to ${today}`,
            hasEmails: debugEmails.length > 0,
            emailSubjects: debugEmails.slice(0, 3).map(email => email.subject)
          };
        } catch (error) {
          results.tests.debugEmailFetch = {
            status: 'failed',
            message: 'Failed to fetch debug emails',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      } else {
        results.tests.debugEmailFetch = {
          status: 'skipped',
          message: 'Skipped due to failed Gmail connection'
        };
      }

    } catch (error) {
      results.tests.serviceInstantiation = {
        status: 'failed',
        message: 'Failed to instantiate GmailService',
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