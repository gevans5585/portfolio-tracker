import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const environment = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'not set',
    environmentVariables: {
      // Google API Configuration
      GOOGLE_SERVICE_ACCOUNT_KEY_FILE: {
        set: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        value: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ? 
          (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE.length > 50 ? 
            process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE.substring(0, 50) + '...' : 
            process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) : 
          'Not set'
      },
      GMAIL_USER_EMAIL: {
        set: !!process.env.GMAIL_USER_EMAIL,
        value: process.env.GMAIL_USER_EMAIL || 'Not set'
      },
      
      // Google Sheets Configuration
      ACCOUNT_MAPPINGS_SHEET_ID: {
        set: !!process.env.ACCOUNT_MAPPINGS_SHEET_ID,
        value: process.env.ACCOUNT_MAPPINGS_SHEET_ID || 'Not set'
      },
      ACCOUNT_MAPPINGS_RANGE: {
        set: !!process.env.ACCOUNT_MAPPINGS_RANGE,
        value: process.env.ACCOUNT_MAPPINGS_RANGE || 'Not set (will use default: Sheet1!A:D)'
      },
      
      // SMTP Configuration
      SMTP_HOST: {
        set: !!process.env.SMTP_HOST,
        value: process.env.SMTP_HOST || 'Not set'
      },
      SMTP_USER: {
        set: !!process.env.SMTP_USER,
        value: process.env.SMTP_USER || 'Not set'
      },
      SMTP_PASS: {
        set: !!process.env.SMTP_PASS,
        value: process.env.SMTP_PASS ? '***' : 'Not set'
      },
      
      // Email Recipients
      PORTFOLIO_SUMMARY_EMAIL: {
        set: !!process.env.PORTFOLIO_SUMMARY_EMAIL,
        value: process.env.PORTFOLIO_SUMMARY_EMAIL || 'Not set'
      },
      ERROR_NOTIFICATION_EMAIL: {
        set: !!process.env.ERROR_NOTIFICATION_EMAIL,
        value: process.env.ERROR_NOTIFICATION_EMAIL || 'Not set'
      },
      
      // Vercel Configuration
      CRON_SECRET: {
        set: !!process.env.CRON_SECRET,
        value: process.env.CRON_SECRET ? '***' : 'Not set'
      }
    },
    fileSystemChecks: {}
  };

  // Check if service account key file exists
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    try {
      const fs = require('fs');
      const keyExists = fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
      environment.fileSystemChecks = {
        serviceAccountKeyFile: {
          path: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
          exists: keyExists,
          message: keyExists ? 'File found' : 'File not found'
        }
      };

      if (keyExists) {
        try {
          const stats = fs.statSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
          (environment.fileSystemChecks as any).serviceAccountKeyFile.size = stats.size;
          (environment.fileSystemChecks as any).serviceAccountKeyFile.modified = stats.mtime.toISOString();
        } catch (error) {
          (environment.fileSystemChecks as any).serviceAccountKeyFile.error = 'Could not read file stats';
        }
      }
    } catch (error) {
      environment.fileSystemChecks = {
        serviceAccountKeyFile: {
          path: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  return res.status(200).json(environment);
}