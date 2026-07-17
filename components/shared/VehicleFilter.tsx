'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getVehicleModels, VehicleModel } from '@/services/vehicle-model.service';
import styles from './VehicleFilter.module.css';

export default function VehicleFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get('vehicleModelId');

  const [models, setModels] = useState<VehicleModel[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [modelOptions, setModelOptions] = useState<VehicleModel[]>([]);

  useEffect(() => {
    getVehicleModels().then(data => {
      setModels(data);
      const unique = [...new Set(data.map(m => m.brand))].sort();
      setBrands(unique);
    });
  }, []);

  useEffect(() => {
    setModelOptions(models.filter(m => m.brand === selectedBrand));
  }, [selectedBrand, models]);

  function onBrandChange(brand: string) {
    setSelectedBrand(brand);
    clearFilter();
  }

  function onModelChange(vehicleModelId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (vehicleModelId) {
      params.set('vehicleModelId', vehicleModelId);
    } else {
      params.delete('vehicleModelId');
    }
    params.delete('page');
    router.push(`/?${params.toString()}`);
  }

  function clearFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vehicleModelId');
    params.delete('page');
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className={styles.wrapper}>
      <select
        className={styles.select}
        value={selectedBrand}
        onChange={e => onBrandChange(e.target.value)}
      >
        <option value="">Marca</option>
        {brands.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      <select
        className={styles.select}
        value={activeId ?? ''}
        onChange={e => onModelChange(e.target.value)}
        disabled={!selectedBrand}
      >
        <option value="">Modelo</option>
        {modelOptions.map(m => (
          <option key={m.id} value={m.id}>
            {m.model} ({m.yearFrom}–{m.yearTo})
          </option>
        ))}
      </select>

      {activeId && (
        <button className={styles.clear} onClick={clearFilter}>✕ Limpiar</button>
      )}
    </div>
  );
}
