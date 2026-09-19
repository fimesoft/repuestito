import { AuthUserProvider } from '@/context/AuthUserContext';
import DashboardSidebar from '@/components/features/dashboard/DashboardSidebar';
import MobileBottomNav from '@/components/features/dashboard/MobileBottomNav';
import OnboardingGate from '@/components/features/dashboard/OnboardingGate';
import styles from './layout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthUserProvider>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{const saved=localStorage.getItem('piezify-theme');const theme=saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme}catch{}`,
        }}
      />
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
