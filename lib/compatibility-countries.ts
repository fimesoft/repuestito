export const COMPATIBILITY_COUNTRIES = ['AR', 'VE'] as const;
export type CompatibilityCountry = typeof COMPATIBILITY_COUNTRIES[number];

export const countryToCompatibility: Record<string, CompatibilityCountry> = {
  AR: 'AR',
  VE: 'VE',
};

export const COUNTRY_LABELS: Record<CompatibilityCountry, string> = {
  AR: 'Argentina',
  VE: 'Venezuela',
};
