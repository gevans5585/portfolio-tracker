import type { NextApiRequest, NextApiResponse } from 'next';
import { testChangeDetectionFix } from '@/lib/testChangeDetection';
import cacheService from '@/lib/cacheService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('🧪 Testing Change Detection Fix...');
    
    // Clear cache to ensure fresh data
    cacheService.clearAll();
    console.log('🗑️ Cache cleared');
    
    // Run the test
    await testChangeDetectionFix();
    
    console.log('✅ Change detection test completed');

    return res.status(200).json({
      success: true,
      message: 'Change detection test completed. Check server console for detailed results.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Change detection test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Change detection test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}