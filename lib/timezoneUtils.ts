// Timezone utility to fix timestamp generation issues
export class TimezoneUtils {
  private static readonly EST_TIMEZONE = 'America/New_York';
  
  /**
   * Get current time in Eastern Time (EST/EDT)
   * This ensures consistent timezone handling across the application
   */
  static getCurrentEST(): Date {
    return new Date(new Date().toLocaleString("en-US", {timeZone: TimezoneUtils.EST_TIMEZONE}));
  }
  
  /**
   * Format current time as locale string in EST
   * Used for "Generated on" timestamps in emails
   */
  static getCurrentESTString(): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: TimezoneUtils.EST_TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    
    return new Date().toLocaleString('en-US', options);
  }
  
  /**
   * Get current date in EST as YYYY-MM-DD format
   * Used for date-based operations and file naming
   */
  static getCurrentESTDateString(): string {
    const est = TimezoneUtils.getCurrentEST();
    return est.toISOString().split('T')[0];
  }
  
  /**
   * Format a specific date/time for EST display
   */
  static formatDateEST(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: TimezoneUtils.EST_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };
    
    return date.toLocaleString('en-US', options);
  }
  
  /**
   * Get simple date string for email subjects
   */
  static getDateStringEST(): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: TimezoneUtils.EST_TIMEZONE,
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    };
    
    return new Date().toLocaleDateString('en-US', options);
  }
  
  /**
   * Validate that the current time is within expected business hours
   * Prevents execution at wrong times due to timezone issues
   */
  static isBusinessHours(): boolean {
    const est = TimezoneUtils.getCurrentEST();
    const hour = est.getHours();
    
    // Business hours: 6 AM to 6 PM EST
    return hour >= 6 && hour <= 18;
  }
  
  /**
   * Log current time information for debugging
   */
  static logTimezoneDebug(): void {
    const systemTime = new Date();
    const estTime = TimezoneUtils.getCurrentEST();
    
    console.log('=== TIMEZONE DEBUG ===');
    console.log('System Time:', systemTime.toISOString());
    console.log('EST Time:', TimezoneUtils.getCurrentESTString());
    console.log('EST Date:', TimezoneUtils.getCurrentESTDateString());
    console.log('Business Hours:', TimezoneUtils.isBusinessHours());
    console.log('=====================');
  }
}