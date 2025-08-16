'use client';

import { useState, useEffect } from 'react';
import Sparkline, { generateSampleSparklineData } from './Sparkline';

interface CommentaryData {
  commentary: string;
  analysisData: {
    totalValue: number;
    totalModels: number;
    significantMovesCount: number;
    underperformersCount: number;
    dailyModelMovesCount: number;
    dailySecurityMovesCount: number;
    bestPerformer12Mo: { name: string; return12Month: number } | null;
    worstPerformer12Mo: { name: string; return12Month: number } | null;
  };
  metadata: {
    timestamp: string;
    tokensUsed?: number;
    model: string;
    date: string;
  };
}

interface CommentaryResponse {
  success: boolean;
  data: CommentaryData;
  fromCache?: boolean;
  message?: string;
  retryable?: boolean;
}

export default function PortfolioCommentary() {
  const [commentaryData, setCommentaryData] = useState<CommentaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trendsExpanded, setTrendsExpanded] = useState(false);

  useEffect(() => {
    fetchCommentary();
  }, []);

  const fetchCommentary = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const url = refresh ? '/api/portfolio-commentary?refresh=true' : '/api/portfolio-commentary';
      const response = await fetch(url);
      const result: CommentaryResponse = await response.json();

      if (result.success) {
        setCommentaryData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch portfolio commentary');
      }
    } catch (err) {
      console.error('Error fetching portfolio commentary:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Provide helpful error messages
      if (errorMessage.includes('OpenAI API key')) {
        setError('AI Commentary requires OpenAI API key configuration. Please add OPENAI_API_KEY to your environment variables.');
      } else if (errorMessage.includes('OpenAI service')) {
        setError('AI service temporarily unavailable. Please try again in a few minutes.');
      } else if (errorMessage.includes('overloaded') || errorMessage.includes('IMAP')) {
        setError('Portfolio data is loading. AI commentary will be available once data processing completes.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchCommentary(true);
  };

  const parseCommentarysections = (commentary: string): { dailyData: string[], monthlyTrends: string[] } => {
    const sections: { dailyData: string[], monthlyTrends: string[] } = { dailyData: [], monthlyTrends: [] };
    
    // Split commentary by the section headers
    const dailyDataMatch = commentary.match(/\*\*DAILY DATA:\*\*([\s\S]*?)(?=\*\*MONTHLY TRENDS:\*\*|$)/);
    const monthlyTrendsMatch = commentary.match(/\*\*MONTHLY TRENDS:\*\*([\s\S]*?)$/);
    
    if (dailyDataMatch) {
      sections.dailyData = dailyDataMatch[1]
        .split('\n')
        .filter(line => line.trim().length > 0 && !line.includes('Focus on'))
        .map(line => line.trim().replace(/^-\s*/, ''));
    }
    
    if (monthlyTrendsMatch) {
      sections.monthlyTrends = monthlyTrendsMatch[1]
        .split('\n')
        .filter(line => line.trim().length > 0 && !line.includes('Focus on'))
        .map(line => line.trim().replace(/^-\s*/, ''));
    }
    
    // Fallback: if sections not properly formatted, treat as single section
    if (sections.dailyData.length === 0 && sections.monthlyTrends.length === 0) {
      const allLines = commentary
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.trim().replace(/^-\s*/, ''));
      
      // Put first half in dailyData, second half in monthlyTrends
      const midpoint = Math.ceil(allLines.length / 2);
      sections.dailyData = allLines.slice(0, midpoint);
      sections.monthlyTrends = allLines.slice(midpoint);
    }
    
    return sections;
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="card-fintech p-8 animate-fade-in">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-evans-primary"></div>
          <div className="ml-4">
            <h2 className="text-2xl font-bold text-evans-primary">AI Portfolio Commentary</h2>
            <span className="text-evans-secondary">Analyzing your portfolio performance...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-fintech p-8 animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-warning" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-evans-primary mb-2">AI Commentary Unavailable</h2>
          <p className="text-evans-secondary mb-6">{error}</p>
          <button
            onClick={() => fetchCommentary()}
            className="btn-evans ripple"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!commentaryData) {
    return (
      <div className="card-fintech p-8 animate-fade-in text-center">
        <h2 className="text-2xl font-bold text-evans-primary mb-2">AI Portfolio Commentary</h2>
        <p className="text-evans-secondary">No commentary data available.</p>
      </div>
    );
  }

  const { commentary, analysisData, metadata } = commentaryData;
  const sections = parseCommentarysections(commentary);

  // Extract top 3 insights for hero display
  const getTopInsights = (): string[] => {
    const allInsights = [...sections.dailyData, ...sections.monthlyTrends];
    return allInsights.slice(0, 3);
  };

  const topInsights = getTopInsights();

  return (
    <div className="space-y-6">
      {/* Hero Card - AI Portfolio Commentary */}
      <div className="card-fintech p-8 relative overflow-hidden animate-fade-in">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-evans-primary/5 to-blue-50/30"></div>
        
        {/* Header */}
        <div className="relative z-10 flex justify-between items-start mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-evans-primary rounded-xl flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-evans-primary mb-1">
                AI Portfolio Commentary
              </h2>
              <p className="text-evans-secondary text-sm">
                Generated by {metadata.model} • {new Date(metadata.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-evans ripple flex items-center space-x-2"
          >
            {refreshing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Refreshing</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </>
            )}
          </button>
        </div>

        {/* Key Insights - Hero Format */}
        <div className="relative z-10 space-y-4 mb-8">
          <h3 className="text-xl font-semibold text-evans-primary mb-4">Key Insights</h3>
          {topInsights.map((insight, index) => (
            <div key={index} className="flex items-start space-x-4 p-4 bg-white/80 rounded-xl">
              <div className="flex-shrink-0 w-8 h-8 bg-evans-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
                {index + 1}
              </div>
              <p className="text-evans-primary text-base leading-relaxed font-medium">
                {insight}
              </p>
            </div>
          ))}
          {topInsights.length === 0 && (
            <div className="text-center py-6">
              <p className="text-evans-secondary italic">No insights available at this time.</p>
            </div>
          )}
        </div>

        {/* Performance Highlights */}
        {(analysisData.bestPerformer12Mo || analysisData.worstPerformer12Mo) && (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysisData.bestPerformer12Mo && (
              <div className="bg-white/90 rounded-xl p-4 border-l-4 border-success">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">🏆</span>
                    <h4 className="font-semibold text-evans-primary">Top Performer</h4>
                  </div>
                  <Sparkline
                    data={generateSampleSparklineData(analysisData.bestPerformer12Mo.return12Month)}
                    color="#28A745"
                    width={50}
                    height={20}
                    className="opacity-70"
                  />
                </div>
                <p className="text-evans-secondary text-sm mb-1">{analysisData.bestPerformer12Mo.name}</p>
                <p className="text-2xl font-bold text-success">
                  +{analysisData.bestPerformer12Mo.return12Month.toFixed(1)}%
                </p>
                <p className="text-xs text-evans-secondary">12-month return</p>
              </div>
            )}
            
            {analysisData.worstPerformer12Mo && (
              <div className="bg-white/90 rounded-xl p-4 border-l-4 border-danger">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">⚠️</span>
                    <h4 className="font-semibold text-evans-primary">Needs Attention</h4>
                  </div>
                  <Sparkline
                    data={generateSampleSparklineData(analysisData.worstPerformer12Mo.return12Month)}
                    color="#DC3545"
                    width={50}
                    height={20}
                    className="opacity-70"
                  />
                </div>
                <p className="text-evans-secondary text-sm mb-1">{analysisData.worstPerformer12Mo.name}</p>
                <p className="text-2xl font-bold text-danger">
                  {analysisData.worstPerformer12Mo.return12Month.toFixed(1)}%
                </p>
                <p className="text-xs text-evans-secondary">12-month return</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Monthly Trends - Collapsible Accordion */}
      {sections.monthlyTrends.length > 0 && (
        <div className="card-fintech overflow-hidden animate-fade-in">
          <button
            onClick={() => setTrendsExpanded(!trendsExpanded)}
            className="accordion-header w-full text-left"
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">📊</span>
              <div>
                <h3 className="text-lg font-semibold text-evans-primary">Monthly Trends</h3>
                <p className="text-sm text-evans-secondary">Detailed market analysis and patterns</p>
              </div>
            </div>
            <svg 
              className={`w-5 h-5 text-evans-secondary transform transition-transform ${trendsExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div className={`accordion-content ${trendsExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="px-6 pb-6 space-y-3">
              {sections.monthlyTrends.map((trend, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-evans-bg rounded-lg">
                  <div className="flex-shrink-0 w-2 h-2 bg-evans-primary rounded-full mt-2"></div>
                  <p className="text-evans-primary text-sm leading-relaxed">{trend}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}