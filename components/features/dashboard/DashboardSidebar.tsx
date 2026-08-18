'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/shared/Logo';
import { usePermissions } from '@/hooks/usePermissions';
import styles from './DashboardSidebar.module.css';

function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconWrench() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function IconCar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

function IconStore() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconChevronRight({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const NAV = [
  { href: '/dashboard',                        label: 'Dashboard',        Icon: IconDashboard },
  { href: '/dashboard/replacement',            label: 'Repuestos',        Icon: IconWrench,    mobileHidden: true },
  { href: '/dashboard/orders',                 label: 'Pedidos',          Icon: IconClipboard, mobileHidden: true },
  { href: '/dashboard/billing',                label: 'Facturación',      Icon: IconReceipt },
  { href: '/dashboard/stores',                 label: 'Locales',          Icon: IconStore },
  { href: '/dashboard/users',                  label: 'Usuarios',         Icon: IconUsers,     mobileHidden: true },
  { href: '/dashboard/compatibility',          label: 'Compatibilidades', Icon: IconLink,      mobileHidden: true },
  { href: '/dashboard/replacement/bulk-upload', label: 'Carga masiva',   Icon: IconUpload,    mobileHidden: true },
];

const ADMIN_ITEMS = [
  { href: '/dashboard/vehicles',        label: 'Vehículos', Icon: IconCar,   mobileHidden: true },
  { href: '/dashboard/admin/countries', label: 'Países',    Icon: IconGlobe, mobileHidden: true },
  { href: '/dashboard/admin/brands',    label: 'Marcas',    Icon: IconTag,   mobileHidden: true },
];

const SETTINGS_ITEM = { href: '/dashboard/settings', label: 'Configuración', Icon: IconSettings };

export default function DashboardSidebar() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { isAdmin } = usePermissions();
  const isAdminPath = pathname.startsWith('/dashboard/vehicles') || pathname.startsWith('/dashboard/admin');
  const [adminOpen, setAdminOpen] = useState(isAdminPath);

  const close = () => setOpen(false);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.style.setProperty('--sidebar-width', next ? '64px' : '240px');
  }

  return (
    <>
      <button className={styles.hamburger} onClick={() => setOpen(true)} aria-label="Abrir menú">
        <IconMenu />
      </button>

      {open && <div className={styles.overlay} onClick={close} aria-hidden="true" />}

      <nav className={`${styles.sidebar} ${open ? styles.open : ''} ${collapsed ? styles.collapsed : ''}`} aria-label="Menú del dashboard">
        <div className={styles.sidebarHeader}>
          {!collapsed && <Logo href="/dashboard" className={styles.logoSidebar} />}
          <button className={styles.closeBtn} onClick={close} aria-label="Cerrar menú">
            <IconClose />
          </button>
        </div>

        <ul className={styles.nav} role="list">
          {NAV.map(({ href, label, Icon, mobileHidden }) => {
            const isActive = pathname === href;
            return (
              <li key={href} className={mobileHidden ? styles.mobileHidden : undefined}>
                <Link
                  href={href}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                  onClick={close}
                  title={collapsed ? label : undefined}
                >
                  <span className={styles.navIcon}><Icon /></span>
                  {!collapsed && <span>{label}</span>}
                </Link>
              </li>
            );
          })}

          {isAdmin && (
            <li>
              <button
                className={`${styles.submenuHeader} ${isAdminPath ? styles.submenuHeaderActive : ''}`}
                onClick={() => setAdminOpen(prev => !prev)}
                title={collapsed ? 'Administración' : undefined}
              >
                <span className={styles.navIcon}><IconShield /></span>
                {!collapsed && (
                  <>
                    <span className={styles.submenuLabel}>Administración</span>
                    <span className={styles.chevron}><IconChevronRight open={adminOpen} /></span>
                  </>
                )}
              </button>
              {adminOpen && !collapsed && (
                <ul className={styles.submenu} role="list">
                  {ADMIN_ITEMS.map(({ href, label, Icon, mobileHidden }) => {
                    const isActive = pathname === href;
                    return (
                      <li key={href} className={mobileHidden ? styles.mobileHidden : undefined}>
                        <Link
                          href={href}
                          className={`${styles.navItem} ${styles.submenuItem} ${isActive ? styles.active : ''}`}
                          onClick={close}
                        >
                          <span className={styles.navIcon}><Icon /></span>
                          <span>{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          )}

          <li>
            <Link
              href={SETTINGS_ITEM.href}
              className={`${styles.navItem} ${pathname === SETTINGS_ITEM.href ? styles.active : ''}`}
              onClick={close}
              title={collapsed ? SETTINGS_ITEM.label : undefined}
            >
              <span className={styles.navIcon}><SETTINGS_ITEM.Icon /></span>
              {!collapsed && <span>{SETTINGS_ITEM.label}</span>}
            </Link>
          </li>
        </ul>

        <button className={styles.collapseBtn} onClick={toggleCollapse} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}>
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {!collapsed && <span>Contraer</span>}
        </button>
      </nav>
    </>
  );
}
