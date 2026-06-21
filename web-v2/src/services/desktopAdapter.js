/**
 * Desktop adapter — wraps window.electronAPI to look like an axios response.
 * Used by Redux slices when running inside Electron (window.electronAPI.isDesktop === true).
 *
 * Usage in a slice:
 *   import { isDesktop, desktopDb } from '../services/desktopAdapter';
 *   if (isDesktop) { ... use desktopDb ... } else { ... use api ... }
 */

export const isDesktop = typeof window !== 'undefined' && !!window.electronAPI?.isDesktop;

const ea = () => window.electronAPI;

export const desktopDb = {
  /**
   * Run a SELECT and return rows array (throws on error).
   */
  async all(sql, params = []) {
    const result = await ea().db.all(sql, params);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  /**
   * Run a single-row SELECT; returns the row or null.
   */
  async get(sql, params = []) {
    const rows = await desktopDb.all(sql, params);
    return rows[0] ?? null;
  },

  /**
   * Run an INSERT/UPDATE/DELETE; returns { changes, lastInsertRowid }.
   */
  async run(sql, params = []) {
    const result = await ea().db.execute(sql, params);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
};

/**
 * Wrap a desktop result in an axios-compatible response shape so
 * existing Redux extraReducers (`action.payload.data`) still work.
 */
export function toApiResponse(data) {
  return { data: { success: true, data } };
}
