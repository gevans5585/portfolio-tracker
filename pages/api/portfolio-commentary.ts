import type { NextApiRequest, NextApiResponse } from 'next';
import { PortfolioAnalysisService } from '@/lib/portfolioAnalysisService';
import { OpenAIService } from '@/lib/openAIService';
import cacheService from '@/lib/cacheService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Generating AI portfolio commentary...');

    const { date, refresh } = req.query;
    const targetDate = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];
    
    // Check cache first (unless refresh requested)
    const cacheKey = `portfolio-commentary-${targetDate}`;
    if (req.method === 'GET' && !refresh) {
      const cachedCommentary = cacheService.get(cacheKey);
      if (cachedCommentary) {
        console.log('Returning cached portfolio commentary');
        return res.status(200).json({
          success: true,
          data: cachedCommentary,
          fromCache: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured',
        message: 'Please add OPENAI_API_KEY to your environment variables to enable AI commentary.'
      });
    }

    // Generate portfolio analysis
    const analysisService = new PortfolioAnalysisService();
    const analysisData = await analysisService.generateAnalysisData(targetDate);

    // Generate AI commentary
    const openAIService = new OpenAIService();
    const commentaryResponse = await openAIService.generatePortfolioCommentary(analysisData);

    // Prepare response data
    const responseData = {
      commentary: commentaryResponse.commentary,
      analysisData: {
        totalValue: analysisData.totalValue,
        totalModels: analysisData.totalModels,
        significantMovesCount: analysisData.significantMoves.length,
        underperformersCount: analysisData.underperformingModels.length,
        dailyModelMovesCount: analysisData.dailyModelMoves.length,
        dailySecurityMovesCount: analysisData.dailySecurityMoves.length,
        top5PerformersOwned: analysisData.top5Performers.filter(p => p.isOwned).length,
        bestPerformer12Mo: analysisData.bestPerformer12Mo,
        worstPerformer12Mo: analysisData.worstPerformer12Mo
      },
      metadata: {
        timestamp: commentaryResponse.timestamp,
        tokensUsed: commentaryResponse.tokensUsed,
        model: commentaryResponse.model,
        date: targetDate
      }
    };

    // Cache the result (30 minutes TTL)
    cacheService.set(cacheKey, responseData, 30 * 60 * 1000);

    console.log(`AI portfolio commentary generated successfully for ${targetDate}`);
    console.log(`Analysis: ${analysisData.totalModels} models, $${analysisData.totalValue.toLocaleString()} total value`);
    console.log(`Insights: ${analysisData.significantMoves.length} significant moves, ${analysisData.underperformingModels.length} underperformers`);

    return res.status(200).json({
      success: true,
      data: responseData,
      fromCache: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Portfolio commentary API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let statusCode = 500;
    let userFriendlyMessage = 'Failed to generate portfolio commentary';

    // Handle specific error types
    if (errorMessage.includes('OPENAI_API_KEY')) {
      statusCode = 500;
      userFriendlyMessage = 'OpenAI API key not configured';
    } else if (errorMessage.includes('OpenAI API error')) {
      statusCode = 502;
      userFriendlyMessage = 'OpenAI service temporarily unavailable';
    } else if (errorMessage.includes('ECONNRESET') || errorMessage.includes('IMAP')) {
      statusCode = 503;
      userFriendlyMessage = 'Email service temporarily overloaded. Please try again in a moment.';
    } else if (errorMessage.includes('timeout')) {
      statusCode = 504;
      userFriendlyMessage = 'Request timed out. Please try again.';
    }

    return res.status(statusCode).json({
      success: false,
      error: userFriendlyMessage,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      retryable: statusCode >= 500 && statusCode < 600
    });
  }
}