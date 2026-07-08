'use client';

import { useState, Suspense } from 'react';
import Search from './Search';
import CountrySelect from './CountrySelect';
import Button from '../ui/Button/Button';
import TenantBranchWizard from '../features/tenants/TenantBranchWizard';
import styles from './Header.module.css';

export default function Header() {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <header className={styles.header}>
      <Suspense>
        <Search />
        <CountrySelect />
      </Suspense>
      <Button label="+ Nuevo local" onClick={() => setWizardOpen(true)} shadow />
      <TenantBranchWizard isOpen={wizardOpen} onClose={() => setWizardOpen(false)} />
    </header>
  );
}
