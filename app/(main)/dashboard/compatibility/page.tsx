'use client';

import { useEffect, useState } from 'react';
import { useCountry } from '@/context/CountryContext';
import { getReplacements, Replacement } from '@/services/replacement.service';
import MainTitle from '@/components/shared/MainTitle';
import CompatibilitySection from '@/components/features/replacements/CompatibilitySection';
import Loading from '@/components/ui/Loading';
import styles from './page.module.css';

export default function CompatibilityPage() {
  const { country } = useCountry();
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Replacement | null>(null);

  useEffect(() => {
    setLoading(true);
    getReplacements({ country, limit: 100 })
      .then(r => setReplacements(r.data))
      .finally(() => setLoading(false));
  }, [country]);

  const filtered = search.trim()
    ? replacements.filter(r =>
        r.globalReplacement.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.globalReplacement.codeOem ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : replacements;

  return (
    <main className={styles.page}>
      <MainTitle title="Compatibilidades" subtitle="Asociá repuestos a los modelos de vehículo compatibles" className={styles.pageTitle} />

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <input
            className={styles.search}
            placeholder="Buscar repuesto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {loading ? (
            <Loading />
          ) : (
            <ul className={styles.list}>
              {filtered.map(r => (
                <li key={r.id}>
                  <button
                    className={`${styles.item} ${selected?.id === r.id ? styles.active : ''}`}
                    onClick={() => setSelected(r)}
                  >
                    <span className={styles.itemName}>{r.globalReplacement.name}</span>
                    {r.globalReplacement.codeOem && (
                      <span className={styles.itemCode}>{r.globalReplacement.codeOem}</span>
                    )}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <p className={styles.empty}>Sin resultados</p>
              )}
            </ul>
          )}
        </aside>

        <section className={styles.detail}>
          {selected ? (
            <CompatibilitySection replacementId={selected.id} />
          ) : (
            <p className={styles.placeholder}>Seleccioná un repuesto para gestionar sus compatibilidades.</p>
          )}
        </section>
      </div>
    </main>
  );
}
