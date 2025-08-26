import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioService } from '@/lib/portfolioService';
import { EmailSummaryGenerator } from '@/lib/emailGenerator';
import { TimezoneUtils } from '@/lib/timezoneUtils';
import nodemailer from 'nodemailer';

// Manual test endpoint to trigger email immediately
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Simple auth check - require a test secret or allow in development
  const isAuthorized = 
    req.headers.authorization === `Bearer ${process.env.CRON_SECRET}` ||
    process.env.NODE_ENV === 'development' ||
    req.query.secret === process.env.CRON_SECRET;

  if (!isAuthorized) {
    return res.status(401).json({ message: 'Unauthorized. Use ?secret=YOUR_CRON_SECRET or auth header' });
  }

  try {
    // Add timezone debugging for test
    TimezoneUtils.logTimezoneDebug();
    console.log('Starting manual email test...');
    
    const portfolioService = new PortfolioService();
    const emailGenerator = new EmailSummaryGenerator();

    // Get portfolio summary (same as cron job)
    const summary = await portfolioService.getPortfolioSummary();
    
    console.log(`Processed ${summary.totalAccounts} accounts`);

    // Generate email content with improvements
    const htmlContent = emailGenerator.generateDailySummaryHTML(summary);
    const textContent = emailGenerator.generateTextSummary(summary);

    // Send test email if SMTP configured
    let emailSent = false;
    if (process.env.SMTP_HOST && process.env.PORTFOLIO_SUMMARY_EMAIL) {
      await sendTestEmail(htmlContent, textContent, summary, emailGenerator);
      emailSent = true;
      console.log('Test email sent successfully');
    }

    return res.status(200).json({
      success: true,
      message: 'Manual email test completed successfully',
      timestamp: new Date().toISOString(),
      data: {
        totalAccounts: summary.totalAccounts,
        weightedDayReturn: emailGenerator.calculateWeightedDayChange(summary.comparisons),
        alertCount: summary.alerts.length,
        emailSent,
        improvements: [
          '✅ Removed all dollar amounts',
          '✅ Added models performance table',
          '✅ Calculated weighted daily returns',
          '✅ Enhanced percentage-focused content'
        ]
      },
      preview: {
        subject: generateTestSubject(summary, emailGenerator),
        accountsCount: summary.totalAccounts,
        comparisons: summary.comparisons.length
      }
    });
  } catch (error) {
    console.error('Error in manual email test:', error);
    
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
}

async function sendTestEmail(htmlContent: string, textContent: string, summary: any, emailGenerator: EmailSummaryGenerator) {
  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.GMAIL_USER_EMAIL,
      pass: process.env.SMTP_PASS || process.env.GMAIL_PASSWORD,
    },
  });

  const subject = generateTestSubject(summary, emailGenerator);
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.PORTFOLIO_SUMMARY_EMAIL,
    subject: `🧪 TEST - ${subject}`,
    text: `TEST EMAIL - This is a manual test of the improved email system.\n\n${textContent}`,
    html: `
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-bottom: 20px;">
        <h3 style="color: #856404; margin: 0;">🧪 TEST EMAIL</h3>
        <p style="color: #856404; margin: 10px 0 0 0;">This is a manual test of the improved email system with all enhancements.</p>
      </div>
      ${htmlContent}
    `,
  });
}

function generateTestSubject(summary: any, emailGenerator: EmailSummaryGenerator): string {
  const date = TimezoneUtils.getDateStringEST();
  const weightedReturn = summary.comparisons ? 
    emailGenerator.calculateWeightedDayChange(summary.comparisons) : 
    0;
  const changeIndicator = weightedReturn >= 0 ? '📈' : '📉';
  const changePercent = Math.abs(weightedReturn).toFixed(2);
  
  return `${changeIndicator} Daily Portfolio Summary - ${date} (${weightedReturn >= 0 ? '+' : ''}${changePercent}%)`;
}