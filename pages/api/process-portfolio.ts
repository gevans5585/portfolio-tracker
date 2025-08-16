import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioService } from '@/lib/portfolioService';
import { EmailSummaryGenerator } from '@/lib/emailGenerator';
import nodemailer from 'nodemailer';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const portfolioService = new PortfolioService();
    const emailGenerator = new EmailSummaryGenerator();

    // Process portfolio data
    const summary = await portfolioService.getPortfolioSummary();
    
    // Generate email content
    const htmlContent = emailGenerator.generateDailySummaryHTML(summary);
    const textContent = emailGenerator.generateTextSummary(summary);

    // Send email if configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      await sendSummaryEmail(htmlContent, textContent, summary);
    }

    return res.status(200).json({
      success: true,
      message: 'Portfolio processed successfully',
      data: {
        totalAccounts: summary.totalAccounts,
        totalValue: summary.totalValue,
        totalDayChange: summary.totalDayChange,
        alertCount: summary.alerts.length,
      },
    });
  } catch (error) {
    console.error('Error processing portfolio:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
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
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.PORTFOLIO_SUMMARY_EMAIL,
    subject: `${changeIndicator} Portfolio Summary - ${date} (${summary.totalDayChange >= 0 ? '+' : ''}$${Math.abs(summary.totalDayChange).toFixed(2)})`,
    text: textContent,
    html: htmlContent,
  });
}