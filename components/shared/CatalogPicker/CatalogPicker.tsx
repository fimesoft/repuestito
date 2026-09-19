'use client';

import { useCallback, useRef, useState } from 'react';
import Autocomplete from '@/components/ui/Autocomplete';
import Button from '@/components/ui/Button/Button';
import Modal from '@/components/ui/Modal/Modal';
import { ConflictError } from '@/lib/api-errors';
import styles from './CatalogPicker.module.css';

export interface CatalogOption {
  id: number;
  name: string;
  /** Solo lo trae el 409 de tipos: un tipo desactivado existe pero no se puede seleccionar. */
  isActive?: boolean;
}

interface CatalogPickerProps {
  /** Nombre de la entidad en minúscula, para los textos ("marca", "tipo"). */
  entity: string;
  /** Género gramatical de la entidad, para "ya está creada" / "ya está creado". */
  feminine?: boolean;
  value: CatalogOption | null;
  onChange: (value: CatalogOption | null) => void;
  /** Debe ser estable (useCallback): el Autocomplete la usa como dependencia de un efecto. */
  search: (query: string) => Promise<CatalogOption[]>;
  create: (name: string) => Promise<CatalogOption>;
  placeholder?: string;
}

export default function CatalogPicker({ entity, feminine = false, value, onChange, search, create, placeholder }: CatalogPickerProps) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<CatalogOption[]>([]);
  const searchSeq = useRef(0);

  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<CatalogOption | null>(null);

  const handleSearch = useCallback(
    (query: string) => {
      const seq = ++searchSeq.current;
      search(query)
        .then(items => { if (seq === searchSeq.current) setSuggestions(items); })
        .catch(() => { if (seq === searchSeq.current) setSuggestions([]); });
    },
    [search],
  );

  function handleTextChange(next: string) {
    setText(next);
    if (value && next !== value.name) onChange(null);
  }

  function openCreate(name: string) {
    setCreatingName(name);
    setError(null);
    setExisting(null);
  }

  function closeCreate() {
    setCreatingName(null);
    setExisting(null);
    setError(null);
  }

  function choose(option: CatalogOption) {
    onChange(option);
    closeCreate();
  }

  async function handleCreate() {
    if (!creatingName?.trim()) return;
    setSaving(true);
    setError(null);
    setExisting(null);
    try {
      choose(await create(creatingName.trim()));
    } catch (err) {
      if (err instanceof ConflictError) setExisting(err.existing as CatalogOption);
      else setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  const alreadyCreated = feminine ? 'ya está creada' : 'ya está creado';
  const existingIsInactive = existing?.isActive === false;

  return (
    <>
      <Autocomplete<CatalogOption>
        value={value ? value.name : text}
        onChange={handleTextChange}
        onSearch={handleSearch}
        onSelect={choose}
        suggestions={suggestions}
        getLabel={o => o.name}
        getKey={o => o.id}
        placeholder={placeholder}
        minChars={2}
        emptyMessage={`No hay ${entity} con ese nombre`}
        onCreate={openCreate}
        createLabel={q => `Crear ${entity} «${q}»`}
      />

      <Modal
        isOpen={creatingName !== null}
        onClose={closeCreate}
        title={`Crear ${entity}`}
        size="sm"
        footer={
          <>
            <Button label="Cancelar" variant="outline" color="neutral" onClick={closeCreate} disabled={saving} />
            <Button label={saving ? 'Creando...' : 'Crear'} onClick={handleCreate} disabled={saving || !creatingName?.trim()} />
          </>
        }
      >
        <div className={styles.form}>
          <label className={styles.label}>
            Nombre
            <input
              className={styles.input}
              value={creatingName ?? ''}
              onChange={e => { setCreatingName(e.target.value); setExisting(null); }}
              maxLength={100}
              autoFocus
            />
          </label>

          {existing && (
            <div className={styles.notice} role="alert">
              <p>
                {existingIsInactive
                  ? `Ya existe «${existing.name}», pero está desactivado. Pide a un administrador que lo reactive.`
                  : `«${existing.name}» ${alreadyCreated}. Puedes buscarlo en el campo y seleccionarlo.`}
              </p>
              {!existingIsInactive && <Button label="Usar esta" size="sm" onClick={() => choose(existing)} />}
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </Modal>
    </>
  );
}
