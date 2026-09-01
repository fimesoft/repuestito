interface ApiErrorPayload {
  statusCode: number;
  code?: string;
  message?: string | string[];
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Correo electrónico o contraseña incorrectos',
  RATE_LIMIT_EXCEEDED: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
  INSUFFICIENT_PERMISSIONS: 'No tenés permisos para esta acción',
  TENANT_ALREADY_ASSIGNED: 'Tu usuario ya tiene un local asignado',
};

function isApiErrorPayload(data: unknown): data is ApiErrorPayload {
  return typeof data === 'object' && data !== null && 'statusCode' in data;
}

export function translateApiError(data: unknown, fallback = 'Error inesperado'): string {
  if (!isApiErrorPayload(data)) return fallback;

  if (data.code && ERROR_MESSAGES[data.code]) {
    return ERROR_MESSAGES[data.code];
  }
  if (typeof data.message === 'string') return data.message;
  if (Array.isArray(data.message) && data.message.length > 0) return data.message[0];
  return fallback;
}
