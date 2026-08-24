import type { Role } from '@/hooks/usePermissions';

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  mobileHidden?: boolean;
  minRole?: Role;
}

export interface NavSection {
  key: string;
  title: string;
  minRole?: Role;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'general',
    title: 'General',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: '/icons/dashboard.svg' },
    ],
  },
  {
    key: 'ecommerce',
    title: 'E-Commerce',
    items: [
      { href: '/dashboard/orders', label: 'Pedidos', icon: '/icons/clipboard.svg', mobileHidden: true },
      { href: '/dashboard/billing', label: 'Facturación', icon: '/icons/receipt.svg' },
      { href: '/dashboard/replacement', label: 'Listado de Repuestos', icon: '/icons/wrench.svg', mobileHidden: true },
      { href: '/dashboard/replacement/bulk-upload', label: 'Carga Masiva', icon: '/icons/upload.svg', mobileHidden: true },
      { href: '/dashboard/compatibility', label: 'Compatibilidades', icon: '/icons/link.svg', mobileHidden: true },
    ],
  },
  {
    key: 'admin',
    title: 'Administración',
    items: [
      { href: '/dashboard/stores', label: 'Locales', icon: '/icons/store.svg', minRole: 'MODERATOR' },
      { href: '/dashboard/users', label: 'Usuarios', icon: '/icons/users.svg', mobileHidden: true, minRole: 'MODERATOR' },
      { href: '/dashboard/vehicles', label: 'Vehículos', icon: '/icons/car.svg', mobileHidden: true, minRole: 'ADMIN' },
      { href: '/dashboard/admin/countries', label: 'Países', icon: '/icons/globe.svg', mobileHidden: true, minRole: 'ADMIN' },
      { href: '/dashboard/admin/brands', label: 'Marcas', icon: '/icons/tag.svg', mobileHidden: true, minRole: 'ADMIN' },
    ],
  },
];
