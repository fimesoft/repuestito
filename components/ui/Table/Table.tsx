'use client';

import styles from './Table.module.css';

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string | number;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export default function Table<T>({
  columns,
  rows,
  getKey,
  emptyMessage = 'No hay resultados.',
  loading = false,
  onRowClick,
}: TableProps<T>) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={columns.length} className={styles.empty}>Cargando...</td></tr>
          )}
          {!loading && rows.map(row => (
            <tr
              key={getKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? styles.clickable : undefined}
            >
              {columns.map((col, i) => (
                <td key={i} className={col.className}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={columns.length} className={styles.empty}>{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
