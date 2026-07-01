import PartCard from "@/components/PartCard";
import Paginator from "@/components/Paginator";
import { getReplacements, Replacement, PaginatedResult } from "@/services/replacement.service";
import styles from "@/styles/Home.module.css";

interface PageProps {
  searchParams: Promise<{ search?: string; page?: string; country?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { search, page, country } = await searchParams;

  let result: PaginatedResult = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
  let error: string | null = null;

  try {
    result = await getReplacements(
      { search, page: page ? Number(page) : 1, country },
      { next: { revalidate: 60 } } as RequestInit,
    );
  } catch {
    error = "No se pudieron cargar los repuestos";
  }

  return (
    <main className={styles.main}>
      {error && <p className={styles.error}>{error}</p>}
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
        />
      )}
    </main>
  );
}
