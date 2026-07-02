export type FieldErrors = Record<string, string>;

function readableKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_.-]+/g, ' ')
    .replace(/^./, (ch) => ch.toUpperCase())
    .trim();
}

function flattenDetails(details: unknown): string[] {
  if (!details) return [];

  if (typeof details === 'string') return [details];

  if (Array.isArray(details)) {
    return details.flatMap((item) => flattenDetails(item));
  }

  if (typeof details === 'object') {
    const obj = details as Record<string, unknown>;

    if (typeof obj.message === 'string') {
      const field = typeof obj.field === 'string' ? `${readableKey(obj.field)}: ` : '';
      return [`${field}${obj.message}`];
    }

    return Object.entries(obj).flatMap(([key, value]) => {
      if (typeof value === 'string') return [`${readableKey(key)}: ${value}`];
      if (Array.isArray(value)) return value.map((v) => `${readableKey(key)}: ${String(v)}`);
      if (value && typeof value === 'object') return flattenDetails(value).map((v) => `${readableKey(key)}: ${v}`);
      return [];
    });
  }

  return [];
}

export function getApiErrorMessage(error: unknown, fallback = 'Action failed. Please try again.') {
  const anyError = error as any;
  const responseData = anyError?.response?.data;
  const backendError = responseData?.error;

  if (backendError) {
    const details = flattenDetails(backendError.details);
    if (details.length) return details.join('\n');
    if (backendError.message) return backendError.message;
    if (backendError.code) return backendError.code;
  }

  if (responseData?.message) return responseData.message;
  if (anyError?.message && anyError.message !== 'API request failed') return anyError.message;

  if (anyError?.code === 'ERR_NETWORK') return 'Cannot reach the server. Please check your connection and try again.';
  if (anyError?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';

  return fallback;
}

export function fieldKeyFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, 'field_$1');
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidFieldKey(key: string) {
  return /^[a-z][a-z0-9_]*$/.test(key.trim());
}
