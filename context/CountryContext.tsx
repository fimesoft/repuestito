'use client';

import { createContext, useContext, useState } from 'react';

export type CountryCode = 'VE' | 'AR';

interface CountryOption {
  code: CountryCode;
  label: string;
  name: string;
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'VE', label: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'AR', label: 'AR', name: 'Argentina', flag: '🇦🇷' },
];

export function getCountryName(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.name ?? code;
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
