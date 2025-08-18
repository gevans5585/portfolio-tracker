import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioService } from '@/lib/portfolioService';
import { EmailSummaryGenerator } from '@/lib/emailGenerator';
import { BusinessDayUtils } from '@/lib/businessDayUtils';
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
    const today = new Date().toISOString().split('T')[0];
    
    // Check if today is a trading day
    if (!BusinessDayUtils.shouldSendDailyEmail(today)) {
      console.log(`${today} is not a trading day - ${BusinessDayUtils.getNoChangeReason(today)}. Skipping email.`);
      return res.status(200).json({
        success: true,
        message: `Daily processing skipped - ${BusinessDayUtils.getNoChangeReason(today)}`,
        timestamp: new Date().toISOString(),
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
    subject: `${changeIndicator} Daily Portfolio Summary - ${date} (${summary.totalDayChange >= 0 ? '+' : '-'}$${changeAmount})`,
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
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const date = new Date().toLocaleDateString();
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ERROR_NOTIFICATION_EMAIL,
    subject: `🚨 Portfolio Tracker Error - ${date}`,
    text: `An error occurred during daily portfolio processing:\n\n${errorMessage}\n\nTimestamp: ${new Date().toISOString()}`,
    html: `
      <h2>🚨 Portfolio Tracker Error</h2>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
      <p><strong>Error:</strong></p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${errorMessage}</pre>
    `,
  });
}