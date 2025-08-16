'use client';

import { useState, useEffect } from 'react';
import { PortfolioComparison, PortfolioData } from '@/types';

interface DashboardData {
  totalAccounts: number;
  totalValue: number;
  totalDayChange: number;
  totalDayChangePercent: number;
  comparisons: PortfolioComparison[];
  alerts: string[];
  lastUpdated: string;
}

export default function PortfolioDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/dashboard-data');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Error loading portfolio data</h3>
        <p className="text-red-600 mt-1">{error}</p>
        <button 
          onClick={fetchData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </span>
          <a
            href="/debug"
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
          >
            🔧 Debug
          </a>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard
          title="Total Accounts"
          value={data.totalAccounts.toString()}
          icon="🏦"
        />
        <SummaryCard
          title="Total Value"
          value={formatCurrency(data.totalValue)}
          icon="💰"
        />
        <SummaryCard
          title="Day Change"
          value={`${data.totalDayChange >= 0 ? '+' : ''}${formatCurrency(data.totalDayChange)}`}
          icon={data.totalDayChange >= 0 ? '📈' : '📉'}
          className={data.totalDayChange >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          title="Day Change %"
          value={`${data.totalDayChangePercent >= 0 ? '+' : ''}${data.totalDayChangePercent.toFixed(2)}%`}
          icon={data.totalDayChangePercent >= 0 ? '🟢' : '🔴'}
          className={data.totalDayChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-yellow-800 font-medium flex items-center gap-2">
            ⚠️ Alerts & Notifications
          </h3>
          <ul className="mt-2 space-y-1">
            {data.alerts.map((alert, index) => (
              <li key={index} className="text-yellow-700">
                • {alert.replace(/🚨|📈|🔄|⚡/g, '')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Account Details */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Account Details</h2>
        {data.comparisons.map((comparison, index) => (
          <AccountCard key={index} comparison={comparison} />
        ))}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: string;
  className?: string;
}

function SummaryCard({ title, value, icon, className = '' }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${className}`}>{value}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

interface AccountCardProps {
  comparison: PortfolioComparison;
}

function AccountCard({ comparison }: AccountCardProps) {
  const { today, yesterday, changes } = comparison;
  const [expanded, setExpanded] = useState(false);

  const hasChanges = changes.newHoldings.length > 0 || 
                    changes.removedHoldings.length > 0 || 
                    changes.quantityChanges.length > 0;

  return (
    <div className="bg-white rounded-lg shadow">
      <div 
        className="p-6 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">{today.accountName}</h3>
            <p className="text-sm text-gray-600">{today.accountNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{formatCurrency(today.totalValue)}</p>
            <p className={`text-sm ${today.dayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {today.dayChange >= 0 ? '+' : ''}{formatCurrency(today.dayChange)} ({today.dayChangePercent.toFixed(2)}%)
            </p>
          </div>
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <div className="flex gap-4 text-sm text-gray-600">
            <span>{today.holdings.length} holdings</span>
            {hasChanges && <span className="text-blue-600">📝 Has changes</span>}
          </div>
          <span className="text-gray-400">
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-gray-50 p-6">
          {/* Holdings Table */}
          <div className="mb-6">
            <h4 className="font-medium mb-3">Holdings</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-right py-2">Quantity</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">Value</th>
                    <th className="text-right py-2">Day Change</th>
                  </tr>
                </thead>
                <tbody>
                  {today.holdings.map((holding, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 font-medium">{holding.symbol}</td>
                      <td className="py-2 text-gray-600">{holding.name}</td>
                      <td className="py-2 text-right">{holding.quantity}</td>
                      <td className="py-2 text-right">${holding.price.toFixed(2)}</td>
                      <td className="py-2 text-right">{formatCurrency(holding.value)}</td>
                      <td className={`py-2 text-right ${holding.dayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {holding.dayChange >= 0 ? '+' : ''}{formatCurrency(holding.dayChange)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Changes */}
          {hasChanges && (
            <div>
              <h4 className="font-medium mb-3">Portfolio Changes</h4>
              <div className="space-y-3">
                {changes.newHoldings.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-600">➕ New Holdings ({changes.newHoldings.length})</p>
                    <div className="ml-4 space-y-1">
                      {changes.newHoldings.map((holding, index) => (
                        <p key={index} className="text-sm text-gray-600">
                          {holding.symbol} - {holding.quantity} shares @ ${holding.price.toFixed(2)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {changes.removedHoldings.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-600">➖ Removed Holdings ({changes.removedHoldings.length})</p>
                    <div className="ml-4 space-y-1">
                      {changes.removedHoldings.map((holding, index) => (
                        <p key={index} className="text-sm text-gray-600">
                          {holding.symbol} - {holding.quantity} shares
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {changes.quantityChanges.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-blue-600">🔄 Quantity Changes ({changes.quantityChanges.length})</p>
                    <div className="ml-4 space-y-1">
                      {changes.quantityChanges.map((change, index) => (
                        <p key={index} className="text-sm text-gray-600">
                          {change.symbol}: {change.oldQuantity} → {change.newQuantity} ({change.difference > 0 ? '+' : ''}{change.difference})
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}