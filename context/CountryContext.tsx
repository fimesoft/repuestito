'use client';

import { createContext, useContext, useState } from 'react';

export type CountryCode = 'VE' | 'AR';

interface CountryOption {
  code: CountryCode;
  label: string;
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'VE', label: 'VE', flag: '🇻🇪' },
  { code: 'AR', label: 'AR', flag: '🇦🇷' },
];

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
