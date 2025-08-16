import { google } from 'googleapis';
import { GmailIMAPService } from './gmailIMAP';

export class GmailService {
  private gmail;
  private imapService?: GmailIMAPService;

  constructor() {
    // Check if we should use IMAP instead of Gmail API
    const hasIMAPCredentials = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD) && 
                              (process.env.GMAIL_USER || process.env.GMAIL_USER_EMAIL);
    
    if (hasIMAPCredentials) {
      this.imapService = new GmailIMAPService();
    } else {
      const authOptions: any = {
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      };

      // Add subject for domain-wide delegation if specified
      if (process.env.GMAIL_USER_EMAIL) {
        authOptions.subject = process.env.GMAIL_USER_EMAIL;
      }

      const auth = new google.auth.GoogleAuth(authOptions);
      this.gmail = google.gmail({ version: 'v1', auth });
    }
  }

  async getPortfolioEmails(dateFrom?: string, dateTo?: string): Promise<any[]> {
    try {
      // Use IMAP if available, otherwise fall back to Gmail API
      if (this.imapService) {
        console.log('Using IMAP service for portfolio emails');
        return await this.imapService.getPortfolioEmails(dateFrom, dateTo);
      }

      console.log('Using Gmail API for portfolio emails');
      const query = this.buildSearchQuery(dateFrom, dateTo);
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
      });

      if (!response.data.messages) {
        return [];
      }

      const emails = await Promise.all(
        response.data.messages.map(async (message) => {
          const emailData = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          return this.parseEmailData(emailData.data);
        })
      );

      return emails.filter(email => email !== null);
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  private buildSearchQuery(dateFrom?: string, dateTo?: string): string {
    // Search for portfolio emails from StockApp Systems and other common patterns
    let query = 'from:"StockApp Systems" OR from:"Shaun McQuaker" OR subject:portfolio OR subject:"daily summary" OR subject:"account summary" OR subject:"stockapp"';
    
    if (dateFrom) {
      query += ` after:${dateFrom}`;
    }
    
    if (dateTo) {
      query += ` before:${dateTo}`;
    }
    
    return query;
  }

  private parseEmailData(emailData: any) {
    const headers = emailData.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const date = headers.find((h: any) => h.name === 'Date')?.value || '';

    let htmlBody = '';
    
    if (emailData.payload?.parts) {
      const htmlPart = emailData.payload.parts.find(
        (part: any) => part.mimeType === 'text/html'
      );
      
      if (htmlPart?.body?.data) {
        htmlBody = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
      }
    } else if (emailData.payload?.body?.data) {
      htmlBody = Buffer.from(emailData.payload.body.data, 'base64').toString('utf-8');
    }

    if (!htmlBody) {
      return null;
    }

    return {
      id: emailData.id,
      subject,
      from,
      date,
      htmlBody,
    };
  }

  async getEmailById(messageId: string) {
    try {
      // IMAP service doesn't support getEmailById, so use Gmail API
      if (this.imapService) {
        console.warn('getEmailById not supported with IMAP, requires Gmail API');
        throw new Error('getEmailById not supported with IMAP service');
      }

      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return this.parseEmailData(response.data);
    } catch (error) {
      console.error('Error fetching email by ID:', error);
      throw error;
    }
  }
}