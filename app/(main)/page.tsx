import PartCard from "@/components/features/replacements/PartCard";
import Paginator from "@/components/ui/Paginator";
import PageCount from "@/components/shared/PageCount";
import { getReplacements, Replacement, PaginatedResult } from "@/services/replacement.service";
import styles from "@/styles/Home.module.css";

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; country?: string; limit?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { search, page, country, limit } = await searchParams;
  const limitNum = Number(limit ?? 10);

  let result: PaginatedResult = { data: [], total: 0, page: 1, limit: limitNum, totalPages: 0 };
  let error: string | null = null;

  try {
    result = await getReplacements(
      { search, page: page ? Number(page) : 1, country, limit: limitNum },
      { next: { revalidate: 60 } } as RequestInit,
    );
  } catch {
    error = "No se pudieron cargar los repuestos";
  }

  return (
    <main className={styles.main}>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.toolbar}>
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
