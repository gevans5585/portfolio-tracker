import type { NextApiRequest, NextApiResponse } from 'next';
import { ModelWatchListService } from '@/lib/modelWatchListService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Getting model watch list...');

    const modelWatchListService = new ModelWatchListService();
    
    const { date } = req.query;
    const targetDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    
    const watchListData = await modelWatchListService.getModelWatchList(targetDate);
    
    console.log(`Retrieved watch list with ${watchListData.topPerformers.length} top performers`);
    console.log(`Analyzed ${watchListData.totalModelsAnalyzed} total models`);
    console.log(`Owned: ${watchListData.ownedModelsCount}, Opportunities: ${watchListData.opportunityModelsCount}`);

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      success: true,
      data: watchListData
    });

  } catch (error) {
    console.error('Model watch list API error:', error);
    return res.status(500).json({
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Failed to retrieve model watch list',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}