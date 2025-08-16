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
    console.log('Getting all accounts...');
    const service = new AccountPortfolioService();
    
    const accounts = await service.getUniqueAccounts();
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Successfully retrieved accounts',
      data: {
        accounts,
        count: accounts.length
      }
    });

  } catch (error) {
    console.error('Accounts API error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Failed to retrieve accounts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}