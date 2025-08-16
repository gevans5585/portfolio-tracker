'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CombinedAccountPortfolio, CurrencyPortfolio } from '@/lib/combinedAccountService';
import Sparkline, { generateSampleSparklineData } from '@/components/Sparkline';

interface CombinedAccountResponse {
  success: boolean;
  data: {
    account: CombinedAccountPortfolio;
    summary: {
      baseAccountName: string;
      currencyCount: number;
      totalValueAllCurrencies: number;
      totalModelCount: number;
      date: string;
      hasChanges: boolean;
      changeCount: number;
    };
  };
  error?: string;
  message?: string;
}

export default function CombinedAccountPage() {
  const params = useParams();
  const baseAccountName = decodeURIComponent(params.accountName as string);
  
  const [accountData, setAccountData] = useState<CombinedAccountResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [tradeVerificationStatus, setTradeVerificationStatus] = useState<'loading' | 'success' | 'warning' | 'error'>('loading');

  useEffect(() => {
    async function fetchAccountData() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/combined-account?account=${encodeURIComponent(baseAccountName)}`);
        const result: CombinedAccountResponse = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }
        
        if (result.success) {
          setAccountData(result.data);
          setTradeVerificationStatus('success');
        } else {
          throw new Error(result.error || 'Failed to fetch account data');
        }
      } catch (error) {
        console.error('Error fetching account data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Set verification status based on error type
        if (errorMessage.includes('ECONNRESET') || errorMessage.includes('IMAP') || errorMessage.includes('overloaded')) {
          setError('Email service temporarily overloaded. Joint accounts require more processing time. Please wait 30 seconds and try again.');
          setTradeVerificationStatus('warning');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('processing email data')) {
          setError('Request timed out. The system is processing large amounts of email data. Please wait 2-3 minutes and try again.');
          setTradeVerificationStatus('warning');
        } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          setError(`Account "${baseAccountName}" not found. It may have been recently renamed or removed.`);
          setTradeVerificationStatus('error');
        } else {
          setError(errorMessage);
          setTradeVerificationStatus('error');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAccountData();
  }, [baseAccountName]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setLoading(true);
    
    // Retry after a short delay
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/combined-account?account=${encodeURIComponent(baseAccountName)}`);
        const result: CombinedAccountResponse = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || `HTTP error! status: ${response.status}`);
        }
        
        if (result.success) {
          setAccountData(result.data);
          setRetryCount(0);
        } else {
          throw new Error(result.error || 'Failed to fetch account data');
        }
      } catch (error) {
        console.error('Retry failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }, 1000);
  };

  const formatCurrency = (amount: number, currency: 'USD' | 'CAD') => {
    const symbol = currency === 'USD' ? '$' : 'C$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateAverage12MonthReturn = (models: any[]) => {
    const returns = models
      .map(model => model.performance?.return12Month)
      .filter(ret => ret !== null && ret !== undefined && !isNaN(ret));
    
    if (returns.length === 0) return 0;
    return returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  };

  const calculateAverage1MonthReturn = (models: any[]) => {
    const returns = models
      .map(model => model.performance?.return1Month)
      .filter(ret => ret !== null && ret !== undefined && !isNaN(ret));
    
    if (returns.length === 0) return 0;
    return returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getPerformanceColor = (returnValue: number) => {
    if (returnValue >= 20) return 'text-green-600';
    if (returnValue >= 10) return 'text-green-500';
    if (returnValue >= 0) return 'text-gray-600';
    if (returnValue >= -10) return 'text-orange-500';
    return 'text-red-600';
  };

  const extractHoldingsWithPercentages = (portfolioText: string): string[] => {
    const holdings: string[] = [];
    
    if (!portfolioText) return holdings;

    // Parse holdings format like "NVDA (22%)\nAVGO (39%)\nDOW (25%)"
    const holdingMatches = portfolioText.match(/([A-Z\\.]+)\s*\((\d+%)\)/g);
    
    if (holdingMatches) {
      holdings.push(...holdingMatches.map(match => match.trim()));
    }

    return holdings;
  };

  const getTradeStatusIndicator = () => {
    switch(tradeVerificationStatus) {
      case 'loading':
        return {
          icon: '🔄',
          color: 'text-evans-secondary',
          message: 'Checking for trades...',
          subtitle: 'Verifying trade data'
        };
      case 'success':
        return {
          icon: '✓',
          color: 'text-success',
          message: accountData?.account.changes?.hasChanges ? 
            `Today's Trades (${new Date().toISOString().split('T')[0]})` : 
            `No Trades Today (${new Date().toISOString().split('T')[0]})`,
          subtitle: accountData?.account.changes?.hasChanges ? 
            `${accountData.account.changes.changeCount} changes verified` : 
            'Positions verified unchanged'
        };
      case 'warning':
        return {
          icon: '⚠️',
          color: 'text-warning',
          message: `Unable to verify trades (${new Date().toISOString().split('T')[0]})`,
          subtitle: 'System temporarily unavailable'
        };
      case 'error':
        return {
          icon: '❌',
          color: 'text-danger',
          message: `Trade data unavailable (${new Date().toISOString().split('T')[0]})`,
          subtitle: 'Data source problems'
        };
      default:
        return {
          icon: '🔄',
          color: 'text-evans-secondary',
          message: 'Checking for trades...',
          subtitle: 'Verifying trade data'
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-evans-bg flex items-center justify-center">
        <div className="card-fintech p-8 animate-fade-in">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-evans-primary"></div>
            <div className="ml-4">
              <h2 className="text-2xl font-bold text-evans-primary">Loading Account Details</h2>
              <span className="text-evans-secondary">Please wait...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-evans-bg p-6">
        <div className="max-w-4xl mx-auto">
          <div className="card-fintech p-8 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-warning" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-evans-primary mb-2">Error Loading Account</h1>
              <p className="text-evans-secondary mb-6">{error}</p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  disabled={loading || retryCount >= 3}
                  className="btn-evans ripple"
                >
                  {loading ? 'Retrying...' : `Try Again ${retryCount > 0 ? `(${retryCount}/3)` : ''}`}
                </button>
                
                <Link 
                  href="/" 
                  className="inline-flex items-center btn-evans ripple"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Portfolio Overview
                </Link>
              </div>
              
              {retryCount >= 3 && (
                <div className="mt-6 p-4 bg-evans-secondary/20 rounded-xl">
                  <p className="text-evans-primary text-sm">
                    <strong>Troubleshooting Tips:</strong>
                    <br />• Wait 2-3 minutes for the system to process email data
                    <br />• Check if the account name was recently changed
                    <br />• Try refreshing the main dashboard first
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!accountData) {
    return (
      <div className="min-h-screen bg-evans-bg p-6">
        <div className="max-w-4xl mx-auto">
          <div className="card-fintech p-8 text-center animate-fade-in">
            <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-evans-primary mb-2">Account Not Found</h1>
            <p className="text-evans-secondary mb-6">The account "{baseAccountName}" could not be found.</p>
            <Link 
              href="/" 
              className="btn-evans ripple"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { account, summary } = accountData;

  return (
    <div className="min-h-screen bg-evans-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header Card */}
        <div className="card-fintech p-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-evans-primary hover:text-evans-primary/80 mb-4 px-4 py-2 rounded-lg bg-evans-secondary/20 hover:bg-evans-secondary/30 transition-colors duration-200 border border-evans-secondary/30"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Portfolio Overview
          </Link>
          <h1 className="text-3xl font-bold text-evans-primary mb-2">{account.baseAccountName}</h1>
          <div className="flex flex-wrap gap-3">
            <span className="pill-success">
              {summary.currencyCount} {summary.currencyCount === 1 ? 'Currency' : 'Currencies'}
            </span>
            <span className="pill-success">
              {summary.totalModelCount} {summary.totalModelCount === 1 ? 'Model' : 'Models'}
            </span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              calculateAverage12MonthReturn(account.currencies.flatMap(curr => curr.models)) >= 10 ? 'bg-success text-white' :
              calculateAverage12MonthReturn(account.currencies.flatMap(curr => curr.models)) >= 0 ? 'bg-warning text-white' :
              'bg-danger text-white'
            }`}>
              Avg 12-Month Return: {formatPercentage(calculateAverage12MonthReturn(account.currencies.flatMap(curr => curr.models)))}
            </span>
          </div>
        </div>

        {/* Today's Changes */}
        {account.changes?.hasChanges && (
          <div className="card-fintech p-6 border-l-4 border-warning animate-slide-in">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-warning rounded-xl flex items-center justify-center">
                <span className="text-xl">⚡</span>
              </div>
              <h2 className="text-xl font-semibold text-evans-primary">Today's Changes</h2>
            </div>
            
            {account.changes.addedHoldings.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-success mb-2">Added Holdings (New Trades):</h3>
                <div className="flex flex-wrap gap-2">
                  {account.changes.addedHoldings.map((holding, index) => (
                    <span 
                      key={index}
                      className="pill-success"
                    >
                      {holding}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {account.changes.removedHoldings.length > 0 && (
              <div>
                <h3 className="font-medium text-danger mb-2">Removed Holdings:</h3>
                <div className="flex flex-wrap gap-2">
                  {account.changes.removedHoldings.map((holding, index) => (
                    <span 
                      key={index}
                      className="pill-danger"
                    >
                      {holding}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Currency Sections */}
        <div className="grid grid-cols-1 gap-6">
          {account.currencies.map((currencyPortfolio: CurrencyPortfolio, currIndex) => (
            <div key={currencyPortfolio.currency} className="card-fintech p-6 animate-slide-in" style={{ animationDelay: `${currIndex * 200}ms` }}>
              {/* Currency Header */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-evans-primary rounded-xl flex items-center justify-center text-xl">
                  {currencyPortfolio.currency === 'USD' ? '💵' : '🍁'}
                </div>
                <h2 className="text-2xl font-bold text-evans-primary">
                  {account.baseAccountName} ${currencyPortfolio.currency}
                </h2>
              </div>

              {/* Current Holdings */}
              <div className="bg-evans-secondary/15 border border-evans-secondary/30 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-evans-primary rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-bold">📊</span>
                    </div>
                    <h3 className="text-lg font-semibold text-evans-primary">Current Holdings</h3>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const status = getTradeStatusIndicator();
                      return (
                        <div className="flex items-center justify-end space-x-2">
                          <span className={`text-lg ${status.color}`}>{status.icon}</span>
                          <div>
                            <p className={`text-sm font-medium ${status.color}`}>
                              {status.message}
                            </p>
                            <p className="text-xs text-evans-secondary">
                              {status.subtitle}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {currencyPortfolio.models.map((model, modelIndex) => {
                    const holdingsWithPercentages = extractHoldingsWithPercentages(model.performance?.portfolio || '');
                    
                    return (
                      <div key={modelIndex} className="bg-white/80 rounded-xl p-4 shadow-sm border border-evans-secondary/20">
                        <h4 className="font-semibold text-evans-primary mb-3">{model.name}</h4>
                        
                        {holdingsWithPercentages.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {holdingsWithPercentages.map((holding, holdingIndex) => (
                              <span 
                                key={holdingIndex}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-evans-primary text-white"
                              >
                                {holding}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-evans-secondary text-sm italic">No detailed holdings available</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Portfolio Summary */}
              <div className="bg-evans-secondary/10 rounded-xl p-6 mb-6 border border-evans-secondary/20">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-8 h-8 bg-evans-secondary rounded-lg flex items-center justify-center">
                    <span className="text-evans-primary text-sm font-bold">📈</span>
                  </div>
                  <h3 className="text-lg font-semibold text-evans-primary">Portfolio Summary</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-white/80 rounded-xl p-4 text-center border border-evans-secondary/20">
                    <p className={`text-2xl font-bold mb-1 ${getPerformanceColor(calculateAverage12MonthReturn(currencyPortfolio.models))}`}>
                      {formatPercentage(calculateAverage12MonthReturn(currencyPortfolio.models))}
                    </p>
                    <p className="text-evans-secondary text-sm font-medium">Avg 12-Month Return</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-4 text-center border border-evans-secondary/20">
                    <p className="text-2xl font-bold text-evans-primary mb-1">{currencyPortfolio.models.length}</p>
                    <p className="text-evans-secondary text-sm font-medium">Models</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-4 text-center border border-evans-secondary/20">
                    <p className="text-2xl font-bold text-evans-primary mb-1">
                      {currencyPortfolio.models.reduce((sum, model) => sum + (model.performance?.tradesYTD || 0), 0)}
                    </p>
                    <p className="text-evans-secondary text-sm font-medium">Trades YTD</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-4 text-center border border-evans-secondary/20">
                    <p className={`text-2xl font-bold mb-1 ${getPerformanceColor(calculateAverage1MonthReturn(currencyPortfolio.models))}`}>
                      {formatPercentage(calculateAverage1MonthReturn(currencyPortfolio.models))}
                    </p>
                    <p className="text-evans-secondary text-sm font-medium">Avg Return 1MO</p>
                  </div>
                </div>
              </div>

              {/* Detailed Performance Metrics */}
              <div className="bg-white/60 rounded-xl border border-evans-secondary/20 overflow-hidden">
                <div className="p-6 border-b border-evans-secondary/20">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-evans-primary rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-bold">📋</span>
                    </div>
                    <h3 className="text-lg font-semibold text-evans-primary">Performance Metrics</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-evans-primary">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Model</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Final Equity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Return YTD</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Return 1Mo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Return 12Mo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Trend</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Sharpe</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Max DD</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Trades YTD</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/80 divide-y divide-evans-secondary/20">
                      {currencyPortfolio.models.map((model, index) => (
                        <tr key={index} className={`hover:bg-evans-secondary/10 transition-colors duration-200 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-evans-secondary/5'
                        }`}>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-evans-primary">{model.name}</div>
                            <div className="text-sm text-evans-secondary">{model.symbol}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-evans-primary">
                            {formatCurrency(model.performance?.finalEquity || 0, currencyPortfolio.currency)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                              (model.performance?.returnYTD || 0) >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                            }`}>
                              {(model.performance?.returnYTD || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                              (model.performance?.return1Month || 0) >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                            }`}>
                              {(model.performance?.return1Month || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`text-lg font-bold px-3 py-1 rounded-full ${
                              (model.performance?.return12Month || 0) >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                            }`}>
                              {(model.performance?.return12Month || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center">
                              <Sparkline
                                data={generateSampleSparklineData(model.performance?.return12Month || 0)}
                                color={(model.performance?.return12Month || 0) >= 0 ? '#28A745' : '#DC3545'}
                                width={80}
                                height={32}
                                className="opacity-80"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-evans-primary">
                            {(model.performance?.sharpeRatio || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-danger">
                              {(model.performance?.maxDrawdown || 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-evans-primary">
                            {model.performance?.tradesYTD || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="card-fintech p-4 text-center animate-fade-in">
          <p className="text-evans-secondary text-sm">
            Portfolio data as of {account.date} • Evans Family Wealth
          </p>
        </div>
      </div>
    </div>
  );
}