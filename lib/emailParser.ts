import * as cheerio from 'cheerio';
import { PortfolioData, Holding } from '@/types';

export class EmailParser {
  parsePortfolioEmail(htmlContent: string, emailSubject: string, emailDate: string): PortfolioData | null {
    try {
      const $ = cheerio.load(htmlContent);
      
      // Try different parsing strategies based on common email formats
      const portfolioData = 
        this.parseStandardFormat($) ||
        this.parseBrokerageFormat($) ||
        this.parseCustomFormat($);

      if (portfolioData) {
        portfolioData.date = this.parseEmailDate(emailDate);
        return portfolioData;
      }

      return null;
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  /**
   * Parse portfolio email and filter holdings by allowed model names
   * This method parses ALL tables and only returns holdings where the "Name" column matches the model names
   */
  parseFilteredPortfolioEmail(
    htmlContent: string, 
    emailSubject: string, 
    emailDate: string, 
    allowedModels: string[]
  ): PortfolioData[] {
    try {
      const $ = cheerio.load(htmlContent);
      console.log(`Parsing email with ${allowedModels.length} allowed models:`, allowedModels);
      
      // Parse ALL tables in the email and extract data
      const allPortfolioData = this.parseAllTables($, allowedModels);
      
      // Set the date for all parsed data
      const parsedDate = this.parseEmailDate(emailDate);
      allPortfolioData.forEach(data => {
        data.date = parsedDate;
      });

      console.log(`Parsed ${allPortfolioData.length} portfolio data objects from email`);
      return allPortfolioData;
    } catch (error) {
      console.error('Error parsing filtered email:', error);
      return [];
    }
  }

  private parseStandardFormat($: cheerio.CheerioAPI): PortfolioData | null {
    // Look for common table structures
    const tables = $('table');
    
    for (let i = 0; i < tables.length; i++) {
      const table = $(tables[i]);
      const headers = table.find('th, td').first().parent().find('th, td');
      
      // Check if this looks like a holdings table
      const headerText = headers.map((_, el) => $(el).text().toLowerCase()).get().join(' ');
      
      if (this.isHoldingsTable(headerText)) {
        return this.parseHoldingsTable(table, $);
      }
    }

    return null;
  }

  private parseBrokerageFormat($: cheerio.CheerioAPI): PortfolioData | null {
    // Parse common brokerage email formats (Schwab, Fidelity, etc.)
    const accountInfo = this.extractAccountInfo($);
    const holdings = this.extractHoldings($);
    const summary = this.extractSummary($);

    if (holdings.length > 0) {
      return {
        accountName: accountInfo.name || 'Unknown Account',
        accountNumber: accountInfo.number || '',
        holdings,
        totalValue: summary.totalValue || this.calculateTotalValue(holdings),
        dayChange: summary.dayChange || this.calculateTotalDayChange(holdings),
        dayChangePercent: summary.dayChangePercent || this.calculateTotalDayChangePercent(holdings),
        date: '',
      };
    }

    return null;
  }

  private parseCustomFormat($: cheerio.CheerioAPI): PortfolioData | null {
    // Fallback parser for custom formats
    // Look for any table with numerical data that might be holdings
    const tables = $('table');
    
    for (let i = 0; i < tables.length; i++) {
      const table = $(tables[i]);
      const rows = table.find('tr');
      
      if (rows.length < 2) continue;
      
      const potentialHoldings = this.extractPotentialHoldings(table, $);
      if (potentialHoldings.length > 0) {
        return {
          accountName: this.findAccountName($) || 'Unknown Account',
          accountNumber: this.findAccountNumber($) || '',
          holdings: potentialHoldings,
          totalValue: this.calculateTotalValue(potentialHoldings),
          dayChange: this.calculateTotalDayChange(potentialHoldings),
          dayChangePercent: this.calculateTotalDayChangePercent(potentialHoldings),
          date: '',
        };
      }
    }

    return null;
  }

  private isHoldingsTable(headerText: string): boolean {
    const keywords = ['symbol', 'quantity', 'price', 'value', 'shares', 'position', 'market value'];
    return keywords.some(keyword => headerText.includes(keyword));
  }

  private isPortfolioPerformanceTable(headerText: string): boolean {
    const keywords = ['final equity', 'ret. ytd', 'ret. 1mo', 'sharpe', 'cagr', 'portfolio', 'name'];
    const matchCount = keywords.filter(keyword => headerText.includes(keyword)).length;
    return matchCount >= 3; // Require at least 3 performance-related keywords
  }

  private parseHoldingsTable(table: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): PortfolioData {
    const rows = table.find('tr');
    const headerRow = $(rows[0]);
    const headers = this.extractHeaders(headerRow);
    
    const holdings: Holding[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = $(rows[i]);
      const cells = row.find('td, th');
      
      if (cells.length === 0) continue;
      
      const holding = this.parseHoldingRow(cells, headers, $);
      if (holding) {
        holdings.push(holding);
      }
    }

    return {
      accountName: this.findAccountName($) || 'Unknown Account',
      accountNumber: this.findAccountNumber($) || '',
      holdings,
      totalValue: this.calculateTotalValue(holdings),
      dayChange: this.calculateTotalDayChange(holdings),
      dayChangePercent: this.calculateTotalDayChangePercent(holdings),
      date: '',
    };
  }

  private extractHeaders(headerRow: cheerio.Cheerio<any>): string[] {
    return headerRow.find('th, td').map((_, el) => 
      cheerio.load(el).text().trim().toLowerCase()
    ).get();
  }

  private parseHoldingRow(
    cells: cheerio.Cheerio<any>, 
    headers: string[], 
    $: cheerio.CheerioAPI
  ): Holding | null {
    const cellValues = cells.map((_, el) => $(el).text().trim()).get();
    
    if (cellValues.length === 0) return null;

    // Map common header variations to standardized fields
    const symbolIndex = this.findHeaderIndex(headers, ['symbol', 'ticker', 'security']);
    const nameIndex = this.findHeaderIndex(headers, ['name', 'description', 'security name']);
    const quantityIndex = this.findHeaderIndex(headers, ['quantity', 'shares', 'units']);
    const priceIndex = this.findHeaderIndex(headers, ['price', 'market price', 'current price']);
    const valueIndex = this.findHeaderIndex(headers, ['value', 'market value', 'total value']);
    const changeIndex = this.findHeaderIndex(headers, ['change', 'day change', 'daily change']);
    const changePercentIndex = this.findHeaderIndex(headers, ['change %', '% change', 'day change %']);

    const symbol = symbolIndex !== -1 ? cellValues[symbolIndex] : '';
    const name = nameIndex !== -1 ? cellValues[nameIndex] : symbol;
    
    if (!symbol) return null;

    return {
      symbol,
      name,
      quantity: quantityIndex !== -1 ? this.parseNumber(cellValues[quantityIndex]) : 0,
      price: priceIndex !== -1 ? this.parseNumber(cellValues[priceIndex]) : 0,
      value: valueIndex !== -1 ? this.parseNumber(cellValues[valueIndex]) : 0,
      dayChange: changeIndex !== -1 ? this.parseNumber(cellValues[changeIndex]) : 0,
      dayChangePercent: changePercentIndex !== -1 ? this.parseNumber(cellValues[changePercentIndex]) : 0,
    };
  }

  private parsePerformanceRow(
    cells: cheerio.Cheerio<any>, 
    headers: string[], 
    $: cheerio.CheerioAPI
  ): Holding | null {
    const cellValues = cells.map((_, el) => $(el).text().trim()).get();
    
    if (cellValues.length === 0) return null;

    // Map all performance headers 
    const nameIndex = this.findHeaderIndex(headers, ['name', 'model', 'fund name']);
    const equityIndex = this.findHeaderIndex(headers, ['final equity', 'equity']);
    const probWinIndex = this.findHeaderIndex(headers, ['pr. win', 'prob win']);
    const ytdIndex = this.findHeaderIndex(headers, ['ret. ytd', 'ytd']);
    const ret1mIndex = this.findHeaderIndex(headers, ['ret. 1mo', '1mo']);
    const ret3mIndex = this.findHeaderIndex(headers, ['ret. 3mo', '3mo']);
    const ret6mIndex = this.findHeaderIndex(headers, ['ret. 6mo', '6mo']);
    const ret12mIndex = this.findHeaderIndex(headers, ['ret. 12mo', '12mo']);
    const tradesIndex = this.findHeaderIndex(headers, ['trades ytd', 'trades']);
    const maxDDIndex = this.findHeaderIndex(headers, ['max dd', 'max drawdown']);
    const curDDIndex = this.findHeaderIndex(headers, ['cur dd', 'current dd']);
    const sharpeIndex = this.findHeaderIndex(headers, ['sharpe']);
    const cagrIndex = this.findHeaderIndex(headers, ['cagr']);
    const stdIndex = this.findHeaderIndex(headers, ['std(26)', 'std', 'volatility']);
    const portfolioIndex = this.findHeaderIndex(headers, ['portfolio']);
    const mlIndex = this.findHeaderIndex(headers, ['ml accuracies', 'accuracies']);
    
    const name = nameIndex !== -1 ? this.decodeHtmlEntities(cellValues[nameIndex]) : '';
    
    if (!name) return null;

    // Extract all performance data
    const finalEquity = equityIndex !== -1 ? this.parseNumber(cellValues[equityIndex]) : 0;
    const probabilityWin = probWinIndex !== -1 ? this.parseNumber(cellValues[probWinIndex]) : 0;
    const returnYTD = ytdIndex !== -1 ? this.parseNumber(cellValues[ytdIndex]) : 0;
    const return1Month = ret1mIndex !== -1 ? this.parseNumber(cellValues[ret1mIndex]) : 0;
    const return3Month = ret3mIndex !== -1 ? this.parseNumber(cellValues[ret3mIndex]) : 0;
    const return6Month = ret6mIndex !== -1 ? this.parseNumber(cellValues[ret6mIndex]) : 0;
    const return12Month = ret12mIndex !== -1 ? this.parseNumber(cellValues[ret12mIndex]) : 0;
    const tradesYTD = tradesIndex !== -1 ? parseInt(cellValues[tradesIndex]) || 0 : 0;
    const maxDrawdown = maxDDIndex !== -1 ? this.parseNumber(cellValues[maxDDIndex]) : 0;
    const currentDrawdown = curDDIndex !== -1 ? this.parseNumber(cellValues[curDDIndex]) : 0;
    const sharpeRatio = sharpeIndex !== -1 ? this.parseNumber(cellValues[sharpeIndex]) : 0;
    const cagr = cagrIndex !== -1 ? this.parseNumber(cellValues[cagrIndex]) : 0;
    const volatility = stdIndex !== -1 ? this.parseNumber(cellValues[stdIndex]) : 0;
    const portfolio = portfolioIndex !== -1 ? cellValues[portfolioIndex] : '';
    const mlAccuracies = mlIndex !== -1 ? cellValues[mlIndex] : '';

    // Extract green holdings (new trades) from portfolio cell
    const greenHoldings = portfolioIndex !== -1 ? 
      this.extractGreenHoldings(cells.eq(portfolioIndex), $) : [];

    return {
      symbol: name.replace(/^\d+\.\s*/, ''), // Remove number prefix for symbol
      name: name,
      quantity: 1, // Use 1 for performance data
      price: finalEquity,
      value: finalEquity,
      dayChange: 0, // Not available in this data
      dayChangePercent: returnYTD,
      performance: {
        finalEquity,
        probabilityWin,
        returnYTD,
        return1Month,
        return3Month,
        return6Month,
        return12Month,
        tradesYTD,
        maxDrawdown,
        currentDrawdown,
        sharpeRatio,
        cagr,
        volatility,
        portfolio,
        mlAccuracies,
        greenHoldings
      }
    };
  }

  private findHeaderIndex(headers: string[], searchTerms: string[]): number {
    for (const term of searchTerms) {
      const index = headers.findIndex(header => header.includes(term));
      if (index !== -1) return index;
    }
    return -1;
  }

  private extractAccountInfo($: cheerio.CheerioAPI): { name: string; number: string } {
    let name = '';
    let number = '';

    // Look for account information in common locations
    const accountPattern = /account[:\s]*([^\n\r<]+)/i;
    const numberPattern = /account\s*(?:number|#)[:\s]*([0-9\-*]+)/i;

    const text = $.text();
    const accountMatch = text.match(accountPattern);
    const numberMatch = text.match(numberPattern);

    if (accountMatch) name = accountMatch[1].trim();
    if (numberMatch) number = numberMatch[1].trim();

    return { name, number };
  }

  private extractHoldings($: cheerio.CheerioAPI): Holding[] {
    // Implementation would go here - similar to parseHoldingsTable
    return [];
  }

  private extractSummary($: cheerio.CheerioAPI): { totalValue: number; dayChange: number; dayChangePercent: number } {
    const text = $.text();
    
    // Look for total portfolio value patterns
    const totalPattern = /total\s*(?:value|portfolio)[:\s]*\$?([0-9,]+(?:\.[0-9]{2})?)/i;
    const changePattern = /(?:day|daily)\s*change[:\s]*\$?([+-]?[0-9,]+(?:\.[0-9]{2})?)/i;
    const percentPattern = /(?:day|daily)\s*change[:\s]*[^%]*([+-]?[0-9.]+)%/i;

    const totalMatch = text.match(totalPattern);
    const changeMatch = text.match(changePattern);
    const percentMatch = text.match(percentPattern);

    return {
      totalValue: totalMatch ? this.parseNumber(totalMatch[1]) : 0,
      dayChange: changeMatch ? this.parseNumber(changeMatch[1]) : 0,
      dayChangePercent: percentMatch ? parseFloat(percentMatch[1]) : 0,
    };
  }

  private extractPotentialHoldings(table: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): Holding[] {
    // Simplified extraction for unknown table formats
    const holdings: Holding[] = [];
    const rows = table.find('tr');

    for (let i = 1; i < rows.length; i++) {
      const row = $(rows[i]);
      const cells = row.find('td');
      if (cells.length >= 3) {
        const cellTexts = cells.map((_, el) => $(el).text().trim()).get();
        
        // Try to identify symbol, quantity, and value columns
        const potentialHolding = this.guessCellMeaning(cellTexts);
        if (potentialHolding) {
          holdings.push(potentialHolding);
        }
      }
    }

    return holdings;
  }

  private guessCellMeaning(cells: string[]): Holding | null {
    // Simple heuristics to guess what each cell contains
    let symbol = '';
    let quantity = 0;
    let value = 0;
    let price = 0;

    for (const cell of cells) {
      if (this.looksLikeSymbol(cell)) {
        symbol = cell;
      } else if (this.looksLikeQuantity(cell)) {
        quantity = this.parseNumber(cell);
      } else if (this.looksLikePrice(cell) && price === 0) {
        price = this.parseNumber(cell);
      } else if (this.looksLikeValue(cell)) {
        value = this.parseNumber(cell);
      }
    }

    if (symbol && (quantity > 0 || value > 0)) {
      return {
        symbol,
        name: symbol,
        quantity,
        price,
        value,
        dayChange: 0,
        dayChangePercent: 0,
      };
    }

    return null;
  }

  private looksLikeSymbol(text: string): boolean {
    return /^[A-Z]{1,5}$/.test(text.trim());
  }

  private looksLikeQuantity(text: string): boolean {
    const num = this.parseNumber(text);
    return num > 0 && num < 1000000 && !text.includes('$') && !text.includes('%');
  }

  private looksLikePrice(text: string): boolean {
    return text.includes('$') || (/^[0-9]+\.[0-9]{2}$/.test(text) && this.parseNumber(text) < 10000);
  }

  private looksLikeValue(text: string): boolean {
    return text.includes('$') && this.parseNumber(text) > 100;
  }

  private findAccountName($: cheerio.CheerioAPI): string | null {
    const patterns = [
      /account\s*name[:\s]*([^\n\r<]+)/i,
      /portfolio[:\s]*([^\n\r<]+)/i,
    ];

    const text = $.text();
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return null;
  }

  private findAccountNumber($: cheerio.CheerioAPI): string | null {
    const pattern = /account\s*(?:number|#)[:\s]*([0-9\-*]+)/i;
    const match = $.text().match(pattern);
    return match ? match[1].trim() : null;
  }

  private parseNumber(value: string): number {
    if (!value) return 0;
    
    // Remove currency symbols, commas, and parentheses
    const cleaned = value.replace(/[$,()]/g, '').trim();
    
    // Handle negative values (sometimes in parentheses)
    const isNegative = value.includes('(') || cleaned.startsWith('-');
    
    const num = parseFloat(cleaned.replace(/[^0-9.-]/g, ''));
    return isNegative ? -Math.abs(num) : num || 0;
  }

  private parseEmailDate(dateString: string): string {
    try {
      return new Date(dateString).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  private calculateTotalValue(holdings: Holding[]): number {
    return holdings.reduce((sum, holding) => sum + holding.value, 0);
  }

  private calculateTotalDayChange(holdings: Holding[]): number {
    return holdings.reduce((sum, holding) => sum + holding.dayChange, 0);
  }

  private calculateTotalDayChangePercent(holdings: Holding[]): number {
    const totalValue = this.calculateTotalValue(holdings);
    const totalChange = this.calculateTotalDayChange(holdings);
    return totalValue > 0 ? (totalChange / (totalValue - totalChange)) * 100 : 0;
  }

  /**
   * Parse ALL tables in the email and filter holdings by allowed model names
   */
  private parseAllTables($: cheerio.CheerioAPI, allowedModels: string[]): PortfolioData[] {
    const portfolioDataArray: PortfolioData[] = [];
    const tables = $('table');
    
    console.log(`Found ${tables.length} tables to parse`);

    for (let i = 0; i < tables.length; i++) {
      const table = $(tables[i]);
      const rows = table.find('tr');
      
      if (rows.length < 2) {
        console.log(`Skipping table ${i}: insufficient rows (${rows.length})`);
        continue; // Skip tables with insufficient data
      }

      // Try to identify if this is a holdings table
      const headerRow = $(rows[0]);
      const headers = this.extractHeaders(headerRow);
      
      console.log(`Table ${i} headers:`, headers);

      // Check if this looks like a holdings table OR portfolio performance table
      if (this.isHoldingsTable(headers.join(' ')) || this.isPortfolioPerformanceTable(headers.join(' '))) {
        console.log(`Table ${i} appears to be a holdings table`);
        
        // Find the "Name" column index for filtering
        const nameIndex = this.findHeaderIndex(headers, ['name', 'model', 'fund name', 'security name']);
        
        if (nameIndex === -1) {
          console.log(`Table ${i}: No "Name" column found, skipping filtering`);
          continue;
        }

        console.log(`Table ${i}: Found "Name" column at index ${nameIndex}`);

        // Parse holdings from this table
        const filteredHoldings: Holding[] = [];
        
        for (let j = 1; j < rows.length; j++) {
          const row = $(rows[j]);
          const cells = row.find('td, th');
          
          if (cells.length === 0) continue;
          
          const cellValues = cells.map((_, el) => $(el).text().trim()).get();
          
          if (cellValues.length <= nameIndex) {
            console.log(`Table ${i}, row ${j}: insufficient cells for name column`);
            continue;
          }

          // Decode HTML entities in model name
          const rawModelName = cellValues[nameIndex];
          const modelName = this.decodeHtmlEntities(rawModelName);
          console.log(`Table ${i}, row ${j}: checking model "${modelName}" against allowed models`);
          
          // Check if this model name matches any of the allowed models
          // If allowedModels is empty, allow all models
          const isAllowedModel = allowedModels.length === 0 || allowedModels.some(allowedModel => 
            this.modelsMatch(modelName, allowedModel)
          );

          if (isAllowedModel) {
            console.log(`✓ Model "${modelName}" matches allowed models`);
            const holding = this.parseHoldingRow(cells, headers, $);
            if (holding) {
              filteredHoldings.push(holding);
            } else {
              // If traditional holding parsing failed, try performance data parsing
              const performanceHolding = this.parsePerformanceRow(cells, headers, $);
              if (performanceHolding) {
                filteredHoldings.push(performanceHolding);
              }
            }
          } else {
            console.log(`✗ Model "${modelName}" not in allowed models`);
          }
        }

        if (filteredHoldings.length > 0) {
          console.log(`Table ${i}: Found ${filteredHoldings.length} filtered holdings`);
          
          // Create portfolio data for this table's filtered holdings
          const portfolioData: PortfolioData = {
            accountName: this.findAccountName($) || `Table ${i + 1}`,
            accountNumber: this.findAccountNumber($) || `table-${i}`,
            holdings: filteredHoldings,
            totalValue: this.calculateTotalValue(filteredHoldings),
            dayChange: this.calculateTotalDayChange(filteredHoldings),
            dayChangePercent: this.calculateTotalDayChangePercent(filteredHoldings),
            date: '',
          };

          portfolioDataArray.push(portfolioData);
        } else {
          console.log(`Table ${i}: No matching holdings found after filtering`);
        }
      } else {
        console.log(`Table ${i}: Does not appear to be a holdings table`);
      }
    }

    return portfolioDataArray;
  }

  /**
   * Decode HTML entities in text
   */
  private decodeHtmlEntities(text: string): string {
    if (!text) return text;
    
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Extract holdings that appear in green text (indicating new trades)
   */
  private extractGreenHoldings(cell: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string[] {
    const greenHoldings: string[] = [];
    
    try {
      // Look for elements with green color styling
      const greenElements = cell.find('*').filter((_, el) => {
        const element = $(el);
        const style = element.attr('style') || '';
        const color = element.css('color') || '';
        
        // Check for green color in various formats
        return (
          style.includes('color:green') ||
          style.includes('color: green') ||
          style.includes('color:#00ff00') ||
          style.includes('color: #00ff00') ||
          style.includes('color:#008000') ||
          style.includes('color: #008000') ||
          color.toLowerCase().includes('green')
        );
      });

      // Extract text from green elements
      greenElements.each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          // Parse holdings format like "NVDA (22%)" or "AVGO (39%)"
          const holdingMatches = text.match(/([A-Z\.]+)\s*\((\d+%)\)/g);
          if (holdingMatches) {
            holdingMatches.forEach(match => {
              greenHoldings.push(match.trim());
            });
          } else if (text.length > 0) {
            // Fallback for any green text
            greenHoldings.push(text);
          }
        }
      });

      // Also check the cell itself for green styling
      const cellStyle = cell.attr('style') || '';
      const cellColor = cell.css('color') || '';
      
      if (cellStyle.includes('color:green') || 
          cellStyle.includes('color: green') ||
          cellColor.toLowerCase().includes('green')) {
        const cellText = cell.text().trim();
        if (cellText) {
          const holdingMatches = cellText.match(/([A-Z\.]+)\s*\((\d+%)\)/g);
          if (holdingMatches) {
            holdingMatches.forEach(match => {
              if (!greenHoldings.includes(match.trim())) {
                greenHoldings.push(match.trim());
              }
            });
          }
        }
      }

    } catch (error) {
      console.warn('Error extracting green holdings:', error);
    }

    return greenHoldings;
  }

  /**
   * Check if two model names match (with some fuzzy matching)
   */
  private modelsMatch(emailModel: string, sheetModel: string): boolean {
    if (!emailModel || !sheetModel) return false;
    
    // Exact match (case insensitive)
    if (emailModel.toLowerCase() === sheetModel.toLowerCase()) {
      return true;
    }
    
    // Check if sheet model is contained in email model (for cases like "1. Glen S&P 100" in sheet vs "Glen S&P 100" in email)
    if (emailModel.toLowerCase().includes(sheetModel.toLowerCase()) || 
        sheetModel.toLowerCase().includes(emailModel.toLowerCase())) {
      return true;
    }
    
    // Remove common prefixes/suffixes and try again
    const cleanEmailModel = emailModel.replace(/^\d+\.\s*/, '').trim(); // Remove "1. " prefix
    const cleanSheetModel = sheetModel.replace(/^\d+\.\s*/, '').trim(); // Remove "1. " prefix
    
    if (cleanEmailModel.toLowerCase() === cleanSheetModel.toLowerCase()) {
      return true;
    }
    
    return false;
  }
}