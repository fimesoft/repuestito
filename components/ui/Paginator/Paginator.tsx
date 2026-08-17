"use client";

import Link from "next/link";
import styles from "./Paginator.module.css";

interface PaginatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  search?: string;
  country?: string;
  limit?: number;
}

export default function Paginator({ currentPage, totalPages, onPageChange, search, country, limit }: PaginatorProps) {
  function buildHref(page: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (country) params.set("country", country);
    if (limit) params.set("limit", String(limit));
    params.set("page", String(page));
    return `/?${params.toString()}`;
  }

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  if (onPageChange) {
    return (
      <nav className={styles.nav}>
        <button className={styles.btn} onClick={() => onPageChange(currentPage - 1)} disabled={prevDisabled}>←</button>
        <span className={styles.info}>{currentPage} / {totalPages}</span>
        <button className={styles.btn} onClick={() => onPageChange(currentPage + 1)} disabled={nextDisabled}>→</button>
      </nav>
    );
  }

  return (
    <nav className={styles.nav}>
      {!prevDisabled ? (
        <Link className={styles.btn} href={buildHref(currentPage - 1)}>←</Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`}>←</span>
      )}
      <span className={styles.info}>{currentPage} / {totalPages}</span>
      {!nextDisabled ? (
        <Link className={styles.btn} href={buildHref(currentPage + 1)}>→</Link>
      ) : (
        <span className={`${styles.btn} ${styles.disabled}`}>→</span>
      )}
    </nav>
  );
}
