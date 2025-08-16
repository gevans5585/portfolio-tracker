import { CombinedAccountPortfolio } from './combinedAccountService';
import { ModelWatchListData } from './modelWatchListService';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface PortfolioCache {
  combinedAccounts?: CacheEntry<CombinedAccountPortfolio[]>;
  modelWatchList?: CacheEntry<ModelWatchListData>;
  lastEmailFetch?: CacheEntry<Date>;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly EMAIL_TTL = 60 * 60 * 1000; // 1 hour for email data

  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      console.log(`Cache miss for key: ${key}`);
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      console.log(`Cache expired for key: ${key}`);
      this.cache.delete(key);
      return null;
    }

    console.log(`Cache hit for key: ${key}`);
    return entry.data;
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const cacheTTL = ttl || this.DEFAULT_TTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + cacheTTL
    };

    this.cache.set(key, entry);
    console.log(`Cached data for key: ${key}, expires in ${cacheTTL / 1000}s`);
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
    console.log(`Cleared cache for key: ${key}`);
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
    console.log('Cleared all cache');
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Check if cache has valid data for key
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && Date.now() <= entry.expiresAt;
  }

  // Specialized methods for portfolio data
  getCombinedAccounts(date: string): CombinedAccountPortfolio[] | null {
    return this.get<CombinedAccountPortfolio[]>(`combined-accounts-${date}`);
  }

  setCombinedAccounts(date: string, data: CombinedAccountPortfolio[]): void {
    this.set(`combined-accounts-${date}`, data, this.EMAIL_TTL);
  }

  getModelWatchList(date: string): ModelWatchListData | null {
    return this.get<ModelWatchListData>(`model-watch-list-${date}`);
  }

  setModelWatchList(date: string, data: ModelWatchListData): void {
    this.set(`model-watch-list-${date}`, data, this.EMAIL_TTL);
  }

  // Check if we've already fetched emails today
  hasEmailDataForDate(date: string): boolean {
    return this.has(`email-data-${date}`);
  }

  setEmailDataFetched(date: string): void {
    this.set(`email-data-${date}`, true, this.EMAIL_TTL);
  }
}

// Create a singleton instance
const cacheService = new CacheService();
export default cacheService;