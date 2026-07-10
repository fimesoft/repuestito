import DashboardSidebar from '@/components/features/dashboard/DashboardSidebar';
import styles from './layout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <DashboardSidebar />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
