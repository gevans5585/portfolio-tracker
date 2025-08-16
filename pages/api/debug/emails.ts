import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioService } from '@/lib/portfolioService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Simple authentication check
  const { auth } = req.query;
  if (auth !== process.env.DEBUG_AUTH_KEY) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { dateFrom, dateTo } = req.query;
    
    const portfolioService = new PortfolioService();
    const emails = await portfolioService.getEmailsForDebugging(
      dateFrom as string,
      dateTo as string
    );

    // Return email metadata only (no full HTML content for security)
    const emailsMetadata = emails.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      date: email.date,
      hasHtmlBody: !!email.htmlBody,
      htmlBodyLength: email.htmlBody ? email.htmlBody.length : 0,
    }));

    return res.status(200).json({
      success: true,
      count: emails.length,
      emails: emailsMetadata,
    });
  } catch (error) {
    console.error('Error fetching debug emails:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}