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
    const { account, date } = req.query;
    
    if (!account || typeof account !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Account parameter is required'
      });
    }

    console.log(`Getting portfolio for account: ${account}${date ? ` on ${date}` : ''}`);
    const service = new AccountPortfolioService();
    
    const dateStr = typeof date === 'string' ? date : undefined;
    const accountPortfolios = await service.getAccountPortfolios(dateStr);
    
    // Find the specific account
    const targetAccount = accountPortfolios.find(ap => ap.accountName === account);
    
    if (!targetAccount) {
      return res.status(404).json({
        timestamp: new Date().toISOString(),
        success: false,
        error: 'Account not found',
        message: `Account "${account}" not found in portfolio data`,
        availableAccounts: accountPortfolios.map(ap => ap.accountName)
      });
    }
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: `Successfully retrieved portfolio for account "${account}"`,
      data: {
        account: targetAccount,
        summary: {
          accountName: targetAccount.accountName,
          modelCount: targetAccount.models.length,
          totalValue: targetAccount.totalValue,
          date: targetAccount.date,
          topPerformer: targetAccount.models.length > 0 ? 
            targetAccount.models.reduce((max, model) => 
              model.performance.returnYTD > max.performance.returnYTD ? model : max
            ) : null,
          worstPerformer: targetAccount.models.length > 0 ? 
            targetAccount.models.reduce((min, model) => 
              model.performance.returnYTD < min.performance.returnYTD ? model : min
            ) : null
        }
      }
    });

  } catch (error) {
    console.error('Account portfolio API error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Failed to retrieve account portfolio',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}