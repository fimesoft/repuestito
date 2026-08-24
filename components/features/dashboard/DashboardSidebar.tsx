'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/shared/Logo';
import Avatar from '@/components/ui/Avatar';
import { usePermissions } from '@/hooks/usePermissions';
import { logout } from '@/services/auth.service';
import { toRole } from '@/lib/roles';
import { NAV_SECTIONS, type NavItem } from './DashboardSidebar.nav';
import styles from './DashboardSidebar.module.css';

function NavIconMask({ src, size = 20, style }: { src: string; size?: number; style?: CSSProperties }) {
  return (
    <span
      className={styles.navIconMask}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        ...style,
      }}
    />
  );
}

export default function DashboardSidebar() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { hasRole, currentUser } = usePermissions();

  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(NAV_SECTIONS.map(section => section.key))
  );

  const close = () => setOpen(false);

  function toggleSection(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    setShowLogoutMenu(false);
    document.documentElement.style.setProperty('--sidebar-width', next ? '64px' : '240px');
  }

  async function handleLogout() {
    await logout();
    router.push('/app');
  }

  function renderItem(item: NavItem) {
    const isActive = pathname === item.href;
    return (
      <li key={item.href} className={item.mobileHidden ? styles.mobileHidden : undefined}>
        <Link
          href={item.href}
          className={`${styles.navItem} ${isActive ? styles.active : ''}`}
          onClick={close}
          title={collapsed ? item.label : undefined}
        >
          {item.icon && <span className={styles.navIcon}><NavIconMask src={item.icon} /></span>}
          {!collapsed && <span>{item.label}</span>}
        </Link>
      </li>
    );
  }

  return (
    <>
      <button className={styles.hamburger} onClick={() => setOpen(true)} aria-label="Abrir menú">
        <NavIconMask src="/icons/menu.svg" size={22} />
      </button>

      {open && <div className={styles.overlay} onClick={close} aria-hidden="true" />}

      <nav className={`${styles.sidebar} ${open ? styles.open : ''} ${collapsed ? styles.collapsed : ''}`} aria-label="Menú del dashboard">
        <div className={styles.sidebarHeader}>
          <Logo href="/dashboard" className={styles.logoSidebar} iconOnly={collapsed} />
          <button className={styles.closeBtn} onClick={close} aria-label="Cerrar menú">
            <NavIconMask src="/icons/close.svg" size={20} />
          </button>
        </div>

        <button
          className={styles.collapseCircle}
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <NavIconMask
            src="/icons/chevron-down.svg"
            size={12}
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.25s ease' }}
          />
        </button>

        <ul className={styles.nav} role="list">
          {NAV_SECTIONS.map(section => {
            if (section.minRole && !hasRole(section.minRole)) return null;
            const visibleItems = section.items.filter(item => !item.minRole || hasRole(item.minRole));
            if (visibleItems.length === 0) return null;

            const isSectionOpen = collapsed || openSections.has(section.key);

            return (
              <li key={section.key} className={styles.section}>
                {!collapsed && (
                  <div className={styles.sectionRow}>
                    <button
                      className={styles.sectionTitle}
                      onClick={() => toggleSection(section.key)}
                      aria-expanded={isSectionOpen}
                    >
                      <span>{section.title}</span>
                      <span className={styles.chevron}>
                        <NavIconMask src={isSectionOpen ? '/icons/chevron-up.svg' : '/icons/chevron-down.svg'} size={12} />
                      </span>
                    </button>
                  </div>
                )}
                {isSectionOpen && (
                  <ul className={styles.sectionList} role="list">
                    {visibleItems.map(renderItem)}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {currentUser && (
          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarFooterUser}>
              {collapsed && showLogoutMenu && (
                <div className={styles.logoutMenuOverlay} onClick={() => setShowLogoutMenu(false)} aria-hidden="true" />
              )}
              <button
                type="button"
                className={styles.avatarTrigger}
                onClick={collapsed ? () => setShowLogoutMenu(v => !v) : undefined}
                aria-haspopup={collapsed ? 'true' : undefined}
                aria-expanded={collapsed ? showLogoutMenu : undefined}
                aria-label={collapsed ? 'Opciones de cuenta' : undefined}
              >
                <Avatar name={currentUser.email} size="sm" />
              </button>
              {!collapsed && (
                <div className={styles.sidebarFooterInfo}>
                  <span className={styles.sidebarFooterName}>{currentUser.email.split('@')[0]}</span>
                  <span className={styles.sidebarFooterRole}>{toRole(currentUser.role) ?? currentUser.role}</span>
                </div>
              )}
              {collapsed && showLogoutMenu && (
                <div className={styles.logoutMenu} role="menu">
                  <button className={styles.logoutMenuItem} onClick={handleLogout} role="menuitem">
                    <NavIconMask src="/icons/logout.svg" size={16} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
            {!collapsed && (
              <button className={styles.logoutBtn} onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
                <NavIconMask src="/icons/logout.svg" size={18} />
              </button>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
