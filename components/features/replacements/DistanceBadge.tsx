'use client';

import { useEffect, useState } from 'react';

interface Props {
  storeLat: number;
  storeLng: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; km: number }
  | { status: 'error'; message: string };

const STORAGE_KEY = 'user_location';

interface CachedLocation {
  lat: number;
  lng: number;
}

function readCache(): CachedLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CachedLocation) : null;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lng: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng }));
  } catch {
    // localStorage no disponible
  }
}

export default function DistanceBadge({ storeLat, storeLng }: Props) {
  const [state, setState] = useState<State>(() => {
    const cached = typeof window !== 'undefined' ? readCache() : null;
    if (cached) {
      return { status: 'ok', km: haversineKm(cached.lat, cached.lng, storeLat, storeLng) };
    }
    return { status: 'idle' };
  });

  useEffect(() => {
    if (state.status === 'ok') return; // ya tenemos resultado del caché

    if (!navigator.geolocation) {
      setState({ status: 'error', message: 'Geolocalización no disponible' });
      return;
    }
    setState({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        writeCache(coords.latitude, coords.longitude);
        const km = haversineKm(coords.latitude, coords.longitude, storeLat, storeLng);
        setState({ status: 'ok', km });
      },
      () => setState({ status: 'error', message: 'Permiso de ubicación denegado' }),
      { enableHighAccuracy: false, maximumAge: 300_000 },
    );
  }, [storeLat, storeLng]);

  if (state.status === 'idle' || state.status === 'loading') return <dd>Calculando...</dd>;
  if (state.status === 'error') return <dd title={state.message}>—</dd>;
  return <dd>{state.km < 1 ? `${Math.round(state.km * 1000)} m` : `${state.km.toFixed(1)} km`}</dd>;
}
