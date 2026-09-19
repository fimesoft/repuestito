interface ApiErrorPayload {
  statusCode: number;
  code?: string;
  message?: string | string[];
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Correo electrónico o contraseña incorrectos',
  EMAIL_NOT_VERIFIED: 'Debes verificar tu correo antes de ingresar',
  RATE_LIMIT_EXCEEDED: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
  INSUFFICIENT_PERMISSIONS: 'No tenés permisos para esta acción',
  TENANT_ALREADY_ASSIGNED: 'Tu usuario ya tiene un local asignado',
  TENANT_REQUIRED: 'Tu usuario no tiene un local asignado',
  TENANT_CONFIG_INVALID_RANGE: 'El stock bajo debe ser menor que el stock normal',
  BRAND_CONFLICT: 'Esa marca ya existe',
  BRAND_NOT_FOUND: 'La marca no existe',
  BRAND_HAS_REPLACEMENTS: 'No se puede eliminar: la marca tiene productos asociados',
  BRAND_INVALID_NAME: 'El nombre de la marca no es válido',
  REPLACEMENT_IMAGE_SHARED: 'La imagen actual la comparten otros locales: solo un administrador puede reemplazarla',
  PRODUCT_TYPE_CONFLICT: 'Ese tipo de producto ya existe',
  PRODUCT_TYPE_NOT_FOUND: 'El tipo de producto no existe o está desactivado',
  PRODUCT_TYPE_INVALID_NAME: 'El nombre del tipo de producto no es válido',
  PRODUCT_TYPE_IS_SYSTEM: 'Es un tipo del sistema y no se puede modificar',
  PRODUCT_TYPE_HAS_PRODUCTS: 'No se puede eliminar: el tipo tiene productos. Fusiónalo en otro tipo.',
  PRODUCT_TYPE_HAS_COMPATIBILITIES: 'Hay productos de este tipo con compatibilidades vehiculares cargadas',
  PRODUCT_TYPE_COMPATIBILITY_NOT_SUPPORTED: 'Este tipo de producto no admite compatibilidad vehicular',
};

function isApiErrorPayload(data: unknown): data is ApiErrorPayload {
  return typeof data === 'object' && data !== null && 'statusCode' in data;
}

export function getApiErrorCode(data: unknown): string | undefined {
  return isApiErrorPayload(data) ? data.code : undefined;
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

/** 409 que trae el registro ya existente (`existing`), para poder ofrecer "usar el existente". */
export class ConflictError<T = unknown> extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly existing: T,
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

/** Convierte una respuesta no exitosa en un Error con mensaje en español (o ConflictError si trae `existing`). */
export async function throwApiError<T = unknown>(res: Response, fallback: string): Promise<never> {
  const body: unknown = await res.json().catch(() => null);
  const message = translateApiError(body, fallback);
  if (res.status === 409 && typeof body === 'object' && body !== null && 'existing' in body) {
    throw new ConflictError<T>(message, getApiErrorCode(body), (body as { existing: T }).existing);
  }
  throw new Error(message);
}
