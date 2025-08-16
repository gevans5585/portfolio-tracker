'use client';

import { useState, useEffect } from 'react';

interface WatchListModel {
  name: string;
  symbol: string;
  return12Month: number;
  returnYTD: number;
  finalEquity: number;
  sharpeRatio: number;
  maxDrawdown: number;
  portfolio: string;
  isOwned: boolean;
}

interface ModelWatchListData {
  topPerformers: WatchListModel[];
  totalModelsAnalyzed: number;
  ownedModelsCount: number;
  opportunityModelsCount: number;
  date: string;
}

interface ModelWatchListResponse {
  success: boolean;
  data: ModelWatchListData;
  message?: string;
}

export default function ModelWatchList() {
  const [watchListData, setWatchListData] = useState<ModelWatchListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Add delay to prevent IMAP connection overload when dashboard loads
    const timer = setTimeout(() => {
      fetchWatchListData();
    }, 2000); // 2 second delay
    
    return () => clearTimeout(timer);
  }, []);

  const fetchWatchListData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/model-watch-list');
      const result: ModelWatchListResponse = await response.json();
      
      if (result.success) {
        setWatchListData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch watch list data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercentage = (value: number) => {
    const color = value >= 0 ? 'text-green-600' : 'text-red-600';
    const sign = value >= 0 ? '+' : '';
    return (
      <span className={`font-medium ${color}`}>
        {sign}{value.toFixed(2)}%
      </span>
    );
  };

  const getHeatMapColor = (returnValue: number, sortedReturns: number[]) => {
    // Create 5 distinct grayscale shades based on ranking
    const rank = sortedReturns.indexOf(returnValue);
    switch(rank) {
      case 0: return 'bg-gray-900'; // Darkest - #111827
      case 1: return 'bg-gray-700'; // Dark - #374151
      case 2: return 'bg-gray-500'; // Medium - #6B7280
      case 3: return 'bg-gray-300'; // Light - #D1D5DB
      case 4: return 'bg-gray-100'; // Lightest - #F3F4F6
      default: return 'bg-gray-200';
    }
  };

  const getHeatMapTextColor = (returnValue: number, sortedReturns: number[]) => {
    const rank = sortedReturns.indexOf(returnValue);
    // Dark backgrounds (ranks 0, 1) get white text
    // Light backgrounds (ranks 2, 3, 4) get dark text
    if (rank <= 1) return 'text-white';
    return 'text-gray-900';
  };

  const getHeatMapBorderColor = (returnValue: number, sortedReturns: number[]) => {
    const rank = sortedReturns.indexOf(returnValue);
    if (rank <= 1) return 'border-white';
    return 'border-gray-900';
  };

  const getOwnershipIcon = (isOwned: boolean) => {
    return isOwned ? (
      <span className="text-green-600 text-lg" title="We own this model">✅</span>
    ) : (
      <span className="text-amber-500 text-lg" title="Opportunity - we don't own this model">⚠️</span>
    );
  };

  const getOwnershipBadge = (isOwned: boolean) => {
    return isOwned ? (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-evans-primary text-white">
        ✅ Owned
      </span>
    ) : (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-warning text-white">
        ⚠️ Opportunity
      </span>
    );
  };

  if (loading) {
    return (
      <div className="card-fintech p-8 animate-fade-in">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-evans-primary"></div>
          <div className="ml-4">
            <h2 className="text-2xl font-bold text-evans-primary">Model Watch List</h2>
            <span className="text-evans-secondary">Analyzing all models...</span>
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
          <h2 className="text-2xl font-bold text-evans-primary mb-2">Model Watch List Unavailable</h2>
          <p className="text-evans-secondary mb-6">{error}</p>
          <button
            onClick={fetchWatchListData}
            className="btn-evans ripple"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!watchListData) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Model Watch List</h2>
        <div className="text-gray-500">No watch list data available.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card-fintech p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-evans-primary rounded-xl flex items-center justify-center text-xl">
            📊
          </div>
          <div>
            <h2 className="text-3xl font-bold text-evans-primary">Model Watch List</h2>
            <p className="text-evans-secondary text-sm">
              Top performers by 12-month return • Heat map visualization
            </p>
          </div>
        </div>
        
        {/* Summary Stats as Badges */}
        <div className="flex flex-wrap gap-3">
          <div className="pill-success flex items-center space-x-2">
            <span className="font-bold">{watchListData.totalModelsAnalyzed}</span>
            <span>Total Models</span>
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-evans-primary text-white">
            <span className="mr-1">✅</span>
            <span className="font-bold mr-1">{watchListData.ownedModelsCount}</span>
            <span>Owned</span>
          </div>
          <div className="pill-warning flex items-center space-x-2">
            <span>⚠️</span>
            <span className="font-bold">{watchListData.opportunityModelsCount}</span>
            <span>Opportunities</span>
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-evans-secondary text-evans-primary">
            <span className="font-bold mr-1">5</span>
            <span>Top Performers</span>
          </div>
        </div>
      </div>

      {/* Top Performers - Grayscale Heat Map Table */}
      {watchListData.topPerformers.length > 0 ? (
        (() => {
          // Create sorted array of returns for ranking
          const sortedReturns = [...watchListData.topPerformers]
            .sort((a, b) => b.return12Month - a.return12Month)
            .map(model => model.return12Month);

          return (
            <div className="card-fintech overflow-hidden animate-fade-in">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Model Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        12-Month Return
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        YTD Return
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Portfolio Value
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Sharpe Ratio
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {watchListData.topPerformers.map((model, index) => (
                      <tr 
                        key={`${model.name}-${index}`}
                        className={`${getHeatMapColor(model.return12Month, sortedReturns)} hover:brightness-105 transition-all duration-200`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${getHeatMapBorderColor(model.return12Month, sortedReturns)} bg-black/10`}>
                              <span className={`text-lg font-bold ${getHeatMapTextColor(model.return12Month, sortedReturns)}`}>
                                #{index + 1}
                              </span>
                            </div>
                            <span className="text-lg">{getOwnershipIcon(model.isOwned)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${getHeatMapTextColor(model.return12Month, sortedReturns)}`}>
                            {model.name}
                          </div>
                          <div className={`text-sm ${getHeatMapTextColor(model.return12Month, sortedReturns)} opacity-70`}>
                            {model.symbol}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-lg font-bold">
                            {formatPercentage(model.return12Month)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium">
                            {formatPercentage(model.returnYTD)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${getHeatMapTextColor(model.return12Month, sortedReturns)}`}>
                            {formatCurrency(model.finalEquity)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${getHeatMapTextColor(model.return12Month, sortedReturns)}`}>
                            {model.sharpeRatio.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {getOwnershipBadge(model.isOwned)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()
      ) : (
        <div className="card-fintech p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-evans-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-evans-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-evans-primary mb-2">No Top Performers Found</h3>
          <p className="text-evans-secondary">No models with 12-month return data available.</p>
        </div>
      )}

      {/* Footer */}
      <div className="card-fintech p-4 text-center animate-fade-in">
        <p className="text-evans-secondary text-sm">
          Data as of {watchListData.date} • Ranked by 12-month performance • Heat map visualization
        </p>
      </div>
    </div>
  );
}