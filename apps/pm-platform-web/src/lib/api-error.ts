export type FieldErrors = Record<string, string>;

export function getApiErrorMessage(error: unknown, fallback = 'Action failed. Please try again.') {
  const anyError = error as any;
  const response = anyError?.response?.data;
  const backendError = response?.error;
  if (backendError?.message) return String(backendError.message);
  if (response?.message) return String(response.message);
  if (anyError?.message) return String(anyError.message);
  if (anyError?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check the connection and try again.';
  if (anyError?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return fallback;
}

export function fieldKeyFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_');
}
export function isValidEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }
export function isValidFieldKey(key: string) { return /^[a-z][a-z0-9_]*$/.test(key.trim()); }
