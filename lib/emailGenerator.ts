import { PortfolioComparison, PortfolioData, Holding, PerformanceData } from '@/types';
import { PortfolioComparisonService } from './portfolioComparison';
import { TimezoneUtils } from './timezoneUtils';

export class EmailSummaryGenerator {
  private comparisonService: PortfolioComparisonService;

  constructor() {
    this.comparisonService = new PortfolioComparisonService();
  }

  generateDailySummaryHTML(summary: {
    totalAccounts: number;
    totalValue: number;
    totalDayChange: number;
    totalDayChangePercent: number;
    comparisons: PortfolioComparison[];
    alerts: string[];
  }): string {
    const date = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Portfolio Summary - ${date}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header {
            text-align: center;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 28px;
        }
        
        .header .date {
            color: #666;
            font-size: 16px;
            margin-top: 5px;
        }
        
        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .summary-card {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
            text-align: center;
            border-left: 4px solid #3498db;
        }
        
        .summary-card.positive {
            border-left-color: #27ae60;
            background: #f8fff8;
        }
        
        .summary-card.negative {
            border-left-color: #e74c3c;
            background: #fff8f8;
        }
        
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .summary-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .positive .value {
            color: #27ae60;
        }
        
        .negative .value {
            color: #e74c3c;
        }
        
        .alerts {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .alerts h3 {
            margin: 0 0 15px 0;
            color: #856404;
        }
        
        .alerts ul {
            margin: 0;
            padding-left: 20px;
        }
        
        .alerts li {
            margin-bottom: 5px;
            color: #856404;
        }
        
        .accounts {
            margin-bottom: 30px;
        }
        
        .account {
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            margin-bottom: 20px;
            overflow: hidden;
        }
        
        .account-header {
            background: #2c3e50;
            color: white;
            padding: 15px 20px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .account-body {
            padding: 20px;
        }
        
        .performance-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .performance-item {
            text-align: center;
        }
        
        .performance-item .label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        }
        
        .performance-item .value {
            font-size: 18px;
            font-weight: bold;
        }
        
        .changes {
            margin-top: 20px;
        }
        
        .changes h4 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .change-list {
            background: #f8f9fa;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .trade-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
        }
        
        .trade-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            display: inline-block;
        }
        
        .trade-badge.bought {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .trade-badge.sold {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .change-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
            border-bottom: 1px solid #e9ecef;
        }
        
        .change-item:last-child {
            border-bottom: none;
        }
        
        .holdings-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        
        .holdings-table th,
        .holdings-table td {
            text-align: left;
            padding: 8px 12px;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .holdings-table th {
            background: #f8f9fa;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .holdings-table .positive {
            color: #27ae60;
        }
        
        .holdings-table .negative {
            color: #e74c3c;
        }
        
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }
        
        @media (max-width: 600px) {
            .summary-cards {
                grid-template-columns: 1fr;
            }
            
            .performance-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .account-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Daily Portfolio Summary</h1>
            <div class="date">${date}</div>
            <div style="margin-top: 10px; font-size: 16px; color: #2c3e50; font-weight: 600;">
                Evans Family Wealth
            </div>
        </div>
        
        <div class="summary-cards">
            <div class="summary-card">
                <h3>Total Models</h3>
                <div class="value">${summary.totalAccounts}</div>
            </div>
            
            <div class="summary-card ${this.calculateWeightedDayChange(summary.comparisons) >= 0 ? 'positive' : 'negative'}">
                <h3>Portfolio Day Return</h3>
                <div class="value">${this.calculateWeightedDayChange(summary.comparisons) >= 0 ? '+' : ''}${this.calculateWeightedDayChange(summary.comparisons).toFixed(2)}%</div>
            </div>
        </div>
        
        ${this.generateModelsPerformanceTable(summary.comparisons)}
        
        ${this.generateAlertsSection(summary.alerts)}
        
        <div class="accounts">
            <h2>Account Performance Details</h2>
            ${summary.comparisons.map(comparison => this.generateAccountSection(comparison)).join('')}
        </div>
        
        <div class="footer">
            <p>Generated on ${TimezoneUtils.getCurrentESTString()} by Evans Family Wealth Portfolio Tracker</p>
            <p style="margin-top: 15px;">
                <a href="${process.env.VERCEL_URL || 'https://portfolio-tracker-iygxspgfx-glen-evans-projects.vercel.app'}" 
                   style="background: #2c3e50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    📊 View Live Portfolio Dashboard
                </a>
            </p>
            <p style="margin-top: 10px; font-size: 12px; color: #888;">
                Trade status, detailed holdings, and real-time performance metrics
            </p>
        </div>
    </div>
</body>
</html>`;
  }

  private generateAlertsSection(alerts: string[]): string {
    if (alerts.length === 0) {
      return `
        <div class="alerts" style="background: #d4edda; border-color: #c3e6cb;">
            <h3 style="color: #155724;">✅ All Good</h3>
            <p style="margin: 0; color: #155724;">No significant alerts for your portfolio today.</p>
        </div>
      `;
    }

    return `
      <div class="alerts">
          <h3>⚠️ Alerts & Notifications</h3>
          <ul>
              ${alerts.map(alert => `<li>${alert.replace(/🚨|📈|🔄|⚡/g, '')}</li>`).join('')}
          </ul>
      </div>
    `;
  }

  private generateAccountSection(comparison: PortfolioComparison): string {
    const { today, yesterday } = comparison;
    const metrics = this.comparisonService.calculatePerformanceMetrics(comparison);
    const changes = this.comparisonService.generateChangesSummary(comparison);

    return `
      <div class="account">
          <div class="account-header">
              <div>
                  <div>${today.accountName}</div>
                  <div style="font-size: 14px; opacity: 0.8;">${today.accountNumber}</div>
              </div>
              <div style="text-align: right;">
                  <div class="${today.dayChangePercent >= 0 ? 'positive' : 'negative'}" style="font-size: 18px; font-weight: bold;">${today.dayChangePercent >= 0 ? '+' : ''}${today.dayChangePercent.toFixed(2)}%</div>
                  <div style="font-size: 14px; opacity: 0.8;">${today.holdings.length} holdings</div>
              </div>
          </div>
          
          <div class="account-body">
              <div class="performance-grid">
                  <div class="performance-item">
                      <div class="label">Day Return</div>
                      <div class="value ${today.dayChangePercent >= 0 ? 'positive' : 'negative'}">
                          ${today.dayChangePercent >= 0 ? '+' : ''}${today.dayChangePercent.toFixed(2)}%
                      </div>
                  </div>
                  
                  <div class="performance-item">
                      <div class="label">Holdings</div>
                      <div class="value">${today.holdings.length}</div>
                  </div>
                  
                  ${this.getModelPerformanceMetrics(today.holdings).length > 0 ? `
                  <div class="performance-item">
                      <div class="label">1M Return</div>
                      <div class="value ${this.getModelPerformanceMetrics(today.holdings)[0]?.return1Month >= 0 ? 'positive' : 'negative'}">
                          ${this.getModelPerformanceMetrics(today.holdings)[0]?.return1Month >= 0 ? '+' : ''}${(this.getModelPerformanceMetrics(today.holdings)[0]?.return1Month || 0).toFixed(2)}%
                      </div>
                  </div>
                  
                  <div class="performance-item">
                      <div class="label">3M Return</div>
                      <div class="value ${this.getModelPerformanceMetrics(today.holdings)[0]?.return3Month >= 0 ? 'positive' : 'negative'}">
                          ${this.getModelPerformanceMetrics(today.holdings)[0]?.return3Month >= 0 ? '+' : ''}${(this.getModelPerformanceMetrics(today.holdings)[0]?.return3Month || 0).toFixed(2)}%
                      </div>
                  </div>
                  ` : ''}
              </div>
              
              ${this.generateTopPerformersSection(metrics.topGainers, metrics.topLosers)}
              
              ${this.generateChangesSection(comparison)}
          </div>
      </div>
    `;
  }

  private generateTopPerformersSection(topGainers: Holding[], topLosers: Holding[]): string {
    if (topGainers.length === 0 && topLosers.length === 0) {
      return '';
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0;">
          ${topGainers.length > 0 ? `
          <div>
              <h4 style="color: #27ae60; margin-bottom: 10px;">🔥 Top Gainers</h4>
              <div class="change-list">
                  ${topGainers.map(holding => `
                  <div class="change-item">
                      <span>${holding.symbol}</span>
                      <span class="positive">+${holding.dayChangePercent.toFixed(2)}%</span>
                  </div>
                  `).join('')}
              </div>
          </div>
          ` : ''}
          
          ${topLosers.length > 0 ? `
          <div>
              <h4 style="color: #e74c3c; margin-bottom: 10px;">📉 Top Losers</h4>
              <div class="change-list">
                  ${topLosers.map(holding => `
                  <div class="change-item">
                      <span>${holding.symbol}</span>
                      <span class="negative">${holding.dayChangePercent.toFixed(2)}%</span>
                  </div>
                  `).join('')}
              </div>
          </div>
          ` : ''}
      </div>
    `;
  }

  private generateChangesSection(comparison: PortfolioComparison): string {
    const { changes } = comparison;
    const hasChanges = changes.newHoldings.length > 0 || 
                      changes.removedHoldings.length > 0 || 
                      changes.quantityChanges.length > 0;

    if (!hasChanges) {
      return `
        <div class="changes">
            <h4>📋 Portfolio Changes</h4>
            <p style="color: #666; font-style: italic;">No holdings changes detected.</p>
        </div>
      `;
    }

    return `
      <div class="changes">
          <h4>📋 Portfolio Changes</h4>
          
          ${changes.newHoldings.length > 0 ? `
          <div style="margin-bottom: 20px;">
              <strong style="color: #27ae60; font-size: 16px;">🟢 BOUGHT TODAY</strong>
              <div class="trade-badges" style="margin-top: 10px;">
                  ${changes.newHoldings.map(holding => `
                  <span class="trade-badge bought">${holding.symbol}</span>
                  `).join('')}
              </div>
              <div class="change-list" style="background: #f8fff8; border-left: 4px solid #27ae60;">
                  ${changes.newHoldings.map(holding => `
                  <div class="change-item">
                      <span>${holding.symbol} - ${holding.name}</span>
                      <span>${holding.quantity} shares</span>
                  </div>
                  `).join('')}
              </div>
          </div>
          ` : ''}
          
          ${changes.removedHoldings.length > 0 ? `
          <div style="margin-bottom: 20px;">
              <strong style="color: #e74c3c; font-size: 16px;">🔴 SOLD TODAY</strong>
              <div class="trade-badges" style="margin-top: 10px;">
                  ${changes.removedHoldings.map(holding => `
                  <span class="trade-badge sold">${holding.symbol}</span>
                  `).join('')}
              </div>
              <div class="change-list" style="background: #fff8f8; border-left: 4px solid #e74c3c;">
                  ${changes.removedHoldings.map(holding => `
                  <div class="change-item">
                      <span>${holding.symbol} - ${holding.name}</span>
                      <span>${holding.quantity} shares</span>
                  </div>
                  `).join('')}
              </div>
          </div>
          ` : ''}
          
          ${changes.quantityChanges.length > 0 ? `
          <div style="margin-bottom: 15px;">
              <strong style="color: #3498db;">🔄 Quantity Changes (${changes.quantityChanges.length})</strong>
              <div class="change-list">
                  ${changes.quantityChanges.map(change => `
                  <div class="change-item">
                      <span>${change.symbol}</span>
                      <span>${change.oldQuantity} → ${change.newQuantity} (${change.difference > 0 ? '+' : ''}${change.difference})</span>
                  </div>
                  `).join('')}
              </div>
          </div>
          ` : ''}
      </div>
    `;
  }

  private formatCurrency(amount: number): string {
    return Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  public calculateWeightedDayChange(comparisons: PortfolioComparison[]): number {
    let totalValue = 0;
    let weightedReturn = 0;

    for (const comparison of comparisons) {
      const accountValue = comparison.today.totalValue;
      const accountReturn = comparison.today.dayChangePercent;
      
      totalValue += accountValue;
      weightedReturn += accountValue * accountReturn;
    }

    return totalValue > 0 ? weightedReturn / totalValue : 0;
  }

  private generateModelsPerformanceTable(comparisons: PortfolioComparison[]): string {
    const modelsData = this.extractModelsPerformanceData(comparisons);
    
    if (modelsData.length === 0) {
      return `
        <div style="margin-bottom: 30px;">
          <h2>📈 Models Performance</h2>
          <p style="color: #666; font-style: italic;">No performance data available for models.</p>
        </div>
      `;
    }

    return `
      <div style="margin-bottom: 30px;">
        <h2>📈 Models Performance</h2>
        <table class="holdings-table" style="background: white;">
          <thead>
            <tr>
              <th>Model Name</th>
              <th>1 Day</th>
              <th>1 Month</th>
              <th>3 Month</th>
              <th>6 Month</th>
              <th>12 Month</th>
            </tr>
          </thead>
          <tbody>
            ${modelsData.map(model => `
              <tr>
                <td style="font-weight: bold;">${model.name}</td>
                <td class="${model.dayReturn >= 0 ? 'positive' : 'negative'}">${model.dayReturn >= 0 ? '+' : ''}${model.dayReturn.toFixed(2)}%</td>
                <td class="${model.return1Month >= 0 ? 'positive' : 'negative'}">${model.return1Month >= 0 ? '+' : ''}${model.return1Month.toFixed(2)}%</td>
                <td class="${model.return3Month >= 0 ? 'positive' : 'negative'}">${model.return3Month >= 0 ? '+' : ''}${model.return3Month.toFixed(2)}%</td>
                <td class="${model.return6Month >= 0 ? 'positive' : 'negative'}">${model.return6Month >= 0 ? '+' : ''}${model.return6Month.toFixed(2)}%</td>
                <td class="${model.return12Month >= 0 ? 'positive' : 'negative'}">${model.return12Month >= 0 ? '+' : ''}${model.return12Month.toFixed(2)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  private extractModelsPerformanceData(comparisons: PortfolioComparison[]): Array<{
    name: string;
    dayReturn: number;
    return1Month: number;
    return3Month: number;
    return6Month: number;
    return12Month: number;
  }> {
    const modelsMap = new Map();

    for (const comparison of comparisons) {
      // Extract model name from account name (assuming format like "Model Name - Account")
      const modelName = comparison.today.accountName.split(' - ')[0] || comparison.today.accountName;
      
      // Get performance data from the first holding with performance data
      const holdingWithPerformance = comparison.today.holdings.find(h => h.performance);
      
      if (holdingWithPerformance?.performance) {
        const perf = holdingWithPerformance.performance;
        modelsMap.set(modelName, {
          name: modelName,
          dayReturn: comparison.today.dayChangePercent,
          return1Month: perf.return1Month || 0,
          return3Month: perf.return3Month || 0,
          return6Month: perf.return6Month || 0,
          return12Month: perf.return12Month || 0,
        });
      } else {
        // Fallback to day change only if no performance data
        if (!modelsMap.has(modelName)) {
          modelsMap.set(modelName, {
            name: modelName,
            dayReturn: comparison.today.dayChangePercent,
            return1Month: 0,
            return3Month: 0,
            return6Month: 0,
            return12Month: 0,
          });
        }
      }
    }

    return Array.from(modelsMap.values());
  }

  private getModelPerformanceMetrics(holdings: Holding[]): PerformanceData[] {
    const performanceData = holdings
      .map(h => h.performance)
      .filter((p): p is PerformanceData => p !== undefined);
    
    return performanceData;
  }

  generateTextSummary(summary: {
    totalAccounts: number;
    totalValue: number;
    totalDayChange: number;
    totalDayChangePercent: number;
    comparisons: PortfolioComparison[];
    alerts: string[];
  }): string {
    const date = TimezoneUtils.getDateStringEST();
    let text = `Portfolio Summary for ${date}\n`;
    text += '='.repeat(50) + '\n\n';
    
    text += `Portfolio Day Return: ${this.calculateWeightedDayChange(summary.comparisons) >= 0 ? '+' : ''}${this.calculateWeightedDayChange(summary.comparisons).toFixed(2)}%\n`;
    text += `Models Tracked: ${summary.totalAccounts}\n\n`;

    if (summary.alerts.length > 0) {
      text += 'ALERTS:\n';
      text += '-'.repeat(20) + '\n';
      summary.alerts.forEach(alert => {
        text += `• ${alert}\n`;
      });
      text += '\n';
    }

    summary.comparisons.forEach((comparison, index) => {
      text += `${index + 1}. ${comparison.today.accountName}\n`;
      text += `   Day Return: ${comparison.today.dayChangePercent >= 0 ? '+' : ''}${comparison.today.dayChangePercent.toFixed(2)}%\n`;
      text += `   Holdings: ${comparison.today.holdings.length}\n\n`;
    });

    return text;
  }
}