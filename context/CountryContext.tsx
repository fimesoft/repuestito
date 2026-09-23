'use client';

import { createContext, useContext, useState } from 'react';

/** Código ISO alpha-2 (`countries.code`). */
export type CountryCode = string;

const REGION_NAMES = new Intl.DisplayNames(['es'], { type: 'region' });

export function getCountryName(code: string): string {
  try {
    return REGION_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

interface CountryContextValue {
  country: CountryCode;
  setCountry: (code: CountryCode) => void;
}

const CountryContext = createContext<CountryContextValue | null>(null);

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountry] = useState<CountryCode>('AR');

  return (
    <CountryContext.Provider value={{ country, setCountry }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry(): CountryContextValue {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error('useCountry must be used inside CountryProvider');
  return ctx;
}
