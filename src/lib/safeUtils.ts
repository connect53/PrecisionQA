/**
 * PrecisionQA Null-Safety Shared Helper Functions
 * These helpers guarantee that the application never crashes due to null or undefined values,
 * and provide robust fallbacks for strings, arrays, numbers, and initials.
 */

/**
 * Extracts the first uppercase letter or character of a string safely.
 * Returns "?" or a designated fallback if the value is empty, null, or undefined.
 */
export function getInitial(value: any, fallback: string = "?"): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  const str = String(value).trim();
  if (str.length === 0) {
    return fallback;
  }
  return str.charAt(0).toUpperCase();
}

/**
 * Ensures any value is safely converted to a string.
 * Returns an empty string "" (or a custom fallback) if null or undefined.
 */
export function safeString(value: any, fallback: string = ""): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

/**
 * Guarantees a value is a valid array.
 * If the value is null, undefined, or not an array, it returns an empty array [].
 */
export function safeArray<T>(value: any): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

/**
 * Ensures a value is converted safely to a number.
 * Returns 0 (or a custom fallback) if the conversion results in NaN, null, or undefined.
 */
export function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? fallback : value;
  }
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}
