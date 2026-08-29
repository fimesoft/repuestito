import Link from 'next/link';
import styles from './Breadcrumbs.module.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

const ROOT: BreadcrumbItem = { label: 'Dashboard', href: '/dashboard' };

export default function Breadcrumbs({ items = [] }: BreadcrumbsProps) {
  const crumbs = [ROOT, ...items];

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <ol className={styles.list}>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className={styles.item}>
              {!isLast && crumb.href ? (
                <Link href={crumb.href} className={styles.link}>{crumb.label}</Link>
              ) : (
                <span className={styles.current}>{crumb.label}</span>
              )}
              {!isLast && <span className={styles.separator}>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
