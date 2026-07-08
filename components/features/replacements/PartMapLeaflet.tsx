'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './PartMapLeaflet.module.css';

const storeIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const userIcon = L.divIcon({
  html: '<div style="background:#3b82f6;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: '',
});

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, positions]);
  return null;
}

interface PartMapLeafletProps {
  storeLat: number;
  storeLng: number;
  storeName: string;
}

export default function PartMapLeaflet({ storeLat, storeLng, storeName }: PartMapLeafletProps) {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalización no disponible en este navegador');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => setLocationError('No se pudo obtener tu ubicación'),
    );
  }, []);

  const storePos: [number, number] = [storeLat, storeLng];
  const positions: [number, number][] = userPos ? [storePos, userPos] : [storePos];

  return (
    <div className={styles.wrapper}>
      <MapContainer center={storePos} zoom={13} className={styles.map}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={storePos} icon={storeIcon}>
          <Popup>{storeName}</Popup>
        </Marker>
        {userPos && (
          <Marker position={userPos} icon={userIcon}>
            <Popup>Tu ubicación</Popup>
          </Marker>
        )}
        <FitBounds positions={positions} />
      </MapContainer>
      {locationError && <p className={styles.error}>{locationError}</p>}
    </div>
  );
}
