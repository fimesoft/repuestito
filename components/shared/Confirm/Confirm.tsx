'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import styles from './Confirm.module.css';

export interface ConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | boolean | Promise<void | boolean>;
  onSuccess?: () => void;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  loadingLabel?: string;
  successTitle?: string;
  successMessage?: string;
  successDuration?: number;
  confirmColor?: 'primary' | 'success' | 'danger' | 'neutral';
  cancelLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function Confirm({
  isOpen,
  onClose,
  onConfirm,
  onSuccess,
  title = 'Confirmar pedido',
  message = '¿Estás seguro de que querés confirmar este pedido?',
  confirmLabel = 'Confirmar',
  loadingLabel = 'Confirmando…',
  successTitle = '¡Listo!',
  successMessage = 'La acción se realizó correctamente.',
  successDuration = 1400,
  confirmColor = 'primary',
  cancelLabel = 'Cancelar',
  isLoading = false,
  disabled = false,
  size = 'sm',
}: ConfirmProps) {
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = isLoading || submitting;
  const actionsDisabled = disabled || busy;

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function handleClose() {
    if (busy || succeeded) return;
    setSucceeded(false);
    onClose();
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await onConfirm();
      if (result === false) return;
      setSucceeded(true);
      closeTimer.current = setTimeout(() => {
        setSucceeded(false);
        (onSuccess ?? onClose)();
      }, successDuration);
    } catch {
      // The consumer owns the error message; keep the modal open to allow a retry.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={succeeded ? successTitle : title}
      size={size}
      footer={!succeeded ? (
        <>
          <Button
            label={cancelLabel}
            variant="secondary"
            onClick={handleClose}
            disabled={busy}
          />
          <Button
            label={busy ? loadingLabel : confirmLabel}
            variant="solid"
            color={confirmColor}
            onClick={handleConfirm}
            disabled={actionsDisabled}
          />
        </>
      ) : undefined}
    >
      {succeeded ? (
        <div className={styles.success} role="status" aria-live="polite">
          <span className={styles.successIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m6.5 12.5 3.5 3.5 7.5-8" />
            </svg>
          </span>
          <p className={styles.successMessage}>{successMessage}</p>
        </div>
      ) : (
        <div className={styles.content}>{message}</div>
      )}
    </Modal>
  );
}
