// "15 ago. 2026"
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// "15/08/26, 03:30 p.m."
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: true,
  });
}

// "15 de agosto de 2026"
export function formatDateLong(value: string | Date): string {
  return new Date(value).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// "15:30"
export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
