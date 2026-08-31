import { FormEvent } from 'react';
import Button from '@/components/ui/Button';
import styles from '../authForm.module.css';

interface Props {
  email: string;
  code: string;
  setCode: (value: string) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}

export default function Verify({ email, code, setCode, loading, error, success, onSubmit, onBack }: Props) {
  return (
    <>
      <h1 className={styles.heading}>Verifica tu correo</h1>
      <p className={styles.sub}>Enviamos un código de 6 dígitos a {email}</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          Código de verificación
          <input
            className={styles.input}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            required
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
        <div className={styles.actions}>
          <Button label={loading ? 'Verificando...' : 'Verificar'} type="submit" variant="solid" color="primary" size="lg" fullWidth disabled={loading} />
          <button type="button" className={styles.link} onClick={onBack}>
            Volver al registro
          </button>
        </div>
      </form>
    </>
  );
}
