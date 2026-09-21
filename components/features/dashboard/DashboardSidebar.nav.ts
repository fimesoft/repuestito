import type { Role } from '@/hooks/usePermissions';

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
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
      { href: '/dashboard/orders', label: 'Pedidos', icon: '/icons/clipboard.svg' },
      { href: '/dashboard/billing', label: 'Facturación', icon: '/icons/receipt.svg' },
      { href: '/dashboard/replacement', label: 'Listado de Productos', icon: '/icons/package.svg' },
      { href: '/dashboard/replacement/bulk-upload', label: 'Carga Masiva', icon: '/icons/upload.svg' },
    ],
  },
  {
    key: 'admin',
    title: 'Administración',
    items: [
      { href: '/dashboard/stores', label: 'Locales', icon: '/icons/store.svg', minRole: 'MODERATOR' },
      { href: '/dashboard/users', label: 'Usuarios', icon: '/icons/users.svg', minRole: 'MODERATOR' },
      { href: '/dashboard/vehicles', label: 'Vehículos', icon: '/icons/car.svg', minRole: 'ADMIN' },
      { href: '/dashboard/admin/countries', label: 'Países', icon: '/icons/globe.svg', minRole: 'ADMIN' },
      { href: '/dashboard/admin/brands', label: 'Marcas', icon: '/icons/tag.svg', minRole: 'ADMIN' },
      { href: '/dashboard/admin/product-types', label: 'Tipos', icon: '/icons/layers.svg', minRole: 'ADMIN' },
      { href: '/dashboard/config', label: 'Configuración', icon: '/icons/settings.svg', minRole: 'MODERATOR' },
    ],
  },
];
