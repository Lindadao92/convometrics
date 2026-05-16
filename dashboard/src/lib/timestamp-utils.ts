/**
 * Timestamp utility functions to replace problematic date calculations
 * Addresses issues with month boundary calculations mentioned in memory
 */

/**
 * Get timestamp cutoff for the last N days
 * Uses millisecond math to avoid month boundary issues
 * @param days Number of days to look back
 * @returns Timestamp in milliseconds
 */
export function getDaysCutoff(days: number): number {
  return Date.now() - (days * 24 * 60 * 60 * 1000);
}

/**
 * Get timestamp cutoff for the last N hours
 * @param hours Number of hours to look back
 * @returns Timestamp in milliseconds
 */
export function getHoursCutoff(hours: number): number {
  return Date.now() - (hours * 60 * 60 * 1000);
}

/**
 * Get start and end timestamps for a specific time period
 * @param period 'today' | 'yesterday' | 'week' | 'month'
 * @returns Object with start and end timestamps
 */
export function getPeriodTimestamps(period: 'today' | 'yesterday' | 'week' | 'month'): {
  start: number;
  end: number;
} {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  switch (period) {
    case 'today':
      return {
        start: startOfToday,
        end: Date.now()
      };
    
    case 'yesterday':
      const oneDayMs = 24 * 60 * 60 * 1000;
      return {
        start: startOfToday - oneDayMs,
        end: startOfToday
      };
    
    case 'week':
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      return {
        start: startOfToday - oneWeekMs,
        end: Date.now()
      };
    
    case 'month':
      // Use actual month calculation for month boundaries
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return {
        start: startOfMonth,
        end: Date.now()
      };
    
    default:
      return {
        start: startOfToday,
        end: Date.now()
      };
  }
}

/**
 * Format timestamp for display
 * @param timestamp Timestamp in milliseconds
 * @param format 'short' | 'long' | 'date' | 'time'
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: number, format: 'short' | 'long' | 'date' | 'time' = 'short'): string {
  const date = new Date(timestamp);
  
  switch (format) {
    case 'short':
      return date.toLocaleDateString();
    
    case 'long':
      return date.toLocaleString();
    
    case 'date':
      return date.toDateString();
    
    case 'time':
      return date.toLocaleTimeString();
    
    default:
      return date.toLocaleDateString();
  }
}

/**
 * Check if a timestamp is within the last N days
 * @param timestamp Timestamp to check
 * @param days Number of days to check within
 * @returns Boolean indicating if timestamp is recent
 */
export function isWithinDays(timestamp: number, days: number): boolean {
  const cutoff = getDaysCutoff(days);
  return timestamp >= cutoff;
}

/**
 * Get relative time description
 * @param timestamp Timestamp to describe
 * @returns Human-readable relative time string
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return formatTimestamp(timestamp, 'date');
  }
}