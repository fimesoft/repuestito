"use client";

import Link from "next/link";
import styles from "./Paginator.module.css";

interface PaginatorProps {
  currentPage: number;
  totalPages: number;
  search?: string;
  country?: string;
  limit?: number;
}

export default function Paginator({ currentPage, totalPages, search, country, limit }: PaginatorProps) {
  function buildHref(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (country) params.set("country", country);
    if (limit) params.set("limit", String(limit));
    params.set("page", String(page));
    return `/?${params.toString()}`;
  }

  return (
    <nav className={styles.nav}>
      {currentPage > 1 ? (
        <Link className={styles.btn} href={buildHref(currentPage - 1)}>←</Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`}>←</span>
      )}

      <span className={styles.info}>{currentPage} / {totalPages}</span>

      {currentPage < totalPages ? (
        <Link className={styles.btn} href={buildHref(currentPage + 1)}> →</Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`}> →</span>
      )}
    </nav>
  );
}
