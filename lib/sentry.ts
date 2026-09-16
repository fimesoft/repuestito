import type { Breadcrumb, Event } from '@sentry/nextjs';

function withoutQuery(value: string): string {
  try {
    const url = new URL(value, 'http://localhost');
    return url.origin === 'http://localhost'
      ? url.pathname
      : `${url.origin}${url.pathname}`;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

export function sanitizeSentryEvent<T extends Event>(event: T): T {
  if (event.request) {
    event.request.url = event.request.url
      ? withoutQuery(event.request.url)
      : undefined;
    event.request.cookies = undefined;
    event.request.data = undefined;
    event.request.headers = undefined;
  }

  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  event.breadcrumbs = event.breadcrumbs?.flatMap(breadcrumb => {
    const sanitized = sanitizeSentryBreadcrumb(breadcrumb);
    return sanitized ? [sanitized] : [];
  });
  return event;
}

export function sanitizeSentryBreadcrumb(
  breadcrumb: Breadcrumb,
): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;

  if (breadcrumb.data?.url && typeof breadcrumb.data.url === 'string') {
    return {
      ...breadcrumb,
      data: {
        ...breadcrumb.data,
        url: withoutQuery(breadcrumb.data.url),
      },
    };
  }

  return breadcrumb;
}
