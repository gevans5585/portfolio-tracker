import * as nodemailer from 'nodemailer';
import { ChangeAlert, PortfolioChange } from '../types';

export class EmailAlertService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.GMAIL_USER_EMAIL,
        pass: process.env.GMAIL_PASSWORD,
      },
    });
  }

  async sendChangeAlert(changeAlert: ChangeAlert): Promise<void> {
    if (changeAlert.totalChanges === 0) {
      console.log('No portfolio changes detected, skipping email alert');
      return;
    }

    try {
      const emailHtml = this.generateChangeAlertHtml(changeAlert);
      const emailText = this.generateChangeAlertText(changeAlert);

      const mailOptions = {
        from: process.env.GMAIL_USER_EMAIL,
        to: process.env.PORTFOLIO_SUMMARY_EMAIL,
        cc: process.env.ERROR_NOTIFICATION_EMAIL, // Copy Glen on alerts
        subject: 'Changes required in the Following Family Models Today',
        html: emailHtml,
        text: emailText,
      };

      console.log(`Sending change alert email to ${process.env.PORTFOLIO_SUMMARY_EMAIL}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Changes: ${changeAlert.totalChanges} across ${changeAlert.affectedAccounts.length} accounts`);

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Change alert email sent successfully:', result.messageId);

    } catch (error) {
      console.error('Error sending change alert email:', error);
      throw error;
    }
  }

  private generateChangeAlertHtml(changeAlert: ChangeAlert): string {
    const { changes, totalChanges, affectedAccounts, date } = changeAlert;

    let html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .summary { background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin-bottom: 25px; }
            .account-section { margin-bottom: 30px; }
            .account-title { color: #1976d2; font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #1976d2; padding-bottom: 5px; }
            .model { background-color: #fff; border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 6px; }
            .model-name { font-weight: bold; color: #333; font-size: 16px; margin-bottom: 10px; }
            .changes { margin-left: 20px; }
            .added { color: #4caf50; font-weight: bold; }
            .removed { color: #f44336; font-weight: bold; }
            .no-changes { color: #666; font-style: italic; }
            .holding-list { margin: 5px 0; padding-left: 20px; }
            .holding-item { margin: 3px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Portfolio Changes Required - ${this.formatDate(date)}</h1>
            <p>The following changes have been detected in your family portfolio models and require implementation:</p>
          </div>

          <div class="summary">
            <h2>Summary</h2>
            <ul>
              <li><strong>Total Changes:</strong> ${totalChanges} models with changes</li>
              <li><strong>Affected Accounts:</strong> ${affectedAccounts.length} accounts</li>
              <li><strong>Accounts:</strong> ${affectedAccounts.join(', ')}</li>
              <li><strong>Date:</strong> ${this.formatDate(date)}</li>
            </ul>
          </div>
    `;

    // Group changes by account
    const changesByAccount = this.groupChangesByAccount(changes);

    for (const [accountName, accountChanges] of Object.entries(changesByAccount)) {
      html += `
        <div class="account-section">
          <div class="account-title">${accountName}</div>
      `;

      for (const change of accountChanges) {
        html += `
          <div class="model">
            <div class="model-name">${change.modelName}</div>
            <div class="changes">
        `;

        if (change.addedHoldings.length > 0) {
          html += `
            <div class="added">ADDED (New Trades - shown in GREEN):</div>
            <div class="holding-list">
          `;
          for (const holding of change.addedHoldings) {
            html += `<div class="holding-item">• ${holding}</div>`;
          }
          html += `</div>`;
        }

        if (change.removedHoldings.length > 0) {
          html += `
            <div class="removed">REMOVED (No longer in portfolio):</div>
            <div class="holding-list">
          `;
          for (const holding of change.removedHoldings) {
            html += `<div class="holding-item">• ${holding}</div>`;
          }
          html += `</div>`;
        }

        if (change.addedHoldings.length === 0 && change.removedHoldings.length === 0) {
          html += `<div class="no-changes">No specific holding changes detected</div>`;
        }

        html += `
            </div>
          </div>
        `;
      }

      html += `</div>`;
    }

    html += `
          <div class="footer">
            <p><strong>Instructions:</strong></p>
            <ul>
              <li>GREEN holdings in the email indicate new trades that need to be implemented</li>
              <li>REMOVED holdings are positions that should be sold/closed</li>
              <li>Please review the latest StockApp Systems email for complete details</li>
              <li>This alert was generated automatically from your portfolio tracking system</li>
            </ul>
            <p><em>Generated: ${new Date().toLocaleString()}</em></p>
          </div>
        </body>
      </html>
    `;

    return html;
  }

  private generateChangeAlertText(changeAlert: ChangeAlert): string {
    const { changes, totalChanges, affectedAccounts, date } = changeAlert;

    let text = `PORTFOLIO CHANGES REQUIRED - ${this.formatDate(date)}\n\n`;
    
    text += `SUMMARY:\n`;
    text += `- Total Changes: ${totalChanges} models with changes\n`;
    text += `- Affected Accounts: ${affectedAccounts.length} accounts\n`;
    text += `- Accounts: ${affectedAccounts.join(', ')}\n`;
    text += `- Date: ${this.formatDate(date)}\n\n`;

    const changesByAccount = this.groupChangesByAccount(changes);

    for (const [accountName, accountChanges] of Object.entries(changesByAccount)) {
      text += `${accountName.toUpperCase()}\n`;
      text += `${'='.repeat(accountName.length)}\n\n`;

      for (const change of accountChanges) {
        text += `${change.modelName}\n`;
        text += `${'-'.repeat(change.modelName.length)}\n`;

        if (change.addedHoldings.length > 0) {
          text += `ADDED (New Trades - shown in GREEN):\n`;
          for (const holding of change.addedHoldings) {
            text += `  • ${holding}\n`;
          }
          text += `\n`;
        }

        if (change.removedHoldings.length > 0) {
          text += `REMOVED (No longer in portfolio):\n`;
          for (const holding of change.removedHoldings) {
            text += `  • ${holding}\n`;
          }
          text += `\n`;
        }

        text += `\n`;
      }
    }

    text += `INSTRUCTIONS:\n`;
    text += `- GREEN holdings in the email indicate new trades that need to be implemented\n`;
    text += `- REMOVED holdings are positions that should be sold/closed\n`;
    text += `- Please review the latest StockApp Systems email for complete details\n`;
    text += `- This alert was generated automatically from your portfolio tracking system\n\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;

    return text;
  }

  private groupChangesByAccount(changes: PortfolioChange[]): { [accountName: string]: PortfolioChange[] } {
    const grouped: { [accountName: string]: PortfolioChange[] } = {};
    
    for (const change of changes) {
      if (!grouped[change.accountName]) {
        grouped[change.accountName] = [];
      }
      grouped[change.accountName].push(change);
    }
    
    return grouped;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}