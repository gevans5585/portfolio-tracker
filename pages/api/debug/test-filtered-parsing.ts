import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioService } from '@/lib/portfolioService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Testing filtered portfolio parsing workflow...');
    const portfolioService = new PortfolioService();
    
    // Test the complete filtered workflow
    console.log('Getting latest portfolio data with model filtering...');
    const portfolioData = await portfolioService.getLatestPortfolioData();
    console.log(`Received ${portfolioData.length} filtered portfolio data objects`);
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      message: `Successfully parsed and filtered portfolio data`,
      results: {
        totalAccounts: portfolioData.length,
        portfolios: portfolioData.map(portfolio => ({
          accountName: portfolio.accountName,
          accountNumber: portfolio.accountNumber,
          holdingsCount: portfolio.holdings.length,
          totalValue: portfolio.totalValue,
          dayChange: portfolio.dayChange,
          dayChangePercent: portfolio.dayChangePercent,
          date: portfolio.date,
          holdings: portfolio.holdings.map(holding => ({
            symbol: holding.symbol,
            name: holding.name,
            quantity: holding.quantity,
            price: holding.price,
            value: holding.value,
            dayChange: holding.dayChange,
            dayChangePercent: holding.dayChangePercent
          }))
        }))
      }
    });

  } catch (error) {
    console.error('Filtered parsing test error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Filtered parsing test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}