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
    const portfolioService = new PortfolioService();
    const summary = await portfolioService.getPortfolioSummary();

    return res.status(200).json({
      ...summary,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}