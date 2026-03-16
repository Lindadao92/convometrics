# Convometrics Timestamp Bug Fixes

## Bug 1: Date Calculation in conversations/route.ts

**Location:** `/Users/linda/convometrics/dashboard/src/app/api/conversations/route.ts` (line ~56)

**Problem:** The current date calculation can fail when crossing month boundaries:
```typescript
const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
```

When `now.getDate() - days` becomes negative or zero, the Date constructor behaves unpredictably.

**Fix:** Replace with millisecond-based calculation:
```typescript
// Calculate cutoff at start of day (00:00:00) for consistent timezone handling
// Fixed: Use millisecond subtraction instead of date component math for proper month/year boundary handling
const now = new Date();
const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
// Set to start of day for consistent filtering
cutoffDate.setHours(0, 0, 0, 0);
const cutoff = cutoffDate.getTime();
```

## Bug 2: Custom Range Validation in time-range-context.tsx

**Location:** `/Users/linda/convometrics/dashboard/src/lib/time-range-context.tsx` (line ~53)

**Problem:** The setCustomRange function doesn't validate that `from` comes before `to`:
```typescript
function setCustomRange(from: string, to: string) {
  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  const days = Math.max(1, Math.ceil(diffMs / 86400000));
  persist({ preset: "custom", days, customFrom: from, customTo: to });
}
```

If user selects dates in wrong order, this creates negative time differences.

**Fix:** Add validation:
```typescript
function setCustomRange(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  // Validate dates
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    console.warn('Invalid date format in custom range');
    return;
  }
  
  // Ensure from is before to (swap if needed)
  if (fromDate.getTime() > toDate.getTime()) {
    [from, to] = [to, from];
  }
  
  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  const days = Math.max(1, Math.ceil(diffMs / 86400000));
  persist({ preset: "custom", days, customFrom: from, customTo: to });
}
```

## Impact

These fixes will:
1. **Prevent crashes** when filtering conversations across month boundaries
2. **Handle edge cases** like Feb 29th, month ends, year boundaries properly  
3. **Improve UX** by auto-correcting reversed date ranges
4. **Eliminate console errors** from invalid timestamp calculations

## Priority: HIGH
These bugs affect core dashboard functionality and data filtering accuracy.