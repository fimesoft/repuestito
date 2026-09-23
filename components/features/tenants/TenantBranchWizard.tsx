'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Confirm from '@/components/shared/Confirm';
import { createTenant } from '@/services/tenant.service';
import { getCountries, type Country } from '@/services/country.service';
import { getDocumentTypes, type DocumentType } from '@/services/document-type.service';
import { ApiError } from '@/services/auth.service';
import { RESERVED_SUBDOMAINS, SUBDOMAIN_MIN_LENGTH, toSubdomain } from '@/lib/subdomain';
import styles from './TenantBranchWizard.module.css';

interface TenantForm {
  businessName: string;
  name: string;
  lastname: string;
  documentTypeId: string;
  taxId: string;
}

interface BranchForm {
  name: string;
  address: string;
  phone: string;
}

type FieldErrors = Partial<Record<keyof TenantForm, string>>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Onboarding propio del usuario: pide su nombre y apellido. */
  isOnboarding?: boolean;
}

const TENANT_INITIAL: TenantForm = { businessName: '', name: '', lastname: '', documentTypeId: '', taxId: '' };
const BRANCH_INITIAL: BranchForm = { name: '', address: '', phone: '' };
const STEPS = ['País', 'Local', 'Sucursal'];

/** Errores del backend que se corrigen en el paso 2, con el campo a marcar. */
const STEP2_ERROR_FIELDS: Record<string, keyof TenantForm> = {
  TENANT_NAME_TAKEN: 'businessName',
  TENANT_NAME_TOO_SHORT: 'businessName',
  TENANT_NAME_RESERVED: 'businessName',
  TENANT_TAX_ID_TAKEN: 'taxId',
  TENANT_TAX_ID_INVALID: 'taxId',
  TENANT_DOCUMENT_TYPE_INVALID: 'documentTypeId',
  TENANT_OWNER_REQUIRED: 'name',
};

/** Mismo formato con el que el backend guarda el documento. */
function normalizeTaxId(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function TenantBranchWizard({ isOpen, onClose, onSuccess, isOnboarding = false }: Props) {
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState('');
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [tenantForm, setTenantForm] = useState<TenantForm>(TENANT_INITIAL);
  const [branchForm, setBranchForm] = useState<BranchForm>(BRANCH_INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const countryFormRef = useRef<HTMLFormElement>(null);
  const tenantFormRef = useRef<HTMLFormElement>(null);
  const branchFormRef = useRef<HTMLFormElement>(null);

  const selectedCountry = countries.find(c => String(c.id) === countryId);
  const selectedDocType = documentTypes.find(d => String(d.id) === tenantForm.documentTypeId);
  const subdomain = toSubdomain(tenantForm.businessName);

  useEffect(() => {
    if (!isOpen || countries.length > 0) return;
    getCountries({ active: true, limit: 100 })
      .then(res => setCountries(res.data))
      .catch(() => setError('No pudimos cargar los países, recargá la página'));
  }, [isOpen, countries.length]);

  function reset() {
    setStep(1);
    setCountryId('');
    setDocumentTypes([]);
    setTenantForm(TENANT_INITIAL);
    setBranchForm(BRANCH_INITIAL);
    setFieldErrors({});
    setError(null);
    setLoading(false);
    setConfirmOpen(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function setTenantField(field: keyof TenantForm, value: string) {
    setTenantForm(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));
  }

  function handleBranchChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setBranchForm(prev => ({ ...prev, [name]: value }));
  }

  function handleCountryChange(value: string) {
    setCountryId(value);
    // Los tipos de documento dependen del país: se vuelven a elegir.
    setDocumentTypes([]);
    setTenantForm(prev => ({ ...prev, documentTypeId: '', taxId: '' }));
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!countryId) { setError('Elegí un país'); return; }
    if (documentTypes.length === 0) {
      setLoading(true);
      try {
        const types = await getDocumentTypes(Number(countryId));
        setDocumentTypes(types);
        const def = types.find(t => t.isDefault) ?? types[0];
        if (def) setTenantForm(prev => ({ ...prev, documentTypeId: String(def.id) }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error inesperado');
        return;
      } finally {
        setLoading(false);
      }
    }
    setStep(2);
  }

  function validateStep2(): FieldErrors {
    const errors: FieldErrors = {};
    if (subdomain.replace(/-/g, '').length < SUBDOMAIN_MIN_LENGTH) {
      errors.businessName = 'El nombre del local debe tener al menos 3 letras o números';
    } else if (RESERVED_SUBDOMAINS.has(subdomain)) {
      errors.businessName = 'Ese nombre de local no está disponible';
    }
    if (isOnboarding && !tenantForm.name.trim()) errors.name = 'Ingresá tu nombre';
    if (isOnboarding && !tenantForm.lastname.trim()) errors.lastname = 'Ingresá tu apellido';
    if (!selectedDocType) {
      errors.documentTypeId = 'Elegí un tipo de documento';
    } else {
      const taxId = normalizeTaxId(tenantForm.taxId);
      const invalid =
        taxId.length === 0 ||
        (selectedDocType.minLength !== null && taxId.length < selectedDocType.minLength) ||
        (selectedDocType.maxLength !== null && taxId.length > selectedDocType.maxLength) ||
        (selectedDocType.pattern !== null && !new RegExp(selectedDocType.pattern).test(taxId));
      if (invalid) errors.taxId = `Formato inválido${selectedDocType.placeholder ? ` (ej. ${selectedDocType.placeholder})` : ''}`;
    }
    return errors;
  }

  function handleStep2(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validateStep2();
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) setStep(3);
  }

  function handleStep3(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    // El backend crea el tenant y su primera sucursal en una sola
    // transacción — no hay forma de que quede un tenant sin sucursal.
    await createTenant({
      businessName: tenantForm.businessName.trim(),
      taxId: normalizeTaxId(tenantForm.taxId),
      country: selectedCountry?.code ?? '',
      documentTypeId: Number(tenantForm.documentTypeId),
      ...(isOnboarding ? { owner: { name: tenantForm.name.trim(), lastname: tenantForm.lastname.trim() } } : {}),
      branch: {
        name: branchForm.name,
        ...(branchForm.address ? { address: branchForm.address } : {}),
        ...(branchForm.phone ? { phone: branchForm.phone } : {}),
      },
    });
  }

  function handleConfirmError(err: unknown): string | void {
    const field = err instanceof ApiError && err.code ? STEP2_ERROR_FIELDS[err.code] : undefined;
    if (!field) return;
    // Error de datos del local: se corrige en el paso 2, marcando el campo.
    setConfirmOpen(false);
    setStep(2);
    setFieldErrors({ [field]: err instanceof Error ? err.message : 'Dato inválido' });
  }

  function handleConfirmSuccess() {
    onSuccess?.();
    handleClose();
  }

  function handleNext() {
    if (step === 1) countryFormRef.current?.requestSubmit();
    else if (step === 2) tenantFormRef.current?.requestSubmit();
    else branchFormRef.current?.requestSubmit();
  }

  function handleBack() {
    setError(null);
    setStep(s => s - 1);
  }

  const footer = (
    <>
      {step === 1 ? (
        !isOnboarding && (
          <Button label="Cancelar" variant="outline" color="neutral" onClick={handleClose} disabled={loading} />
        )
      ) : (
        <Button label="Atrás" variant="outline" color="neutral" onClick={handleBack} disabled={loading} />
      )}
      <Button
        label={loading ? 'Cargando...' : step === 3 ? 'Guardar' : 'Continuar'}
        color="primary"
        onClick={handleNext}
        disabled={loading}
      />
    </>
  );

  const stepDot = (n: number) =>
    [styles.dot, step > n ? styles.done : step === n ? styles.active : '']
      .filter(Boolean)
      .join(' ');

  const stepLabel = (n: number) =>
    [styles.stepLabel, step === n ? styles.active : ''].filter(Boolean).join(' ');

  const summary = (
    <dl className={styles.summary}>
      <dt>País</dt><dd>{selectedCountry?.name}</dd>
      <dt>Local</dt><dd>{tenantForm.businessName.trim()}</dd>
      {isOnboarding && (<><dt>Titular</dt><dd>{tenantForm.name.trim()} {tenantForm.lastname.trim()}</dd></>)}
      <dt>Documento</dt><dd><strong>{selectedDocType?.code}</strong> {normalizeTaxId(tenantForm.taxId)}</dd>
      <dt>Sucursal</dt><dd>{branchForm.name}</dd>
    </dl>
  );

  return (
    <>
      <Modal
        isOpen={isOpen && !confirmOpen}
        onClose={isOnboarding ? () => {} : handleClose}
        size="md"
        title={isOnboarding ? 'Creá el local' : 'Nuevo local'}
        footer={footer}
      >
        <div className={styles.stepper}>
          {STEPS.map((label, i) => (
            <div key={label} className={styles.stepGroup}>
              {i > 0 && <div className={styles.connector} />}
              <div className={styles.step}>
                <div className={stepDot(i + 1)}>{i + 1}</div>
                <span className={stepLabel(i + 1)}>{label}</span>
              </div>
            </div>
          ))}
        </div>

        {step === 1 && (
          <form ref={countryFormRef} className={styles.form} onSubmit={handleStep1}>
            <Label text="¿En qué país está el local?">
              <Select
                value={countryId}
                onChange={handleCountryChange}
                options={countries.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Seleccioná un país"
                required
                ariaLabel="País"
              />
            </Label>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        )}

        {step === 2 && (
          <form ref={tenantFormRef} className={styles.form} onSubmit={handleStep2} noValidate>
            <Input
              label="Nombre de el local"
              name="businessName"
              value={tenantForm.businessName}
              onChange={e => setTenantField('businessName', e.target.value)}
              error={fieldErrors.businessName}
              required
            />
            {isOnboarding && (
              <div className={styles.row}>
                <Input
                  label="Nombre*"
                  name="name"
                  value={tenantForm.name}
                  onChange={e => setTenantField('name', e.target.value)}
                  error={fieldErrors.name}
                  required
                />
                <Input
                  label="Apellido*"
                  name="lastname"
                  value={tenantForm.lastname}
                  onChange={e => setTenantField('lastname', e.target.value)}
                  error={fieldErrors.lastname}
                  required
                />
              </div>
            )}
            <div className={styles.row}>
              <Label text="Tipo de documento">
                <Select
                  value={tenantForm.documentTypeId}
                  onChange={value => setTenantField('documentTypeId', value)}
                  options={documentTypes.map(d => ({ value: d.id, label: d.name }))}
                  placeholder="Seleccioná"
                  required
                  ariaLabel="Tipo de documento"
                />
                {fieldErrors.documentTypeId && <span className={styles.error}>{fieldErrors.documentTypeId}</span>}
              </Label>
              <Input
                label="Número de documento"
                name="taxId"
                value={tenantForm.taxId}
                onChange={e => setTenantField('taxId', e.target.value)}
                placeholder={selectedDocType?.placeholder ? `ej. ${selectedDocType.placeholder}` : undefined}
                error={fieldErrors.taxId}
                required
              />
            </div>
          </form>
        )}

        {step === 3 && (
          <form ref={branchFormRef} className={styles.form} onSubmit={handleStep3}>
            <Label text="Nombre de la sucursal">
              <input
                className={styles.input}
                name="name"
                value={branchForm.name}
                onChange={handleBranchChange}
                required
              />
            </Label>
            <Label text={<>Dirección <span className={styles.optional}>(opcional)</span></>}>
              <textarea
                className={styles.textarea}
                name="address"
                value={branchForm.address}
                onChange={handleBranchChange}
              />
            </Label>
            <Label text={<>Teléfono <span className={styles.optional}>(opcional)</span></>}>
              <input
                className={styles.input}
                name="phone"
                value={branchForm.phone}
                onChange={handleBranchChange}
              />
            </Label>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        )}
      </Modal>

      <Confirm
        isOpen={isOpen && confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        onError={handleConfirmError}
        onSuccess={handleConfirmSuccess}
        title="Confirmar datos del local"
        message={summary}
        confirmLabel="Crear local"
        loadingLabel="Creando…"
        successTitle="¡Local creado!"
        successMessage="Ya podés empezar a cargar tus repuestos."
        size="md"
      />
    </>
  );
}
