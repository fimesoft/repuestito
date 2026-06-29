"use client";

import Link from "next/link";
import styles from "./Paginator.module.css";

interface PaginatorProps {
  currentPage: number;
  totalPages: number;
  search?: string;
}

export default function Paginator({ currentPage, totalPages, search }: PaginatorProps) {
  function buildHref(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    return `/?${params.toString()}`;
  }

  return (
    <nav className={styles.nav}>
      {currentPage > 1 ? (
        <Link className={styles.btn} href={buildHref(currentPage - 1)}>← Anterior</Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`}>← Anterior</span>
      )}

      <span className={styles.info}>{currentPage} / {totalPages}</span>

      {currentPage < totalPages ? (
        <Link className={styles.btn} href={buildHref(currentPage + 1)}>Siguiente →</Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`}>Siguiente →</span>
      )}
    </nav>
  );
}
