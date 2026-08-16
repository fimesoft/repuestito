'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { COUNTRIES, useCountry, type CountryCode } from '@/context/CountryContext';
import styles from '../Header/Header.module.css';

export default function CountrySelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { country, setCountry } = useCountry();

  useEffect(() => {
    const urlCountry = searchParams.get('country') as CountryCode | null;
    if (urlCountry === 'AR' || urlCountry === 'VE') {
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
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.flag} {c.label}
        </option>
      ))}
    </select>
  );
}
