import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioService } from '@/lib/portfolioService';
import { EmailSummaryGenerator } from '@/lib/emailGenerator';
import { BusinessDayUtils } from '@/lib/businessDayUtils';
import { TimezoneUtils } from '@/lib/timezoneUtils';
import nodemailer from 'nodemailer';

// This endpoint will be called by Vercel Cron Jobs
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Add timezone debugging and validation
    TimezoneUtils.logTimezoneDebug();
    
    // Validate we're running during business hours
    if (!TimezoneUtils.isBusinessHours()) {
      console.warn('TIMEZONE WARNING: Running outside business hours!');
    }
    
    const today = TimezoneUtils.getCurrentESTDateString();
    console.log(`Processing portfolio for EST date: ${today}`);
    
    // Check if today is a trading day
    if (!BusinessDayUtils.shouldSendDailyEmail(today)) {
      console.log(`${today} is not a trading day - ${BusinessDayUtils.getNoChangeReason(today)}. Skipping email.`);
      return res.status(200).json({
        success: true,
        message: `Daily processing skipped - ${BusinessDayUtils.getNoChangeReason(today)}`,
        timestamp: new Date().toISOString(),
        estTime: TimezoneUtils.getCurrentESTString(),
        data: {
          tradingDay: false,
          reason: BusinessDayUtils.getNoChangeReason(today)
        },
      });
    }

    const portfolioService = new PortfolioService();
    const emailGenerator = new EmailSummaryGenerator();

    console.log('Starting daily portfolio processing for trading day...');

    // Get portfolio summary
    const summary = await portfolioService.getPortfolioSummary();
    
    console.log(`Processed ${summary.totalAccounts} accounts with total value $${summary.totalValue.toFixed(2)}`);

    // Generate email content
    const htmlContent = emailGenerator.generateDailySummaryHTML(summary);
    const textContent = emailGenerator.generateTextSummary(summary);

    // Send summary email
    if (process.env.SMTP_HOST && process.env.PORTFOLIO_SUMMARY_EMAIL) {
      await sendSummaryEmail(htmlContent, textContent, summary);
      console.log('Summary email sent successfully');
    }

    return res.status(200).json({
      success: true,
      message: 'Daily portfolio processing completed',
      timestamp: new Date().toISOString(),
      data: {
        totalAccounts: summary.totalAccounts,
        totalValue: summary.totalValue,
        totalDayChange: summary.totalDayChange,
        alertCount: summary.alerts.length,
        emailSent: !!(process.env.SMTP_HOST && process.env.PORTFOLIO_SUMMARY_EMAIL),
      },
    });
  } catch (error) {
    console.error('Error in daily portfolio processing:', error);
    
    // Send error notification if configured
    if (process.env.SMTP_HOST && process.env.ERROR_NOTIFICATION_EMAIL) {
      await sendErrorNotification(error);
    }

    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    });
  }
}

async function sendSummaryEmail(htmlContent: string, textContent: string, summary: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.GMAIL_USER_EMAIL,
      pass: process.env.SMTP_PASS || process.env.GMAIL_PASSWORD,
    },
  });

  const date = TimezoneUtils.getDateStringEST();
  const emailGenerator = new EmailSummaryGenerator();
  const weightedReturn = summary.comparisons ? 
    emailGenerator.calculateWeightedDayChange(summary.comparisons) : 
    summary.totalDayChangePercent;
  const changeIndicator = weightedReturn >= 0 ? '📈' : '📉';
  const changePercent = Math.abs(weightedReturn).toFixed(2);
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.PORTFOLIO_SUMMARY_EMAIL,
    subject: `${changeIndicator} Daily Portfolio Summary - ${date} (${weightedReturn >= 0 ? '+' : ''}${changePercent}%)`,
    text: textContent,
    html: htmlContent,
  });
}

async function sendErrorNotification(error: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.GMAIL_USER_EMAIL,
      pass: process.env.SMTP_PASS || process.env.GMAIL_PASSWORD,
    },
  });

  const date = TimezoneUtils.getDateStringEST();
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ERROR_NOTIFICATION_EMAIL,
    subject: `🚨 Portfolio Tracker Error - ${date}`,
    text: `An error occurred during daily portfolio processing:\n\n${errorMessage}\n\nEST Time: ${TimezoneUtils.getCurrentESTString()}\nUTC Time: ${new Date().toISOString()}`,
    html: `
      <h2>🚨 Portfolio Tracker Error</h2>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>EST Time:</strong> ${TimezoneUtils.getCurrentESTString()}</p>
      <p><strong>Error:</strong></p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${errorMessage}</pre>
    `,
  });
}