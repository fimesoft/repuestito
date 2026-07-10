'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './LocationSearch.module.css';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  onSelect: (lat: number, lon: number, address: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export default function LocationSearch({ onSelect, placeholder = 'Buscar ubicación...', initialValue }: Props) {
  const [query, setQuery] = useState(initialValue ?? '');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [confirmed, setConfirmed] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query.length < 3) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'es' } },
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function pick(r: NominatimResult) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    setQuery(r.display_name);
    setResults([]);
    setConfirmed({ lat, lon, label: r.display_name });
    onSelect(lat, lon, r.display_name);
  }

  function clear() {
    setQuery('');
    setResults([]);
    setConfirmed(null);
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={query}
          onChange={e => { setQuery(e.target.value); setConfirmed(null); }}
          placeholder={placeholder}
          autoComplete="off"
        />
        {query && (
          <button type="button" className={styles.clearBtn} onClick={clear} aria-label="Limpiar">
            ×
          </button>
        )}
      </div>

      {loading && <p className={styles.hint}>Buscando...</p>}

      {results.length > 0 && !confirmed && (
        <ul className={styles.dropdown}>
          {results.map(r => (
            <li key={r.place_id} className={styles.option} onMouseDown={() => pick(r)}>
              {r.display_name}
            </li>
          ))}
        </ul>
      )}

      {confirmed && (
        <p className={styles.coords}>
          {confirmed.lat.toFixed(6)}, {confirmed.lon.toFixed(6)}
        </p>
      )}
    </div>
  );
}
