/**
 * Formats a Date as a calendar date in the user's local timezone.
 *
 * Do not replace this with `toISOString().slice(0, 10)`: ISO strings are UTC
 * and therefore point at the previous day in China between midnight and 08:00.
 */
export function localDateString(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateAfter(days: number, value = new Date()) {
  const next = new Date(value);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return localDateString(next);
}
