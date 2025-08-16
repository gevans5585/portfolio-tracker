import { PortfolioAnalysisData, SignificantMove, UnderperformingModel } from './portfolioAnalysisService';

export interface CommentaryResponse {
  commentary: string;
  timestamp: string;
  tokensUsed?: number;
  model: string;
}

export class OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
  }

  /**
   * Generate portfolio commentary using ChatGPT-4
   */
  async generatePortfolioCommentary(analysisData: PortfolioAnalysisData): Promise<CommentaryResponse> {
    try {
      console.log('Generating portfolio commentary with ChatGPT...');

      const prompt = this.buildPrompt(analysisData);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a professional portfolio analyst with expertise in investment management and market analysis. Provide concise, actionable insights based on portfolio data.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.3, // Lower temperature for more focused, professional analysis
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      const commentary = data.choices[0].message?.content || 'Unable to generate commentary';
      const tokensUsed = data.usage?.total_tokens;

      console.log(`Portfolio commentary generated successfully (${tokensUsed} tokens used)`);

      return {
        commentary: commentary.trim(),
        timestamp: new Date().toISOString(),
        tokensUsed,
        model: data.model || 'gpt-4'
      };

    } catch (error) {
      console.error('Error generating portfolio commentary:', error);
      throw error;
    }
  }

  /**
   * Build the enhanced dual-section prompt for ChatGPT
   */
  private buildPrompt(data: PortfolioAnalysisData): string {
    const prompt = `You are a professional portfolio analyst. Analyze this portfolio data and provide structured insights in exactly 2 sections.

DAILY MOVEMENTS (TODAY):
- Models with >3% daily change: ${this.formatDailyModelMoves(data.dailyModelMoves)}
- Securities with >5% daily change: ${this.formatDailySecurityMoves(data.dailySecurityMoves)}

12-MONTH PERFORMANCE ANALYSIS:
${this.format12MonthPerformance(data.top5Performers, data.bestPerformer12Mo, data.worstPerformer12Mo)}

UNDERPERFORMING MODELS (>10% below top performers):
${this.formatUnderperformingModels(data.underperformingModels)}

TOP OPPORTUNITIES NOT OWNED:
${this.formatTopOpportunities(data.top5NotOwned)}

Format your response in exactly these 2 sections:

**DAILY DATA:**
Focus on immediate actionable items:
- Individual security alerts for holdings with large moves (>5% daily change)
- Model alerts for significant daily movements (>3% daily change)
- Any urgent actions required today

**MONTHLY TRENDS:**
Focus on longer-term strategic analysis:
- Model performance gaps vs top 5 performers  
- Whether performance gaps are narrowing or widening (1-month trends)
- Strategic rebalancing recommendations
- Top opportunities not currently owned

Use professional bullet points. Keep each section concise and actionable.`;

    return prompt;
  }

  /**
   * Format significant moves for the prompt
   */
  private formatSignificantMoves(moves: SignificantMove[]): string {
    if (moves.length === 0) {
      return 'No significant moves detected';
    }

    return moves.map(move => 
      `${move.modelName} (${move.accountName}): ${move.priceChange.toFixed(1)}% change, ` +
      `${move.valueChange.toFixed(1)}% of portfolio (${move.significance.toUpperCase()})`
    ).join('\n');
  }

  /**
   * Format daily model moves for the prompt
   */
  private formatDailyModelMoves(moves: DailyModelMove[]): string {
    if (moves.length === 0) {
      return 'No significant model movements detected';
    }

    return moves.map(move => 
      `${move.modelName} (${move.accountName}): ${move.dailyChange.toFixed(1)}% daily change (${move.significance.toUpperCase()})`
    ).join('\n');
  }

  /**
   * Format daily security moves for the prompt
   */
  private formatDailySecurityMoves(moves: DailySecurityMove[]): string {
    if (moves.length === 0) {
      return 'No significant security movements detected';
    }

    return moves.map(move => 
      `${move.securitySymbol} in ${move.modelName}: ${move.dailyChange.toFixed(1)}% daily change (${move.significance.toUpperCase()})`
    ).join('\n');
  }

  /**
   * Format 12-month performance analysis
   */
  private format12MonthPerformance(top5Performers: any[], bestPerformer12Mo: any, worstPerformer12Mo: any): string {
    let analysis = '';
    
    if (top5Performers && top5Performers.length > 0) {
      const avgReturn = top5Performers.reduce((sum, p) => sum + p.return12Month, 0) / top5Performers.length;
      analysis += `Top 5 Average: ${avgReturn.toFixed(1)}%\n`;
    }
    
    if (bestPerformer12Mo) {
      analysis += `Best: ${bestPerformer12Mo.name} (+${bestPerformer12Mo.return12Month.toFixed(1)}%)\n`;
    }
    
    if (worstPerformer12Mo) {
      analysis += `Worst: ${worstPerformer12Mo.name} (${worstPerformer12Mo.return12Month.toFixed(1)}%)`;
    }
    
    return analysis || 'Performance data unavailable';
  }

  /**
   * Format top opportunities not owned
   */
  private formatTopOpportunities(opportunities: any[]): string {
    if (opportunities.length === 0) {
      return 'All top performers are currently owned';
    }

    return opportunities.map(opp => 
      `${opp.name}: ${opp.return12Month.toFixed(1)}% 12-month return (NOT OWNED)`
    ).join('\n');
  }

  /**
   * Format underperforming models for the prompt
   */
  private formatUnderperformingModels(models: UnderperformingModel[]): string {
    if (models.length === 0) {
      return 'No significantly underperforming models detected';
    }

    return models.map(model => 
      `${model.modelName} (${model.accountName}): 12Mo: ${model.return12Month.toFixed(1)}%, ` +
      `Gap: -${model.performanceGap.toFixed(1)}%`
    ).join('\n');
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('OpenAI API connection test failed:', error);
      return false;
    }
  }
}