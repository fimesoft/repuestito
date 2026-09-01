import { AuthUserProvider } from '@/context/AuthUserContext';
import DashboardSidebar from '@/components/features/dashboard/DashboardSidebar';
import MobileBottomNav from '@/components/features/dashboard/MobileBottomNav';
import OnboardingGate from '@/components/features/dashboard/OnboardingGate';
import styles from './layout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthUserProvider>
      <div className={styles.wrapper}>
        <DashboardSidebar />
        <div className={styles.content}>
          <OnboardingGate>{children}</OnboardingGate>
        </div>
        <MobileBottomNav />
      </div>
    </AuthUserProvider>
  );
}
