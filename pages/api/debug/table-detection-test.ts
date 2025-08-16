import type { NextApiRequest, NextApiResponse } from 'next';
import { EmailParser } from '@/lib/emailParser';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Testing table detection logic...');
    
    const emailParser = new EmailParser();
    
    // Test headers from the actual email
    const testHeaders = [
      'name', 'final equity', 'pr. win', 'ret. ytd', 'ret. 1mo', 'ret. 3mo', 
      'ret. 6mo', 'ret. 12mo', 'trades ytd', 'max dd', 'cur dd', 'sharpe', 
      'cagr', 'std(26)', 'portfolio', 'ml accuracies'
    ];
    
    const headerText = testHeaders.join(' ');
    console.log('Header text:', headerText);
    
    // Test isHoldingsTable
    const isHoldings = (emailParser as any).isHoldingsTable(headerText);
    console.log('isHoldingsTable result:', isHoldings);
    
    // Test isPortfolioPerformanceTable  
    const isPerformance = (emailParser as any).isPortfolioPerformanceTable(headerText);
    console.log('isPortfolioPerformanceTable result:', isPerformance);
    
    // Test individual keyword matches
    const performanceKeywords = ['final equity', 'ret. ytd', 'ret. 1mo', 'sharpe', 'cagr', 'portfolio', 'name'];
    const keywordMatches = {};
    let matchCount = 0;
    
    for (const keyword of performanceKeywords) {
      const matches = headerText.includes(keyword);
      keywordMatches[keyword] = matches;
      if (matches) matchCount++;
      console.log(`Keyword "${keyword}": ${matches}`);
    }
    
    console.log(`Total matches: ${matchCount} (need >=3 for performance table)`);
    
    // Test holdings keywords
    const holdingsKeywords = ['symbol', 'quantity', 'price', 'value', 'shares', 'position', 'market value'];
    const holdingsMatches = {};
    let holdingsMatchCount = 0;
    
    for (const keyword of holdingsKeywords) {
      const matches = headerText.includes(keyword);
      holdingsMatches[keyword] = matches;
      if (matches) holdingsMatchCount++;
      console.log(`Holdings keyword "${keyword}": ${matches}`);
    }
    
    console.log(`Holdings matches: ${holdingsMatchCount}`);

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Table detection test completed',
      data: {
        headerText,
        testHeaders,
        results: {
          isHoldingsTable: isHoldings,
          isPortfolioPerformanceTable: isPerformance,
          shouldBeRecognized: isHoldings || isPerformance
        },
        keywordAnalysis: {
          performanceKeywords: keywordMatches,
          performanceMatchCount: matchCount,
          performanceThreshold: 3,
          holdingsKeywords: holdingsMatches,
          holdingsMatchCount: holdingsMatchCount
        }
      }
    });

  } catch (error) {
    console.error('Table detection test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Table detection test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}