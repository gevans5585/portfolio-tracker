import Imap from 'imap';
import { simpleParser } from 'mailparser';

export class GmailIMAPService {
  private imapConfig: any;

  constructor() {
    this.imapConfig = {
      user: process.env.GMAIL_USER || process.env.GMAIL_USER_EMAIL,
      password: process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false
      }
    };
  }

  async getPortfolioEmails(dateFrom?: string, dateTo?: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.imapConfig);
      const emails: any[] = [];

      imap.once('ready', () => {
        console.log('IMAP connection ready');
        
        imap.openBox('INBOX', true, (err, box) => {
          if (err) {
            console.error('Error opening inbox:', err);
            return reject(err);
          }

          // Build search criteria
          const searchCriteria = this.buildSearchCriteria(dateFrom, dateTo);
          console.log('IMAP search criteria:', searchCriteria);

          imap.search(searchCriteria, (err, results) => {
            if (err) {
              console.error('IMAP search error:', err);
              return reject(err);
            }

            if (!results || results.length === 0) {
              console.log('No emails found matching criteria');
              imap.end();
              return resolve([]);
            }

            console.log(`Found ${results.length} emails matching criteria`);

            const fetch = imap.fetch(results, {
              bodies: '',
              struct: true
            });

            fetch.on('message', (msg, seqno) => {
              console.log(`Processing message ${seqno}`);
              
              msg.on('body', (stream, info) => {
                let buffer = Buffer.alloc(0);
                
                stream.on('data', (chunk) => {
                  buffer = Buffer.concat([buffer, chunk]);
                });

                stream.once('end', () => {
                  simpleParser(buffer)
                    .then(parsed => {
                      // Check if this email matches our portfolio criteria
                      if (this.isPortfolioEmail(parsed)) {
                        const emailData = {
                          id: `imap-${seqno}`,
                          subject: parsed.subject || '',
                          from: parsed.from?.text || '',
                          date: parsed.date?.toISOString() || new Date().toISOString(),
                          htmlBody: parsed.html || parsed.text || '',
                        };
                        
                        console.log(`Found portfolio email: ${emailData.subject} from ${emailData.from}`);
                        emails.push(emailData);
                      }
                    })
                    .catch(parseErr => {
                      console.error('Error parsing email:', parseErr);
                    });
                });
              });
            });

            fetch.once('error', (fetchErr) => {
              console.error('Fetch error:', fetchErr);
              reject(fetchErr);
            });

            fetch.once('end', () => {
              console.log(`Finished processing ${emails.length} portfolio emails`);
              imap.end();
            });
          });
        });
      });

      imap.once('error', (err) => {
        console.error('IMAP connection error:', err);
        reject(err);
      });

      imap.once('end', () => {
        console.log('IMAP connection ended');
        resolve(emails);
      });

      console.log('Connecting to Gmail IMAP...');
      imap.connect();
    });
  }

  private buildSearchCriteria(dateFrom?: string, dateTo?: string): any[] {
    const criteria: any[] = [];
    
    // Search for emails FROM "Shaun McQuaker" AND SUBJECT containing "StockApp Systems"
    criteria.push(['FROM', 'Shaun McQuaker']);
    criteria.push(['SUBJECT', 'StockApp Systems']);

    // If no date range specified, search for today and yesterday's emails
    if (!dateFrom && !dateTo) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Search for emails with today's or yesterday's date in subject
      // Use OR for the two date options: OR(SUBJECT today, SUBJECT yesterday)
      criteria.push(['OR', 
        ['SUBJECT', todayStr], 
        ['SUBJECT', yesterdayStr]
      ]);
    } else {
      // Add date filters if provided
      if (dateFrom) {
        criteria.push(['SINCE', this.formatDateForIMAP(dateFrom)]);
      }
      
      if (dateTo) {
        // IMAP BEFORE is exclusive, so we add 1 day
        const beforeDate = new Date(dateTo);
        beforeDate.setDate(beforeDate.getDate() + 1);
        criteria.push(['BEFORE', this.formatDateForIMAP(beforeDate.toISOString().split('T')[0])]);
      }
    }

    return criteria;
  }

  private formatDateForIMAP(dateString: string): string {
    // Convert YYYY-MM-DD to DD-MMM-YYYY format for IMAP
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  }

  private isPortfolioEmail(parsed: any): boolean {
    const subject = (parsed.subject || '').toLowerCase();
    const from = (parsed.from?.text || '').toLowerCase();
    const body = (parsed.html || parsed.text || '').toLowerCase();

    // Check if email is from StockApp Systems or contains portfolio-related content
    const isFromStockApp = from.includes('stockapp') || from.includes('shaun mcquaker');
    const hasPortfolioSubject = subject.includes('portfolio') || 
                              subject.includes('daily summary') || 
                              subject.includes('account summary') ||
                              subject.includes('stockapp');
    const hasPortfolioContent = body.includes('portfolio') || 
                               body.includes('holdings') || 
                               body.includes('shares') ||
                               body.includes('market value') ||
                               body.includes('stockapp');

    return isFromStockApp || hasPortfolioSubject || hasPortfolioContent;
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    return new Promise((resolve) => {
      const imap = new Imap(this.imapConfig);

      imap.once('ready', () => {
        console.log('IMAP test connection successful');
        imap.end();
        resolve({
          success: true,
          message: 'Successfully connected to Gmail IMAP',
          details: {
            user: this.imapConfig.user,
            host: this.imapConfig.host,
            port: this.imapConfig.port
          }
        });
      });

      imap.once('error', (err) => {
        console.error('IMAP test connection failed:', err);
        resolve({
          success: false,
          message: `IMAP connection failed: ${err.message}`,
          details: {
            user: this.imapConfig.user,
            host: this.imapConfig.host,
            port: this.imapConfig.port,
            error: err.message
          }
        });
      });

      const timeout = setTimeout(() => {
        imap.end();
        resolve({
          success: false,
          message: 'IMAP connection timed out',
          details: { timeout: '30 seconds' }
        });
      }, 30000);

      imap.once('end', () => {
        clearTimeout(timeout);
      });

      imap.connect();
    });
  }
}