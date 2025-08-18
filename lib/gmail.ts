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
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      };

      // Support multiple credential formats
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
        // Decode Base64 encoded service account key (recommended for Vercel)
        try {
          const decodedKey = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8');
          authOptions.credentials = JSON.parse(decodedKey);
        } catch (error) {
          throw new Error('Failed to decode Base64 service account key: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        // Parse the JSON string from environment variable (with line break handling)
        try {
          // Handle potential line breaks and formatting issues from Vercel UI
          const cleanedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
            .replace(/\n/g, '')
            .replace(/\r/g, '')
            .trim();
          authOptions.credentials = JSON.parse(cleanedKey);
        } catch (error) {
          throw new Error('Failed to parse service account key JSON: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
        // Use file path (for local development)
        authOptions.keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
      } else {
        throw new Error('No Google service account credentials configured. Please set GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, GOOGLE_SERVICE_ACCOUNT_KEY, or GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
      }

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
      
      if (!this.gmail) {
        throw new Error('Gmail API not initialized');
      }
      
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
          if (!this.gmail) {
            throw new Error('Gmail API not initialized');
          }
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

      if (!this.gmail) {
        throw new Error('Gmail API not initialized');
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