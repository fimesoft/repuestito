'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCountry, type CountryCode } from '@/context/CountryContext';
import { getCountries, type Country } from '@/services/country.service';
import styles from '../Header/Header.module.css';

/** "AR" → 🇦🇷 (regional indicator symbols). */
function flag(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default function CountrySelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { country, setCountry } = useCountry();
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    getCountries({ active: true, limit: 100 }).then(res => setCountries(res.data)).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    const urlCountry = searchParams.get('country')?.toUpperCase();
    if (urlCountry && /^[A-Z]{2}$/.test(urlCountry)) {
      setCountry(urlCountry);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(code: CountryCode) {
    setCountry(code);
    const params = new URLSearchParams(searchParams.toString());
    params.set('country', code);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      className={styles.countrySelect}
      value={country}
      onChange={(e) => handleChange(e.target.value as CountryCode)}
      aria-label="Seleccionar país"
    >
      {countries.length === 0 && <option value={country}>{flag(country)} {country}</option>}
      {countries.map((c) => (
        <option key={c.code} value={c.code}>
          {flag(c.code)} {c.code}
        </option>
      ))}
    </select>
  );
}
