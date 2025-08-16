import type { NextApiRequest, NextApiResponse } from 'next';
import { CombinedAccountService } from '@/lib/combinedAccountService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Getting combined accounts list...');

    const combinedAccountService = new CombinedAccountService();
    
    const { date } = req.query;
    const targetDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    
    const combinedAccounts = await combinedAccountService.getCombinedAccountPortfolios(targetDate);
    
    // Calculate average 12-month return for each account
    const calculateAverage12MonthReturn = (account: any): number => {
      const allModels = account.currencies.flatMap((curr: any) => curr.models);
      const returns12Month = allModels
        .map((model: any) => model.performance?.return12Month)
        .filter((ret: any) => ret !== null && ret !== undefined && !isNaN(ret));
      
      if (returns12Month.length === 0) return 0;
      return returns12Month.reduce((sum: number, ret: number) => sum + ret, 0) / returns12Month.length;
    };

    // Transform the data for the overview component
    const accountSummaries = combinedAccounts.map(account => ({
      baseAccountName: account.baseAccountName,
      currencyCount: account.currencies.length,
      totalValueAllCurrencies: account.totalValueAllCurrencies,
      totalModelCount: account.currencies.reduce((sum, curr) => sum + curr.models.length, 0),
      average12MonthReturn: calculateAverage12MonthReturn(account),
      hasChanges: account.changes?.hasChanges || false,
      changeCount: (account.changes?.addedHoldings.length || 0) + (account.changes?.removedHoldings.length || 0)
    }));

    console.log(`Retrieved ${accountSummaries.length} combined accounts`);

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      data: {
        accounts: accountSummaries,
        summary: {
          totalAccounts: accountSummaries.length,
          totalValue: accountSummaries.reduce((sum, account) => sum + account.totalValueAllCurrencies, 0),
          totalModels: accountSummaries.reduce((sum, account) => sum + account.totalModelCount, 0),
          accountsWithChanges: accountSummaries.filter(account => account.hasChanges).length,
          date: targetDate
        }
      }
    });

  } catch (error) {
    console.error('Combined accounts API error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Failed to retrieve combined accounts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}