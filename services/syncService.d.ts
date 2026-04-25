export function createMouvement(data: Record<string, unknown>): Promise<Record<string, unknown>>;
export function syncFromAPI(): Promise<Record<string, unknown>>;
export function getStocks(): Promise<{ ok: boolean; data: Record<string, unknown>[]; error?: string }>;
export function flushQueue(options?: { limit?: number }): Promise<Record<string, unknown>>;
export function syncOnNetworkBack(): Promise<Record<string, unknown>>;
