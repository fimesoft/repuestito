import { FormEvent } from 'react';
import Button from '@/components/ui/Button';
import styles from '../authForm.module.css';
import FloatingInput from '@/components/ui/FloatingInput';
import PasswordInput from '@/components/ui/PasswordInput';

interface Props {
  email: string;
  code: string;
  setCode: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirm: string;
  setConfirm: (value: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}

export default function Reset({
  email,
  code,
  setCode,
  password,
  setPassword,
  confirm,
  setConfirm,
  loading,
  error,
  onSubmit,
  onBack,
}: Props) {
  return (
    <>
      <h1 className={styles.heading}>Nueva contraseña</h1>
      <p className={styles.sub}>Ingresa el código enviado a {email}</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <FloatingInput
          label="Código de verificación"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />
        <PasswordInput
          label="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          autoComplete="new-password"
        />
        <PasswordInput
          label="Confirmar contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repite la contraseña"
          required
          autoComplete="new-password"
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button label={loading ? 'Guardando...' : 'Guardar contraseña'} type="submit" variant="solid" color="primary" size="lg" fullWidth disabled={loading} />
          <button type="button" className={styles.link} onClick={onBack}>
            Volver
          </button>
        </div>
      </form>
    </>
  );
}
