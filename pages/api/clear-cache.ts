import type { NextApiRequest, NextApiResponse } from 'next';
import cacheService from '@/lib/cacheService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const beforeStats = cacheService.getStats();
    
    cacheService.clearAll();
    
    const afterStats = cacheService.getStats();
    
    console.log(`Cache cleared: ${beforeStats.size} items removed`);

    return res.status(200).json({
      success: true,
      message: `Cache cleared successfully. Removed ${beforeStats.size} cached items.`,
      beforeStats,
      afterStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}