'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats, DashboardStats } from '@/services/stats.service';
import Card from '@/components/ui/Card';
import MainTitle from '@/components/shared/MainTitle';
import Loading from '@/components/ui/Loading';
import VisibilityToggle from '@/components/ui/VisibilityToggle';
import OrdersChart from '@/components/features/dashboard/OrdersChart';
import ReplacementsChart from '@/components/features/dashboard/ReplacementsChart';
import SalesChart from '@/components/features/dashboard/SalesChart';
import { useCurrency } from '@/hooks/useCurrency';
import styles from './page.module.css';

/** Porcentaje de margen (sobre el precio de venta); null = sin productos con costo para calcularlo. */
function formatPercentage(value: number | null): string {
  return value === null ? 'Sin costos cargados' : `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
}

/** Flecha de tendencia del margen: hacia arriba (verde) si es positivo, hacia abajo (rojo) si es negativo. */
function TrendIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <span className={`${styles.trendIcon} ${direction === 'up' ? styles.trendUp : styles.trendDown}`} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'up' ? (
          <>
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </>
        ) : (
          <>
            <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
            <polyline points="16 17 22 17 22 11" />
          </>
        )}
      </svg>
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCapital, setShowCapital] = useState(true);
  const [showPotential, setShowPotential] = useState(true);
  const {
    displayCurrency,
    localCurrency,
    activeCurrency,
    activeRate,
    exchangeRate,
    loading: currencyLoading,
    error: currencyError,
    canConvert,
    toggleCurrency,
    formatAmount,
  } = useCurrency();

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setError('No se pudieron cargar las estadísticas'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.page}><Loading variant="orbit" /></div>;
  if (error || !stats) return <div className={styles.page}><p className={styles.error}>{error}</p></div>;

  const margin = stats.replacements.profitMargin;
  const marginPercentage = margin?.percentage ?? null;
  const trend = marginPercentage === null || marginPercentage === 0 ? null : marginPercentage > 0 ? 'up' : 'down';
  const withoutCost = stats.replacements.withoutCost ?? 0;
  const totalProducts = stats.replacements.total;
  const hiddenAmount = `${activeCurrency} ••••••`;

  const exchangeRateLabel = exchangeRate?.rate
    ? exchangeRate.rate.toLocaleString('es-AR', { maximumFractionDigits: 2 })
    : null;
  const exchangeRateSource = exchangeRate?.source?.replace(/^DolarApi\s*-\s*/i, '');

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <MainTitle
          title="Dashboard"
          subtitle="Métricas generales del marketplace y control de ventas."
        />
      </div>
      <section className={styles.section}>
        {exchangeRateLabel && (
          <div className={styles.exchangeRateRow} aria-live="polite">
            <span className={styles.exchangeInfo}>
              1 USD = {exchangeRateLabel} {localCurrency}
              {exchangeRateSource ? ` - ${exchangeRateSource}` : ''}
            </span>
          </div>
        )}
        <div className={styles.grid}>
          <Card className={`${styles.inventoryCard} ${styles.amountCard}`}>
              <div className={styles.inventoryHeader}>
                <span className={styles.statLabel}>Capital invertido</span>
                <button
                  type="button"
                  className={styles.inventoryIcon}
                  onClick={toggleCurrency}
                  disabled={!canConvert || currencyLoading}
                  aria-label={displayCurrency === 'USD' ? `Mostrar importes en ${localCurrency}` : 'Mostrar importes en dólares'}
                  title={canConvert ? `Cambiar a ${displayCurrency === 'USD' ? localCurrency : 'USD'}` : 'Conversión disponible para usuarios asociados a un local'}
                >
                  {currencyLoading ? '…' : activeCurrency}
                </button>
              </div>
              <span className={styles.inventoryValue}>{showCapital ? formatAmount(stats.replacements.capitalInvested ?? 0) : hiddenAmount}</span>
              {withoutCost > 0 && (
                <span className={styles.metricSub}>
                  {withoutCost} {withoutCost === 1 ? 'producto' : 'productos'} sin costo
                </span>
              )}
              <VisibilityToggle visible={showCapital} onToggle={() => setShowCapital(v => !v)} label="capital invertido" className={styles.amountToggle} />
              {currencyError && <span className={styles.currencyError}>{currencyError}</span>}
          </Card>
          <Card className={styles.amountCard}>
            <div className={`${styles.inventoryHeader} ${styles.headerAligned}`}>
              <span className={styles.statLabel}>Valor potencial de ventas</span>
            </div>
            <span className={styles.inventoryValue}>{showPotential ? formatAmount(stats.replacements.potentialSalesValue ?? 0) : hiddenAmount}</span>
            <VisibilityToggle visible={showPotential} onToggle={() => setShowPotential(v => !v)} label="valor potencial de ventas" className={styles.amountToggle} />
          </Card>
          <div className={styles.stack}>
            <Card className={styles.compactCard}>
              <div className={styles.inventoryHeader}>
                <span className={styles.statLabel}>Margen de ganancias</span>
              </div>
              <span className={styles.inventoryValue}>{formatAmount(margin?.amount ?? 0)}</span>
              <span className={`${styles.metricSub} ${styles.trendRow}`}>
                {formatPercentage(marginPercentage)}
                {trend && <TrendIcon direction={trend} />}
              </span>
            </Card>
            <Card className={styles.compactCard}>
              <div className={styles.inventoryHeader}>
                <span className={styles.statLabel}>Cantidad de artículos totales</span>
              </div>
              <span className={styles.inventoryValue}>{(stats.replacements.totalStock ?? 0).toLocaleString('es-AR')}</span>
              <span className={`${styles.metricSub} ${styles.alignEnd}`}>
                en {totalProducts.toLocaleString('es-AR')} {totalProducts === 1 ? 'producto' : 'productos'}
              </span>
            </Card>
          </div>
          <SalesChart className={styles.salesChart} currencyCode={activeCurrency} exchangeRate={activeRate} />
        </div>
      </section>
      
      <section className={styles.section}>
        <div className={styles.comercialLayout}>
          <OrdersChart orders={stats.orders} className={styles.comercialChart} />
          <ReplacementsChart replacements={stats.replacements} className={styles.comercialChart} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.grid}>
          <Card>
            <div className={styles.inventoryHeader}>
              <span className={styles.statLabel}>Total usuarios</span>
            </div>
            <span className={styles.inventoryValue}>{stats.users.total}</span>
          </Card>
          <Card>
            <div className={styles.inventoryHeader}>
              <span className={styles.statLabel}>Activos</span>
            </div>
            <span className={styles.inventoryValue}>{stats.users.active}</span>
          </Card>
        </div>
      </section>
    </main>
  );
}
