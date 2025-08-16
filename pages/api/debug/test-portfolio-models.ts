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
    console.log('Testing portfolio models fetching...');
    const sheetsService = new GoogleSheetsService();
    
    // Test with explicit sheet ID and range
    const sheetId = process.env.PORTFOLIO_MODELS_SHEET_ID || process.env.ACCOUNT_MAPPINGS_SHEET_ID;
    const range = process.env.PORTFOLIO_MODELS_RANGE || 'Sheet1!A:A';
    
    console.log(`Using sheet ID: ${sheetId}`);
    console.log(`Using range: ${range}`);
    
    // Try to get portfolio models
    const models = await sheetsService.getPortfolioModels(sheetId, range);
    console.log(`Found ${models.length} models:`, models);
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Successfully fetched portfolio models',
      data: {
        sheetId,
        range,
        modelCount: models.length,
        models
      }
    });

  } catch (error) {
    console.error('Portfolio models test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Portfolio models test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      sheetId: process.env.PORTFOLIO_MODELS_SHEET_ID || process.env.ACCOUNT_MAPPINGS_SHEET_ID,
      range: process.env.PORTFOLIO_MODELS_RANGE || 'Sheet1!A:A'
    });
  }
}