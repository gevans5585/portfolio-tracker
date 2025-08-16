import { google } from 'googleapis';
import { AccountMapping } from '@/types';

export class GoogleSheetsService {
  private sheets;

  constructor() {
    const authOptions: any = {
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    };

    // Support both file-based and environment variable-based service account keys
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      // Parse the JSON string from environment variable
      authOptions.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
      // Use file path (for local development)
      authOptions.keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    } else {
      throw new Error('No Google service account credentials configured');
    }

    const auth = new google.auth.GoogleAuth(authOptions);
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async getAccountMappings(spreadsheetId?: string, range?: string): Promise<AccountMapping[]> {
    try {
      const sheetId = spreadsheetId || process.env.ACCOUNT_MAPPINGS_SHEET_ID;
      const sheetRange = range || process.env.ACCOUNT_MAPPINGS_RANGE || 'Sheet1!A:D';

      if (!sheetId) {
        throw new Error('Google Sheets ID not provided');
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: sheetRange,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      const mappings: AccountMapping[] = [];
      const headers = rows[0].map(h => h.toLowerCase().trim());
      
      // Find column indices
      const emailAccountIndex = this.findColumnIndex(headers, ['email account', 'email', 'account email']);
      const displayNameIndex = this.findColumnIndex(headers, ['display name', 'name', 'account name']);
      const accountNumberIndex = this.findColumnIndex(headers, ['account number', 'account #', 'number']);
      const categoryIndex = this.findColumnIndex(headers, ['category', 'type', 'account type']);

      if (emailAccountIndex === -1 || displayNameIndex === -1) {
        throw new Error('Required columns not found in spreadsheet');
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === 0) continue;

        const mapping: AccountMapping = {
          emailAccount: row[emailAccountIndex] || '',
          displayName: row[displayNameIndex] || '',
          accountNumber: accountNumberIndex !== -1 ? (row[accountNumberIndex] || '') : '',
          category: categoryIndex !== -1 ? (row[categoryIndex] || '') : '',
        };

        if (mapping.emailAccount && mapping.displayName) {
          mappings.push(mapping);
        }
      }

      return mappings;
    } catch (error) {
      console.error('Error fetching account mappings:', error);
      throw error;
    }
  }

  private findColumnIndex(headers: string[], searchTerms: string[]): number {
    for (const term of searchTerms) {
      const index = headers.findIndex(header => header.includes(term));
      if (index !== -1) return index;
    }
    return -1;
  }

  async updateAccountMapping(
    spreadsheetId: string,
    range: string,
    mapping: AccountMapping
  ): Promise<void> {
    try {
      const values = [
        [mapping.emailAccount, mapping.displayName, mapping.accountNumber, mapping.category]
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });
    } catch (error) {
      console.error('Error updating account mapping:', error);
      throw error;
    }
  }

  async createAccountMappingsSheet(
    spreadsheetId: string,
    sheetName: string = 'Account Mappings'
  ): Promise<void> {
    try {
      // Create the sheet
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      // Add headers
      const headers = [['Email Account', 'Display Name', 'Account Number', 'Category']];
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: headers,
        },
      });

      // Format headers
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 4,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.9,
                      green: 0.9,
                      blue: 0.9,
                    },
                    textFormat: {
                      bold: true,
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error creating account mappings sheet:', error);
      throw error;
    }
  }

  mapEmailToAccount(emailAccount: string, mappings: AccountMapping[]): AccountMapping | null {
    return mappings.find(mapping => 
      mapping.emailAccount.toLowerCase() === emailAccount.toLowerCase()
    ) || null;
  }

  getAccountsByCategory(mappings: AccountMapping[]): Record<string, AccountMapping[]> {
    const grouped: Record<string, AccountMapping[]> = {};
    
    for (const mapping of mappings) {
      const category = mapping.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(mapping);
    }

    return grouped;
  }

  validateMappings(mappings: AccountMapping[]): {
    valid: AccountMapping[];
    invalid: Array<{ mapping: AccountMapping; issues: string[] }>;
  } {
    const valid: AccountMapping[] = [];
    const invalid: Array<{ mapping: AccountMapping; issues: string[] }> = [];

    for (const mapping of mappings) {
      const issues: string[] = [];

      if (!mapping.emailAccount || mapping.emailAccount.trim() === '') {
        issues.push('Missing email account');
      }

      if (!mapping.displayName || mapping.displayName.trim() === '') {
        issues.push('Missing display name');
      }

      if (mapping.emailAccount && !this.isValidEmail(mapping.emailAccount)) {
        issues.push('Invalid email format');
      }

      if (issues.length === 0) {
        valid.push(mapping);
      } else {
        invalid.push({ mapping, issues });
      }
    }

    return { valid, invalid };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async getMappingSummary(spreadsheetId?: string): Promise<{
    totalMappings: number;
    categories: Record<string, number>;
    validMappings: number;
    invalidMappings: number;
  }> {
    try {
      const mappings = await this.getAccountMappings(spreadsheetId);
      const { valid, invalid } = this.validateMappings(mappings);
      const categorized = this.getAccountsByCategory(valid);

      const categories: Record<string, number> = {};
      for (const [category, accounts] of Object.entries(categorized)) {
        categories[category] = accounts.length;
      }

      return {
        totalMappings: mappings.length,
        categories,
        validMappings: valid.length,
        invalidMappings: invalid.length,
      };
    } catch (error) {
      console.error('Error getting mapping summary:', error);
      throw error;
    }
  }

  /**
   * Get model-to-account mappings from Columns A and B of the Google Sheet
   */
  async getModelAccountMappings(spreadsheetId?: string, range?: string): Promise<Array<{model: string, account: string}>> {
    try {
      const sheetId = spreadsheetId || process.env.PORTFOLIO_MODELS_SHEET_ID || process.env.ACCOUNT_MAPPINGS_SHEET_ID;
      const sheetRange = range || 'Sheet1!A:B';

      if (!sheetId) {
        throw new Error('Google Sheets ID not provided for model-account mappings');
      }

      console.log(`Fetching model-account mappings from sheet: ${sheetId}, range: ${sheetRange}`);

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: sheetRange,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log('No rows found in model-account mappings sheet');
        return [];
      }

      // Extract mappings from Columns A and B, skip header row
      const mappings = rows
        .slice(1) // Skip header row
        .filter(row => row[0] && row[1]) // Filter out rows missing model or account
        .map(row => ({
          model: row[0].trim(),
          account: row[1].trim()
        }));

      console.log(`Found ${mappings.length} model-account mappings:`, mappings);
      return mappings;
    } catch (error) {
      console.error('Error fetching model-account mappings:', error);
      throw error;
    }
  }

  /**
   * Get model names from Column A of the Google Sheet for portfolio filtering
   */
  async getPortfolioModels(spreadsheetId?: string, range?: string): Promise<string[]> {
    try {
      const sheetId = spreadsheetId || process.env.PORTFOLIO_MODELS_SHEET_ID || process.env.ACCOUNT_MAPPINGS_SHEET_ID;
      const sheetRange = range || process.env.PORTFOLIO_MODELS_RANGE || 'Sheet1!A:A';

      if (!sheetId) {
        throw new Error('Google Sheets ID not provided for portfolio models');
      }

      console.log(`Fetching portfolio models from sheet: ${sheetId}, range: ${sheetRange}`);

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: sheetRange,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log('No rows found in portfolio models sheet');
        return [];
      }

      // Extract model names from Column A, skip header row, filter out empty values
      const models = rows
        .slice(1) // Skip header row
        .map(row => row[0]) // Get Column A
        .filter(model => model && typeof model === 'string' && model.trim() !== '') // Filter out empty/invalid values
        .map(model => model.trim()); // Clean whitespace

      console.log(`Found ${models.length} portfolio models:`, models);
      return models;
    } catch (error) {
      console.error('Error fetching portfolio models:', error);
      throw error;
    }
  }
}