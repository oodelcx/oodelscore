/** Client-safe: picks the colleague wording for a key, or the customer text. */
export function makeWording(isColleague: boolean, wording?: Record<string, string> | null) {
  return (key: string, customerText: string): string => (isColleague ? wording?.[key] || customerText : customerText);
}
