import * as Sentry from '@sentry/nextjs';
import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@/lib/sentry';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProduction = process.env.NODE_ENV === 'production';
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

Sentry.init({
  dsn,
  enabled: Boolean(dsn) && isProduction,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: isProduction ? 0.1 : 1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: isProduction ? 0.05 : 1,
  tracePropagationTargets: apiUrl ? [apiUrl] : [],
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      networkCaptureBodies: false,
    }),
  ],
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  beforeSend: sanitizeSentryEvent,
  beforeSendTransaction: sanitizeSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
