'use client';

import { FormEvent, useEffect, useState } from 'react';
import MainTitle from '@/components/shared/MainTitle';
import Alert from '@/components/ui/Alert';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button/Button';
import Input from '@/components/ui/Input';
import Loading from '@/components/ui/Loading';
import { useAuthUser } from '@/context/AuthUserContext';
import { getTenantConfig, updateTenantConfig } from '@/services/tenant-config.service';
import { updateMyTheme } from '@/services/user.service';
import type { UserTheme } from '@/services/auth.service';
import styles from './page.module.css';

const THEMES: { value: UserTheme; label: string; swatch: string }[] = [
  { value: 'LIGHT', label: 'Claro', swatch: '#f4f5f7' },
  { value: 'DARK', label: 'Oscuro', swatch: '#1c1919' },
];

export default function ConfigPage() {
  const { currentUser, refetch } = useAuthUser();
  const [lowStockMax, setLowStockMax] = useState('4');
  const [normalStockMax, setNormalStockMax] = useState('15');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    getTenantConfig()
      .then(config => {
        setLowStockMax(String(config.lowStockMax));
        setNormalStockMax(String(config.normalStockMax));
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveStock(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const config = await updateTenantConfig({
        lowStockMax: Number(lowStockMax),
        normalStockMax: Number(normalStockMax),
      });
      setLowStockMax(String(config.lowStockMax));
      setNormalStockMax(String(config.normalStockMax));
      setSavedMessage('Configuración de stock guardada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  async function handleThemeSelect(theme: UserTheme) {
    if (currentUser?.theme === theme) return;
    await updateMyTheme(theme);
    await refetch();
  }

  if (loading) return <Loading variant="orbit" />;

  return (
    <div className={styles.page}>
      {error && <Alert variant="error" message={error} duration={4000} position="top-right" />}
      {savedMessage && (
        <Alert variant="success" message={savedMessage} duration={4000} position="top-right" />
      )}
      <Breadcrumbs items={[{ label: 'Configuración' }]} />
      <MainTitle title="Configuración" />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Niveles de stock</h2>
        <p className={styles.sectionHint}>
          Ej: hasta 4 unidades es stock bajo, hasta 15 es stock normal, más es stock completo.
        </p>
        <form className={styles.stockForm} onSubmit={handleSaveStock}>
          <Input
            label="Stock bajo (unidades)"
            type="number"
            min={0}
            value={lowStockMax}
            onChange={e => setLowStockMax(e.target.value)}
            required
          />
          <Input
            label="Stock normal (unidades)"
            type="number"
            min={0}
            value={normalStockMax}
            onChange={e => setNormalStockMax(e.target.value)}
            required
          />
          <Button type="submit" label={saving ? 'Guardando...' : 'Guardar'} disabled={saving} />
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tema</h2>
        <p className={styles.sectionHint}>Elegí el tema de la interfaz.</p>
        <div className={styles.themeOptions}>
          {THEMES.map(t => (
            <button
              key={t.value}
              type="button"
              className={`${styles.themeSwatch} ${currentUser?.theme === t.value ? styles.themeSwatchActive : ''}`}
              style={{ background: t.swatch }}
              onClick={() => handleThemeSelect(t.value)}
              aria-label={t.label}
              title={t.label}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
