/**
 * Converts a snake_case string to Title Case with spaces.
 * e.g. "plan_upgrade_with_conditions" → "Plan Upgrade With Conditions"
 */
export function formatLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
