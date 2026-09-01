'use client';

import TenantBranchWizard from '@/components/features/tenants/TenantBranchWizard';
import Loading from '@/components/ui/Loading';
import { useAuthUser } from '@/context/AuthUserContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { loading, needsOnboarding } = usePermissions();
  const { refetch } = useAuthUser();

  if (loading) return <Loading />;

  if (needsOnboarding) {
    return (
      <TenantBranchWizard isOpen onClose={() => {}} onSuccess={refetch} />
    );
  }

  return <>{children}</>;
}
