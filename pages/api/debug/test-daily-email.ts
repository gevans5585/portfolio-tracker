import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioService } from '@/lib/portfolioService';
import { EmailSummaryGenerator } from '@/lib/emailGenerator';
import nodemailer from 'nodemailer';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Testing daily email functionality...');

    const debug = {
      environmentCheck: {
        hasSmtpHost: !!process.env.SMTP_HOST,
        hasSmtpUser: !!process.env.SMTP_USER,
        hasSmtpPass: !!process.env.SMTP_PASS,
        hasPortfolioSummaryEmail: !!process.env.PORTFOLIO_SUMMARY_EMAIL,
        hasErrorNotificationEmail: !!process.env.ERROR_NOTIFICATION_EMAIL,
        hasCronSecret: !!process.env.CRON_SECRET,
        smtpHost: process.env.SMTP_HOST || 'Not set',
        smtpPort: process.env.SMTP_PORT || '587 (default)',
        portfolioSummaryEmail: process.env.PORTFOLIO_SUMMARY_EMAIL || 'Not set',
        errorNotificationEmail: process.env.ERROR_NOTIFICATION_EMAIL || 'Not set'
      },
      testResults: {} as any
    };

    // Test SMTP connection
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.verify();
        debug.testResults.smtpConnection = { success: true };
      } catch (error) {
        debug.testResults.smtpConnection = {
          success: false,
          error: error instanceof Error ? error.message : 'SMTP connection failed'
        };
      }
    } else {
      debug.testResults.smtpConnection = {
        success: false,
        error: 'Missing SMTP configuration'
      };
    }

    // Test portfolio service (without sending actual email)
    try {
      const portfolioService = new PortfolioService();
      const summary = await portfolioService.getPortfolioSummary();
      
      debug.testResults.portfolioService = {
        success: true,
        totalAccounts: summary.totalAccounts,
        totalValue: summary.totalValue,
        alertCount: summary.alerts.length
      };

      // Generate email content (for preview)
      const emailGenerator = new EmailSummaryGenerator();
      const htmlContent = emailGenerator.generateDailySummaryHTML(summary);
      const textContent = emailGenerator.generateTextSummary(summary);

      debug.testResults.emailGeneration = {
        success: true,
        htmlLength: htmlContent.length,
        textLength: textContent.length,
        preview: {
          subject: `📊 Daily Portfolio Summary - ${new Date().toLocaleDateString()} (${summary.totalDayChange >= 0 ? '+' : '-'}$${Math.abs(summary.totalDayChange).toFixed(2)})`,
          hasLiveLink: htmlContent.includes('portfolio-tracker') || htmlContent.includes('vercel'),
          hasEvansbranding: htmlContent.includes('Evans Family Wealth')
        }
      };

      // Optionally send test email if requested
      if (req.query.send === 'true' && process.env.SMTP_HOST && process.env.PORTFOLIO_SUMMARY_EMAIL) {
        try {
          const transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          const date = new Date().toLocaleDateString();
          const changeIndicator = summary.totalDayChange >= 0 ? '📈' : '📉';
          const changeAmount = Math.abs(summary.totalDayChange).toFixed(2);
          
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: process.env.PORTFOLIO_SUMMARY_EMAIL,
            subject: `[TEST] ${changeIndicator} Daily Portfolio Summary - ${date} (${summary.totalDayChange >= 0 ? '+' : '-'}$${changeAmount})`,
            text: textContent,
            html: htmlContent,
          });

          debug.testResults.testEmailSent = { success: true };
        } catch (error) {
          debug.testResults.testEmailSent = {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send test email'
          };
        }
      }

    } catch (error) {
      debug.testResults.portfolioService = {
        success: false,
        error: error instanceof Error ? error.message : 'Portfolio service failed'
      };
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      debug,
      instructions: {
        sendTestEmail: 'Add ?send=true to the URL to send a test email',
        cronSchedule: '0 9 * * 1-5 (9 AM EST, Monday-Friday)',
        cronEndpoint: '/api/cron/daily-portfolio'
      }
    });

  } catch (error) {
    console.error('Daily email test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}