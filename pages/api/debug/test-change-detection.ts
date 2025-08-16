import type { NextApiRequest, NextApiResponse } from 'next';
import { ChangeDetectionService } from '@/lib/changeDetectionService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Testing change detection...');
    
    const { date } = req.query;
    const targetDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];

    const changeDetectionService = new ChangeDetectionService();
    
    console.log(`Testing change detection for ${targetDate}`);

    const changeAlert = await changeDetectionService.detectChanges(targetDate);
    
    console.log(`Change detection test complete:`, {
      totalChanges: changeAlert.totalChanges,
      affectedAccounts: changeAlert.affectedAccounts.length,
      changes: changeAlert.changes
    });

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: `Change detection test completed for ${targetDate}`,
      data: {
        date: targetDate,
        changeAlert,
        summary: {
          totalChanges: changeAlert.totalChanges,
          affectedAccountsCount: changeAlert.affectedAccounts.length,
          affectedAccounts: changeAlert.affectedAccounts,
          hasChanges: changeAlert.totalChanges > 0,
          changesBreakdown: changeAlert.changes.map(change => ({
            account: change.accountName,
            model: change.modelName,
            addedCount: change.addedHoldings.length,
            removedCount: change.removedHoldings.length,
            added: change.addedHoldings,
            removed: change.removedHoldings
          }))
        }
      }
    });

  } catch (error) {
    console.error('Change detection test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Change detection test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}