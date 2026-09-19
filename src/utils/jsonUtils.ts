/**
 * Cycle-safe JSON stringify utility function to prevent
 * "TypeError: JSON.stringify cannot serialize cyclic structures"
 */
export function safeJsonStringify(obj: any, indent?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return undefined; // Omit circular reference
        }
        seen.add(value);
      }
      return value;
    },
    indent
  );
}
