import { Suspense } from 'react';
import PartCard from "@/components/features/replacements/PartCard";
import Paginator from "@/components/ui/Paginator";
import PageCount from "@/components/shared/PageCount";
import VehicleFilter from "@/components/shared/VehicleFilter";
import { getReplacements, Replacement, PaginatedResult } from "@/services/replacement.service";
import { getCompatibilityByVehicleModel } from "@/services/compatibility.service";
import { COMPATIBILITY_COUNTRIES, CompatibilityCountry } from "@/lib/compatibility-countries";
import styles from "@/styles/Home.module.css";

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; country?: string; limit?: string; vehicleModelId?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { search, page, country, limit, vehicleModelId } = await searchParams;
  const limitNum = Number(limit ?? 10);

  let result: PaginatedResult = { data: [], total: 0, page: 1, limit: limitNum, totalPages: 0 };
  let error: string | null = null;

  try {
    if (vehicleModelId && country && COMPATIBILITY_COUNTRIES.includes(country as CompatibilityCountry)) {
      const entries = await getCompatibilityByVehicleModel(country as CompatibilityCountry, vehicleModelId);
      if (entries.length === 0) {
        result = { data: [], total: 0, page: 1, limit: limitNum, totalPages: 0 };
      } else {
        const ids = entries.map(e => e.replacementId).join(',');
        result = await getReplacements(
          { country, ids, page: page ? Number(page) : 1, limit: limitNum },
          { next: { revalidate: 60 } } as RequestInit,
        );
      }
    } else {
      result = await getReplacements(
        { search, page: page ? Number(page) : 1, country, limit: limitNum },
        { next: { revalidate: 60 } } as RequestInit,
      );
    }
  } catch {
    error = "No se pudieron cargar los repuestos";
  }

  return (
    <main className={styles.main}>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.toolbar}>
        <Suspense fallback={null}>
          <VehicleFilter />
        </Suspense>
        <PageCount total={result.total} limit={limitNum} search={search} country={country} />
      </div>
      <div className={styles.grid}>
        {result.data.map((part: Replacement, index: number) => (
          <PartCard
            key={part.id}
            id={part.id}
            image={part.imageUrl}
            brand={part.brand}
            name={part.name}
            price={part.price}
            priority={index === 0}
          />
        ))}
        {result.data.length === 0 && !error && (
          <p className={styles.empty}>No se encontraron repuestos{vehicleModelId ? ' para este vehículo' : ''}.</p>
        )}
      </div>
      {result.totalPages > 1 && (
        <Paginator
          currentPage={result.page}
          totalPages={result.totalPages}
          search={search}
          country={country}
          limit={limitNum}
        />
      )}
    </main>
  );
}
