import type { NextApiRequest, NextApiResponse } from 'next';
import { AccountPortfolioService } from '@/lib/accountPortfolioService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Testing AccountPortfolioService directly...');
    
    const accountService = new AccountPortfolioService();
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`Getting account portfolios for ${today}...`);
    const accountPortfolios = await accountService.getAccountPortfolios(today);
    
    console.log(`Got ${accountPortfolios.length} account portfolios`);
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: `Account service test completed for ${today}`,
      data: {
        date: today,
        accountPortfoliosCount: accountPortfolios.length,
        accountPortfolios: accountPortfolios.map(ap => ({
          accountName: ap.accountName,
          modelCount: ap.models.length,
          totalValue: ap.totalValue,
          models: ap.models.map(m => m.name)
        })),
        expectedAccounts: [
          "Anne RRSP $CAN", "Anne RRSP $USD", "Anne TFSA $CAD", "Anne TFSA $USD", 
          "Anne and Glen Joint $CAD", "Anne and Glen Joint $USD", 
          "Glen RRSP $CAD", "Glen RRSP $USD", "Glen TFSA $CAD", "Glen TFSA $USD", 
          "Kate TFSA $CAD", "Kate TFSA $USD", "Kian TFSA $USD"
        ],
        missingAccounts: [
          "Anne RRSP $CAN", "Anne RRSP $USD", "Anne TFSA $CAD", "Anne TFSA $USD", 
          "Anne and Glen Joint $CAD", "Anne and Glen Joint $USD", 
          "Glen RRSP $CAD", "Glen RRSP $USD", "Glen TFSA $CAD", "Glen TFSA $USD", 
          "Kate TFSA $CAD", "Kate TFSA $USD", "Kian TFSA $USD"
        ].filter(expectedAccount => 
          !accountPortfolios.some(ap => ap.accountName === expectedAccount)
        )
      }
    });

  } catch (error) {
    console.error('Account service test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Account service test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}