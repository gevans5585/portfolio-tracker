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
    console.log('Testing portfolio filtering with mock data...');
    const emailParser = new EmailParser();
    
    // Mock portfolio models from Column A (like you described)
    const mockAllowedModels = [
      '1. Glen S&P 100',
      '3. Glen Best of Best Funds', 
      'Conservative Growth',
      'Balanced Portfolio',
      'Growth Equity'
    ];
    
    // Mock HTML email content with a table containing various holdings
    const mockHtmlContent = `
      <html>
        <body>
          <h1>Daily Portfolio Report</h1>
          <table>
            <tr>
              <th>Name</th>
              <th>Symbol</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Value</th>
              <th>Day Change</th>
            </tr>
            <tr>
              <td>1. Glen S&P 100</td>
              <td>GLEN100</td>
              <td>100</td>
              <td>$150.00</td>
              <td>$15,000.00</td>
              <td>+$200.00</td>
            </tr>
            <tr>
              <td>Random Fund Not In Sheet</td>
              <td>RANDOM</td>
              <td>50</td>
              <td>$100.00</td>
              <td>$5,000.00</td>
              <td>+$50.00</td>
            </tr>
            <tr>
              <td>3. Glen Best of Best Funds</td>
              <td>GLENBEST</td>
              <td>75</td>
              <td>$200.00</td>
              <td>$15,000.00</td>
              <td>+$150.00</td>
            </tr>
            <tr>
              <td>Another Unwanted Fund</td>
              <td>UNWANTED</td>
              <td>25</td>
              <td>$80.00</td>
              <td>$2,000.00</td>
              <td>-$25.00</td>
            </tr>
            <tr>
              <td>Conservative Growth</td>
              <td>CONSEQ</td>
              <td>200</td>
              <td>$50.00</td>
              <td>$10,000.00</td>
              <td>+$100.00</td>
            </tr>
          </table>
        </body>
      </html>
    `;
    
    console.log(`Testing with ${mockAllowedModels.length} allowed models:`, mockAllowedModels);
    
    // Test the filtered parsing
    const parsedDataArray = emailParser.parseFilteredPortfolioEmail(
      mockHtmlContent,
      'Daily Portfolio Report',
      new Date().toISOString(),
      mockAllowedModels
    );
    
    console.log(`Parsed ${parsedDataArray.length} portfolio data objects`);
    
    // Calculate results
    const totalHoldingsBeforeFilter = 5; // From the mock HTML table
    const totalHoldingsAfterFilter = parsedDataArray.reduce((sum, pd) => sum + pd.holdings.length, 0);
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: 'Successfully tested portfolio filtering with mock data',
      results: {
        mockAllowedModels,
        totalHoldingsBeforeFilter,
        totalHoldingsAfterFilter,
        portfolioDataObjects: parsedDataArray.length,
        filteredPortfolios: parsedDataArray.map(portfolio => ({
          accountName: portfolio.accountName,
          accountNumber: portfolio.accountNumber,
          holdingsCount: portfolio.holdings.length,
          totalValue: portfolio.totalValue,
          dayChange: portfolio.dayChange,
          dayChangePercent: portfolio.dayChangePercent,
          holdings: portfolio.holdings.map(holding => ({
            symbol: holding.symbol,
            name: holding.name,
            quantity: holding.quantity,
            price: holding.price,
            value: holding.value,
            dayChange: holding.dayChange,
            dayChangePercent: holding.dayChangePercent
          }))
        })),
        filteringWorking: totalHoldingsAfterFilter < totalHoldingsBeforeFilter,
        explanation: `Original table had ${totalHoldingsBeforeFilter} holdings, but only ${totalHoldingsAfterFilter} matched the allowed models from Column A`
      }
    });

  } catch (error) {
    console.error('Mock filtering test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Mock filtering test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}