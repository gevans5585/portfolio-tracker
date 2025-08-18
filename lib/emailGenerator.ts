import { PortfolioComparison, PortfolioData, Holding } from '@/types';
import { PortfolioComparisonService } from './portfolioComparison';

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
                <h3>Total Accounts</h3>
                <div class="value">${summary.totalAccounts}</div>
            </div>
            
            <div class="summary-card">
                <h3>Total Value</h3>
                <div class="value">$${this.formatCurrency(summary.totalValue)}</div>
            </div>
            
            <div class="summary-card ${summary.totalDayChange >= 0 ? 'positive' : 'negative'}">
                <h3>Day Change</h3>
                <div class="value">${summary.totalDayChange >= 0 ? '+' : ''}$${this.formatCurrency(summary.totalDayChange)}</div>
            </div>
            
            <div class="summary-card ${summary.totalDayChangePercent >= 0 ? 'positive' : 'negative'}">
                <h3>Day Change %</h3>
                <div class="value">${summary.totalDayChangePercent >= 0 ? '+' : ''}${summary.totalDayChangePercent.toFixed(2)}%</div>
            </div>
        </div>
        
        ${this.generateAlertsSection(summary.alerts)}
        
        <div class="accounts">
            <h2>Account Details</h2>
            ${summary.comparisons.map(comparison => this.generateAccountSection(comparison)).join('')}
        </div>
        
        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()} by Evans Family Wealth Portfolio Tracker</p>
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
                  <div>$${this.formatCurrency(today.totalValue)}</div>
                  <div style="font-size: 14px; opacity: 0.8;">${today.holdings.length} holdings</div>
              </div>
          </div>
          
          <div class="account-body">
              <div class="performance-grid">
                  <div class="performance-item">
                      <div class="label">Day Change</div>
                      <div class="value ${today.dayChange >= 0 ? 'positive' : 'negative'}">
                          ${today.dayChange >= 0 ? '+' : ''}$${this.formatCurrency(today.dayChange)}
                      </div>
                  </div>
                  
                  <div class="performance-item">
                      <div class="label">Day Change %</div>
                      <div class="value ${today.dayChangePercent >= 0 ? 'positive' : 'negative'}">
                          ${today.dayChangePercent >= 0 ? '+' : ''}${today.dayChangePercent.toFixed(2)}%
                      </div>
                  </div>
                  
                  ${yesterday ? `
                  <div class="performance-item">
                      <div class="label">Since Yesterday</div>
                      <div class="value ${metrics.totalValueChange >= 0 ? 'positive' : 'negative'}">
                          ${metrics.totalValueChange >= 0 ? '+' : ''}$${this.formatCurrency(metrics.totalValueChange)}
                      </div>
                  </div>
                  ` : ''}
                  
                  <div class="performance-item">
                      <div class="label">Holdings</div>
                      <div class="value">${today.holdings.length}</div>
                  </div>
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
                      <span class="positive">+$${this.formatCurrency(holding.dayChange)} (${holding.dayChangePercent.toFixed(2)}%)</span>
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
                      <span class="negative">$${this.formatCurrency(holding.dayChange)} (${holding.dayChangePercent.toFixed(2)}%)</span>
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
          <div style="margin-bottom: 15px;">
              <strong style="color: #27ae60;">➕ New Holdings (${changes.newHoldings.length})</strong>
              <div class="change-list">
                  ${changes.newHoldings.map(holding => `
                  <div class="change-item">
                      <span>${holding.symbol} - ${holding.name}</span>
                      <span>${holding.quantity} shares @ $${holding.price.toFixed(2)}</span>
                  </div>
                  `).join('')}
              </div>
          </div>
          ` : ''}
          
          ${changes.removedHoldings.length > 0 ? `
          <div style="margin-bottom: 15px;">
              <strong style="color: #e74c3c;">➖ Removed Holdings (${changes.removedHoldings.length})</strong>
              <div class="change-list">
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

  generateTextSummary(summary: {
    totalAccounts: number;
    totalValue: number;
    totalDayChange: number;
    totalDayChangePercent: number;
    comparisons: PortfolioComparison[];
    alerts: string[];
  }): string {
    const date = new Date().toLocaleDateString();
    let text = `Portfolio Summary for ${date}\n`;
    text += '='.repeat(50) + '\n\n';
    
    text += `Total Portfolio Value: $${this.formatCurrency(summary.totalValue)}\n`;
    text += `Day Change: ${summary.totalDayChange >= 0 ? '+' : ''}$${this.formatCurrency(summary.totalDayChange)} (${summary.totalDayChangePercent.toFixed(2)}%)\n`;
    text += `Accounts Tracked: ${summary.totalAccounts}\n\n`;

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
      text += `   Value: $${this.formatCurrency(comparison.today.totalValue)}\n`;
      text += `   Day Change: ${comparison.today.dayChange >= 0 ? '+' : ''}$${this.formatCurrency(comparison.today.dayChange)} (${comparison.today.dayChangePercent.toFixed(2)}%)\n`;
      text += `   Holdings: ${comparison.today.holdings.length}\n\n`;
    });

    return text;
  }
}