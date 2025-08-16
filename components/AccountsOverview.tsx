'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sparkline, { generateSampleSparklineData } from './Sparkline';

interface CombinedAccount {
  baseAccountName: string;
  currencyCount: number;
  totalValueAllCurrencies: number;
  totalModelCount: number;
  average12MonthReturn: number;
  hasChanges: boolean;
  changeCount: number;
}

interface CombinedAccountsResponse {
  success: boolean;
  data: {
    accounts: CombinedAccount[];
  };
  message?: string;
}

export default function AccountsOverview() {
  const [accounts, setAccounts] = useState<CombinedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for cached data first
    const cachedData = sessionStorage.getItem('portfolioAccountsCache');
    const cachedTimestamp = sessionStorage.getItem('portfolioAccountsCacheTimestamp');
    
    if (cachedData && cachedTimestamp) {
      const cacheAge = Date.now() - parseInt(cachedTimestamp);
      const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
      
      if (cacheAge < CACHE_DURATION) {
        // Use cached data
        console.log('Using cached portfolio accounts data');
        setAccounts(JSON.parse(cachedData));
        setLoading(false);
        return;
      }
    }
    
    // Fetch fresh data if no valid cache
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/combined-accounts');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: CombinedAccountsResponse = await response.json();
      
      if (data.success) {
        setAccounts(data.data.accounts);
        
        // Cache the successful data
        sessionStorage.setItem('portfolioAccountsCache', JSON.stringify(data.data.accounts));
        sessionStorage.setItem('portfolioAccountsCacheTimestamp', Date.now().toString());
        console.log('Portfolio accounts data cached successfully');
      } else {
        throw new Error(data.message || 'Failed to fetch accounts');
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Provide more helpful error messages
      if (errorMessage.includes('timeout') || errorMessage.includes('EADDRINUSE')) {
        setError('The system is processing email data. This may take 2-3 minutes on first load.');
      } else if (errorMessage.includes('IMAP') || errorMessage.includes('gmail')) {
        setError('Email service temporarily unavailable. Please try again in a few minutes.');
      } else if (errorMessage.includes('HTTP 500')) {
        setError('Server error. Please wait a moment and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshAccounts = async () => {
    // Clear cache and fetch fresh data
    sessionStorage.removeItem('portfolioAccountsCache');
    sessionStorage.removeItem('portfolioAccountsCacheTimestamp');
    console.log('Portfolio cache cleared - fetching fresh data');
    await fetchAccounts();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const groupAccountsByType = (accounts: CombinedAccount[]) => {
    const grouped = {
      RRSP: [] as CombinedAccount[],
      TFSA: [] as CombinedAccount[],
      Joint: [] as CombinedAccount[]
    };

    accounts.forEach(account => {
      if (account.baseAccountName.includes('RRSP')) {
        grouped.RRSP.push(account);
      } else if (account.baseAccountName.includes('TFSA')) {
        grouped.TFSA.push(account);
      } else if (account.baseAccountName.includes('Joint')) {
        grouped.Joint.push(account);
      }
    });

    return grouped;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading accounts</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={refreshAccounts}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const groupedAccounts = groupAccountsByType(accounts);
  const totalAccounts = accounts.length;
  const totalValue = accounts.reduce((sum, account) => sum + account.totalValueAllCurrencies, 0);
  const accountsWithChanges = accounts.filter(account => account.hasChanges).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header with refresh option */}
      {accounts.length > 0 && (
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-evans-primary">Portfolio Overview</h1>
            <p className="text-evans-secondary mt-1">Your investment accounts and performance</p>
          </div>
          <button
            onClick={refreshAccounts}
            className="btn-evans ripple flex items-center space-x-2"
            title="Refresh portfolio data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      )}
      
      {/* Account Groups - Fintech Card Grid */}
      {Object.entries(groupedAccounts).map(([accountType, accountList], groupIndex) => {
        if (accountList.length === 0) return null;
        
        // Get account type icon
        const getAccountIcon = (type: string) => {
          switch(type) {
            case 'RRSP': return '🏦';
            case 'TFSA': return '💎';
            case 'Joint': return '🤝';
            default: return '💼';
          }
        };
        
        return (
          <div key={accountType} className="space-y-6 animate-slide-in" style={{ animationDelay: `${groupIndex * 100}ms` }}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-evans-primary rounded-xl flex items-center justify-center text-xl">
                {getAccountIcon(accountType)}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-evans-primary">
                  {accountType} Accounts
                </h2>
                <p className="text-evans-secondary text-sm">{accountList.length} accounts</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accountList.map((account, index) => {
                const performanceClass = account.average12MonthReturn >= 15 ? 'animate-pulse-success' : 
                                       account.average12MonthReturn < 0 ? 'animate-pulse-danger' : '';
                
                return (
                  <Link
                    key={account.baseAccountName}
                    href={`/account/${encodeURIComponent(account.baseAccountName)}`}
                    className="block group animate-fade-in"
                    style={{ animationDelay: `${(groupIndex * 3 + index) * 150}ms` }}
                  >
                    <div className={`card-fintech p-6 relative overflow-hidden ${performanceClass}`}>
                      {/* Performance Gradient Overlay */}
                      <div className={`absolute inset-0 opacity-10 ${
                        account.average12MonthReturn >= 15 ? 'bg-evans-primary' :
                        account.average12MonthReturn >= 5 ? 'bg-evans-secondary' :
                        account.average12MonthReturn < 0 ? 'bg-evans-primary' : 'bg-evans-secondary'
                      }`}></div>
                      
                      {/* Change Indicator */}
                      {account.hasChanges && (
                        <div className="absolute top-4 right-4">
                          <span className="pill-danger">
                            {account.changeCount} changes
                          </span>
                        </div>
                      )}
                      
                      <div className="relative z-10">
                        {/* Account Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-evans-primary group-hover:text-evans-primary/80 transition-colors">
                              {account.baseAccountName}
                            </h3>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-sm text-evans-primary flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                                {account.currencyCount} {account.currencyCount === 1 ? 'Currency' : 'Currencies'}
                              </span>
                              <span className="text-sm text-evans-primary flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                {account.totalModelCount} {account.totalModelCount === 1 ? 'Model' : 'Models'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Performance Section */}
                        <div className="bg-evans-secondary/20 rounded-xl p-4 mb-4 border border-evans-secondary/30">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-evans-primary">12-Month Return</span>
                            <div className="flex items-center space-x-2">
                              <span className={`text-2xl font-bold ${getPerformanceColor(account.average12MonthReturn)}`}>
                                {formatPercentage(account.average12MonthReturn)}
                              </span>
                              <div className="text-lg">
                                {account.average12MonthReturn >= 0 ? '📈' : '📉'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Sparkline and Progress Bar */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              {/* Progress Bar */}
                              <div className="progress-bar">
                                <div 
                                  className="progress-fill"
                                  style={{ 
                                    width: `${Math.min(Math.max((account.average12MonthReturn + 10) / 40 * 100, 0), 100)}%`,
                                    background: account.average12MonthReturn >= 0 ? 
                                      'linear-gradient(90deg, var(--success) 0%, #20c997 100%)' :
                                      'linear-gradient(90deg, var(--danger) 0%, #e74c3c 100%)'
                                  }}
                                ></div>
                              </div>
                            </div>
                            <div className="ml-4">
                              {/* Sparkline showing 12-month trend */}
                              <Sparkline
                                data={generateSampleSparklineData(account.average12MonthReturn)}
                                color={account.average12MonthReturn >= 0 ? '#28A745' : '#DC3545'}
                                width={60}
                                height={24}
                                className="opacity-80"
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* View Details Button */}
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${
                            account.average12MonthReturn >= 15 ? 'pill-success' :
                            account.average12MonthReturn >= 5 ? 'pill-warning' :
                            account.average12MonthReturn < 0 ? 'pill-danger' : 'text-evans-secondary'
                          }`}>
                            {account.average12MonthReturn >= 15 ? '🚀 Excellent' :
                             account.average12MonthReturn >= 5 ? '⚡ Good' :
                             account.average12MonthReturn >= 0 ? '📊 Stable' :
                             '⚠️ Needs Attention'}
                          </span>
                          
                          <div className="flex items-center text-evans-primary group-hover:text-evans-primary/80 font-medium">
                            <span className="text-sm mr-2">View Details</span>
                            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {accounts.length === 0 && (
        <div className="card-fintech p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-evans-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-evans-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-evans-primary mb-2">No Accounts Found</h3>
          <p className="text-evans-secondary">
            No portfolio accounts are currently available. Data may still be processing.
          </p>
          <button
            onClick={refreshAccounts}
            className="btn-evans mt-4 ripple"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </button>
        </div>
      )}
    </div>
  );
}