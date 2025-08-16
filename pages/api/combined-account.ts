import type { NextApiRequest, NextApiResponse } from 'next';
import { CombinedAccountService } from '@/lib/combinedAccountService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { account, date } = req.query;
  
  try {
    
    if (!account) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameter: account' 
      });
    }

    console.log(`Getting combined portfolio for account: ${account}`);

    const combinedAccountService = new CombinedAccountService();
    
    const targetDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    const combinedAccount = await combinedAccountService.getCombinedAccountByName(account as string, targetDate);
    
    if (!combinedAccount) {
      return res.status(404).json({ 
        success: false, 
        error: `Account not found: ${account}` 
      });
    }

    // Create summary data
    const summary = {
      baseAccountName: combinedAccount.baseAccountName,
      currencyCount: combinedAccount.currencies.length,
      totalValueAllCurrencies: combinedAccount.totalValueAllCurrencies,
      totalModelCount: combinedAccount.currencies.reduce((sum, curr) => sum + curr.models.length, 0),
      date: combinedAccount.date,
      hasChanges: combinedAccount.changes?.hasChanges || false,
      changeCount: (combinedAccount.changes?.addedHoldings.length || 0) + (combinedAccount.changes?.removedHoldings.length || 0)
    };

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      data: {
        account: combinedAccount,
        summary
      }
    });

  } catch (error) {
    console.error('Combined account API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide specific error messages for common issues
    let userFriendlyMessage = 'Failed to retrieve combined account portfolio';
    let statusCode = 500;
    
    if (errorMessage.includes('ECONNRESET') || errorMessage.includes('IMAP')) {
      userFriendlyMessage = 'Email service temporarily overloaded. Please wait a moment and try again.';
      statusCode = 503; // Service Unavailable
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      userFriendlyMessage = 'Request timed out. The system is processing email data. Please try again in a few minutes.';
      statusCode = 504; // Gateway Timeout
    } else if (errorMessage.includes('not found')) {
      userFriendlyMessage = `Account "${account}" not found. Please check the account name.`;
      statusCode = 404;
    }
    
    return res.status(statusCode).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: userFriendlyMessage,
      message: errorMessage,
      retryable: statusCode >= 500 && statusCode < 600
    });
  }
}