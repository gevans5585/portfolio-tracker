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
    console.log('Testing IMAP service...');
    const imapService = new GmailIMAPService();
    
    // Test connection first
    const connectionTest = await imapService.testConnection();
    console.log('Connection test result:', connectionTest);
    
    if (!connectionTest.success) {
      return res.status(500).json({
        timestamp: new Date().toISOString(),
        connectionTest,
        error: 'IMAP connection failed'
      });
    }

    // Test email search with our fixed criteria
    console.log('Testing email search...');
    const emails = await imapService.getPortfolioEmails();
    console.log(`Found ${emails.length} emails`);
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      connectionTest,
      searchResults: {
        emailCount: emails.length,
        emails: emails.map(email => ({
          subject: email.subject,
          from: email.from,
          date: email.date,
          id: email.id
        }))
      }
    });

  } catch (error) {
    console.error('IMAP test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: 'IMAP test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}