/**
 * Business day utilities for handling trading days vs weekends/holidays
 */

export class BusinessDayUtils {
  // List of market holidays (add more as needed)
  private static readonly MARKET_HOLIDAYS = [
    // 2024 US Market Holidays
    '2024-01-01', // New Year's Day
    '2024-01-15', // Martin Luther King Jr. Day
    '2024-02-19', // Presidents Day
    '2024-03-29', // Good Friday
    '2024-05-27', // Memorial Day
    '2024-06-19', // Juneteenth
    '2024-07-04', // Independence Day
    '2024-09-02', // Labor Day
    '2024-11-28', // Thanksgiving
    '2024-11-29', // Day after Thanksgiving
    '2024-12-25', // Christmas Day
    
    // 2025 US Market Holidays
    '2025-01-01', // New Year's Day
    '2025-01-20', // Martin Luther King Jr. Day
    '2025-02-17', // Presidents Day
    '2025-04-18', // Good Friday
    '2025-05-26', // Memorial Day
    '2025-06-19', // Juneteenth
    '2025-07-04', // Independence Day
    '2025-09-01', // Labor Day
    '2025-11-27', // Thanksgiving
    '2025-11-28', // Day after Thanksgiving
    '2025-12-25', // Christmas Day
  ];

  /**
   * Check if a date is a trading day (weekday and not a holiday)
   */
  static isTradingDay(dateStr: string): boolean {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Check if it's a weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Check if it's a market holiday
    if (this.MARKET_HOLIDAYS.includes(dateStr)) {
      return false;
    }
    
    return true;
  }

  /**
   * Get the previous trading day from a given date
   */
  static getPreviousTradingDay(dateStr: string): string {
    let currentDate = new Date(dateStr);
    
    // Go back one day at a time until we find a trading day
    do {
      currentDate.setDate(currentDate.getDate() - 1);
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      if (this.isTradingDay(currentDateStr)) {
        return currentDateStr;
      }
    } while (true);
  }

  /**
   * Get the next trading day from a given date
   */
  static getNextTradingDay(dateStr: string): string {
    let currentDate = new Date(dateStr);
    
    // Go forward one day at a time until we find a trading day
    do {
      currentDate.setDate(currentDate.getDate() + 1);
      const currentDateStr = currentDate.toISOString().split('T')[0];
      
      if (this.isTradingDay(currentDateStr)) {
        return currentDateStr;
      }
    } while (true);
  }

  /**
   * Check if we should calculate changes between two dates
   * Returns false if either date is not a trading day or if they're not consecutive trading days
   */
  static shouldCalculateChanges(todayStr: string, yesterdayStr: string): boolean {
    // Both dates must be trading days
    if (!this.isTradingDay(todayStr) || !this.isTradingDay(yesterdayStr)) {
      return false;
    }

    // Yesterday should be the immediate previous trading day
    const expectedYesterday = this.getPreviousTradingDay(todayStr);
    return yesterdayStr === expectedYesterday;
  }

  /**
   * Get a human-readable reason why changes shouldn't be calculated
   */
  static getNoChangeReason(dateStr: string): string {
    if (!this.isTradingDay(dateStr)) {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return 'Markets closed - Weekend';
      } else {
        return 'Markets closed - Holiday';
      }
    }
    
    const previousTradingDay = this.getPreviousTradingDay(dateStr);
    const daysDiff = this.calculateDaysDifference(previousTradingDay, dateStr);
    
    if (daysDiff > 3) {
      return `Markets closed - ${daysDiff} day gap since last trading day`;
    }
    
    return 'First trading day comparison';
  }

  /**
   * Calculate the number of calendar days between two dates
   */
  private static calculateDaysDifference(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if today is a day when the cron job should run (trading days only)
   */
  static shouldSendDailyEmail(dateStr?: string): boolean {
    const today = dateStr || new Date().toISOString().split('T')[0];
    return this.isTradingDay(today);
  }

  /**
   * Get a list of the next N trading days (useful for testing)
   */
  static getNextTradingDays(startDate: string, count: number): string[] {
    const tradingDays: string[] = [];
    let currentDate = startDate;
    
    for (let i = 0; i < count; i++) {
      currentDate = this.getNextTradingDay(currentDate);
      tradingDays.push(currentDate);
    }
    
    return tradingDays;
  }
}