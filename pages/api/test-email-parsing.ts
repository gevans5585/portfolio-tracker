import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioService } from '@/lib/portfolioService';
import { EmailParser } from '@/lib/emailParser';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { htmlContent, subject, date } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ message: 'HTML content is required' });
    }

    const emailParser = new EmailParser();
    const result = emailParser.parsePortfolioEmail(
      htmlContent,
      subject || 'Test Email',
      date || new Date().toISOString()
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: result ? 'Parsing successful' : 'Could not parse email content',
    });
  } catch (error) {
    console.error('Error testing email parsing:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
}