import type { NextApiRequest, NextApiResponse } from 'next';
import { BusinessDayUtils } from '@/lib/businessDayUtils';
import { ChangeDetectionService } from '@/lib/changeDetectionService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const testDate = req.query.date as string || today;

    console.log(`Testing business day logic for ${testDate}`);

    const testResults = {
      testDate,
      businessDayTests: {
        isTradingDay: BusinessDayUtils.isTradingDay(testDate),
        shouldSendEmail: BusinessDayUtils.shouldSendDailyEmail(testDate),
        noChangeReason: BusinessDayUtils.getNoChangeReason(testDate),
        previousTradingDay: BusinessDayUtils.isTradingDay(testDate) ? 
          BusinessDayUtils.getPreviousTradingDay(testDate) : null,
        nextTradingDay: BusinessDayUtils.getNextTradingDay(testDate),
      },
      weekExamples: {} as any,
      changeDetectionTest: {} as any
    };

    // Test a full week to show the logic
    const weekStart = new Date(testDate);
    weekStart.setDate(weekStart.getDate() - 6); // Go back 6 days to show a week
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      testResults.weekExamples[`${dayName} (${dateStr})`] = {
        isTradingDay: BusinessDayUtils.isTradingDay(dateStr),
        shouldSendEmail: BusinessDayUtils.shouldSendDailyEmail(dateStr),
        reason: BusinessDayUtils.isTradingDay(dateStr) ? 
          'Trading day' : BusinessDayUtils.getNoChangeReason(dateStr),
        previousTradingDay: BusinessDayUtils.isTradingDay(dateStr) ? 
          BusinessDayUtils.getPreviousTradingDay(dateStr) : null
      };
    }

    // Test change detection logic
    if (BusinessDayUtils.isTradingDay(testDate)) {
      try {
        const changeDetectionService = new ChangeDetectionService();
        const changeResult = await changeDetectionService.detectChanges(testDate);
        
        testResults.changeDetectionTest = {
          success: true,
          hasChanges: changeResult.hasChanges,
          totalChanges: changeResult.totalChanges,
          comparisonDate: changeResult.comparisonDate,
          message: changeResult.message,
          affectedAccounts: changeResult.affectedAccounts.length
        };
      } catch (error) {
        testResults.changeDetectionTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      testResults.changeDetectionTest = {
        skipped: true,
        reason: 'Not a trading day'
      };
    }

    // Add some upcoming trading days for reference
    const upcomingTradingDays = BusinessDayUtils.getNextTradingDays(testDate, 5);

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      testResults,
      upcomingTradingDays,
      instructions: {
        testSpecificDate: 'Add ?date=YYYY-MM-DD to test a specific date',
        examples: {
          monday: '?date=2024-12-16',
          weekend: '?date=2024-12-15', 
          holiday: '?date=2024-12-25'
        }
      }
    });

  } catch (error) {
    console.error('Business day test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}