/** Debe coincidir con `repuestito-api/src/tenant/subdomain.util.ts`. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www', 'app', 'api', 'admin', 'administrator', 'root', 'mail', 'email', 'smtp', 'ftp',
  'dashboard', 'docs', 'help', 'support', 'soporte', 'status', 'blog', 'static', 'assets',
  'cdn', 'auth', 'login', 'register', 'account', 'billing', 'piezify', 'repuestito',
  'test', 'dev', 'staging', 'demo',
]);

export const SUBDOMAIN_MIN_LENGTH = 3;

const SUBDOMAIN_MAX_LENGTH = 100;

/** "Autopartes Peña & Hijos" → "autopartes-pena-hijos". */
export function toSubdomain(businessName: string): string {
  return businessName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SUBDOMAIN_MAX_LENGTH)
    .replace(/-+$/, '');
}
