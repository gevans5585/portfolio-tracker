import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleSheetsService } from '@/lib/googleSheets';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Fetching raw Google Sheet data...');
    const sheetsService = new GoogleSheetsService();
    
    // Get raw sheet data with broader range to see columns A and B
    const sheetId = process.env.PORTFOLIO_MODELS_SHEET_ID || process.env.ACCOUNT_MAPPINGS_SHEET_ID;
    const range = 'Sheet1!A:D'; // Get columns A through D
    
    console.log(`Fetching from sheet: ${sheetId}, range: ${range}`);

    const response = await (sheetsService as any).sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No data found in sheet'
      });
    }

    console.log(`Found ${rows.length} rows`);

    // Extract first 20 rows to see the structure
    const sheetData = rows.slice(0, 20).map((row: string[], index: number) => ({
      rowIndex: index,
      columnA: row[0] || '',
      columnB: row[1] || '',
      columnC: row[2] || '',
      columnD: row[3] || ''
    }));

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Raw Google Sheet data retrieved',
      data: {
        sheetId,
        range,
        totalRows: rows.length,
        first20Rows: sheetData,
        rawData: rows.slice(0, 5) // Show first 5 rows as arrays
      }
    });

  } catch (error) {
    console.error('Show sheet data error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Show sheet data failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}