import type { NextApiRequest, NextApiResponse } from 'next';
import { GmailIMAPService } from '@/lib/gmailIMAP';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const imapService = new GmailIMAPService();
    
    // Get the latest emails
    const emails = await imapService.getPortfolioEmails();
    
    if (emails.length === 0) {
      return res.status(404).json({ message: 'No emails found' });
    }

    // Get the latest email
    const latestEmail = emails[0];
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      email: {
        subject: latestEmail.subject,
        from: latestEmail.from,
        date: latestEmail.date,
        htmlBodyPreview: latestEmail.htmlBody.substring(0, 1000) + '...',
        fullHtmlBody: latestEmail.htmlBody
      },
      totalEmailsFound: emails.length
    });

  } catch (error) {
    console.error('Error fetching email content:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: 'Failed to fetch email content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}