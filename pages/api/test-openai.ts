import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIService } from '@/lib/openAIService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Testing OpenAI API connection...');

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured',
        message: 'Please add OPENAI_API_KEY to your environment variables.',
        instructions: 'Add OPENAI_API_KEY=your_api_key_here to your .env.local file'
      });
    }

    // Test basic connection
    const openAIService = new OpenAIService();
    const connectionTest = await openAIService.testConnection();
    
    if (!connectionTest) {
      return res.status(502).json({
        success: false,
        error: 'OpenAI API connection failed',
        message: 'Could not connect to OpenAI API. Please check your API key.'
      });
    }

    // Test with sample portfolio data
    const sampleAnalysisData = {
      totalValue: 1500000,
      totalModels: 8,
      currentDate: new Date().toISOString().split('T')[0],
      modelPerformanceData: 'Sample Model A: YTD: 12.5%, 12Mo: 18.3%, Value: $250,000\nSample Model B: YTD: -2.1%, 12Mo: 8.7%, Value: $180,000',
      top5Performers: [
        { name: 'Top Performer 1', return12Month: 25.5, isOwned: true, symbol: 'TP1', returnYTD: 15.2, finalEquity: 100000, sharpeRatio: 1.8, maxDrawdown: -8.5, portfolio: '' },
        { name: 'Top Performer 2', return12Month: 22.1, isOwned: false, symbol: 'TP2', returnYTD: 18.7, finalEquity: 120000, sharpeRatio: 1.6, maxDrawdown: -12.3, portfolio: '' }
      ],
      top5NotOwned: [
        { name: 'Top Performer 2', return12Month: 22.1, isOwned: false, symbol: 'TP2', returnYTD: 18.7, finalEquity: 120000, sharpeRatio: 1.6, maxDrawdown: -12.3, portfolio: '' }
      ],
      significantMoves: [],
      dailyModelMoves: [
        { modelName: 'Aggressive Growth', accountName: 'Joint Account', dailyChange: 4.2, significance: 'medium' as const }
      ],
      dailySecurityMoves: [
        { securitySymbol: 'AAPL', dailyChange: -6.1, modelName: 'Tech Focus', accountName: 'RRSP', significance: 'high' as const }
      ],
      underperformingModels: [],
      bestPerformer12Mo: { name: 'Best 12Mo Model', return12Month: 25.5 },
      worstPerformer12Mo: { name: 'Worst 12Mo Model', return12Month: 3.2 }
    };

    const commentary = await openAIService.generatePortfolioCommentary(sampleAnalysisData);

    return res.status(200).json({
      success: true,
      message: 'OpenAI integration test successful',
      data: {
        connectionTest: true,
        sampleCommentary: commentary.commentary,
        tokensUsed: commentary.tokensUsed,
        model: commentary.model
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OpenAI test failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    let userFriendlyMessage = 'OpenAI API test failed';
    let instructions = '';

    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      userFriendlyMessage = 'Invalid OpenAI API key';
      instructions = 'Please check that your OPENAI_API_KEY is correct and has sufficient credits.';
    } else if (errorMessage.includes('429')) {
      userFriendlyMessage = 'OpenAI API rate limit exceeded';
      instructions = 'Please wait a moment and try again, or check your OpenAI account usage.';
    } else if (errorMessage.includes('quota')) {
      userFriendlyMessage = 'OpenAI API quota exceeded';
      instructions = 'Please check your OpenAI account billing and usage limits.';
    }

    return res.status(500).json({
      success: false,
      error: userFriendlyMessage,
      message: errorMessage,
      instructions,
      timestamp: new Date().toISOString()
    });
  }
}