'use client';

import { useState, useRef, FormEvent } from 'react';
import Modal from '../../ui/Modal/Modal';
import Button from '../../ui/Button/Button';
import { createTenant } from '@/services/tenant.service';
import { useCountry } from '@/context/CountryContext';
import styles from './TenantBranchWizard.module.css';

interface TenantForm {
  businessName: string;
  taxId: string;
  subdomain: string;
}

interface BranchForm {
  name: string;
  address: string;
  phone: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TENANT_INITIAL: TenantForm = { businessName: '', taxId: '', subdomain: '' };
const BRANCH_INITIAL: BranchForm = { name: '', address: '', phone: '' };

export default function TenantBranchWizard({ isOpen, onClose }: Props) {
  const { country } = useCountry();
  const [step, setStep] = useState(1);
  const [tenantForm, setTenantForm] = useState<TenantForm>(TENANT_INITIAL);
  const [branchForm, setBranchForm] = useState<BranchForm>(BRANCH_INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantFormRef = useRef<HTMLFormElement>(null);
  const branchFormRef = useRef<HTMLFormElement>(null);

  function reset() {
    setStep(1);
    setTenantForm(TENANT_INITIAL);
    setBranchForm(BRANCH_INITIAL);
    setError(null);
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleTenantChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setTenantForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleBranchChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setBranchForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleStep1(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStep(2);
  }

  async function handleStep2(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // El backend crea el tenant y su primera sucursal en una sola
      // transacción — no hay forma de que quede un tenant sin sucursal.
      await createTenant({
        businessName: tenantForm.businessName,
        taxId: tenantForm.taxId,
        subdomain: tenantForm.subdomain,
        country: country,
        branch: {
          name: branchForm.name,
          ...(branchForm.address ? { address: branchForm.address } : {}),
          ...(branchForm.phone ? { phone: branchForm.phone } : {}),
        },
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (step === 1) tenantFormRef.current?.requestSubmit();
    else branchFormRef.current?.requestSubmit();
  }

  const footer = (
    <>
      {step === 1 ? (
        <Button
          label="Cancelar"
          variant="outline"
          color="neutral"
          onClick={handleClose}
          disabled={loading}
        />
      ) : (
        <Button
          label="Atrás"
          variant="outline"
          color="neutral"
          onClick={() => { setStep(1); setError(null); }}
          disabled={loading}
        />
      )}
      <Button
        label={loading ? 'Guardando...' : step === 1 ? 'Continuar' : 'Guardar'}
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      title={step === 1 ? 'Nuevo local' : 'Primera sucursal'}
      footer={footer}
    >
      <div className={styles.stepper}>
        <div className={styles.step}>
          <div className={stepDot(1)}>1</div>
          <span className={stepLabel(1)}>Local</span>
        </div>
        <div className={styles.connector} />
        <div className={styles.step}>
          <div className={stepDot(2)}>2</div>
          <span className={stepLabel(2)}>Sucursal</span>
        </div>
      </div>

      {step === 1 && (
        <form ref={tenantFormRef} className={styles.form} onSubmit={handleStep1}>
          <label className={styles.label}>
            Nombre del local
            <input
              className={styles.input}
              name="businessName"
              value={tenantForm.businessName}
              onChange={handleTenantChange}
              placeholder="ej. Repuestos García"
              required
            />
          </label>
          <div className={styles.row}>
            <label className={styles.label}>
              CUIT / RUT / NIT
              <input
                className={styles.input}
                name="taxId"
                value={tenantForm.taxId}
                onChange={handleTenantChange}
                placeholder="ej. 20-12345678-9"
                required
              />
            </label>
            <label className={styles.label}>
              Subdominio
              <input
                className={styles.input}
                name="subdomain"
                value={tenantForm.subdomain}
                onChange={handleTenantChange}
                placeholder="ej. garcia-repuestos"
                required
              />
            </label>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      )}

      {step === 2 && (
        <form ref={branchFormRef} className={styles.form} onSubmit={handleStep2}>
          <label className={styles.label}>
            Nombre de la sucursal
            <input
              className={styles.input}
              name="name"
              value={branchForm.name}
              onChange={handleBranchChange}
              placeholder="ej. Sucursal Centro"
              required
            />
          </label>
          <label className={styles.label}>
            Dirección <span className={styles.optional}>(opcional)</span>
            <textarea
              className={styles.textarea}
              name="address"
              value={branchForm.address}
              onChange={handleBranchChange}
              placeholder="ej. Av. Bolívar 1234, piso 2"
            />
          </label>
          <label className={styles.label}>
            Teléfono <span className={styles.optional}>(opcional)</span>
            <input
              className={styles.input}
              name="phone"
              value={branchForm.phone}
              onChange={handleBranchChange}
              placeholder="ej. +54 11 1234-5678"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      )}
    </Modal>
  );
}
