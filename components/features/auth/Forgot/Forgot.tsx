import { FormEvent } from 'react';
import Button from '@/components/ui/Button';
import styles from '../authForm.module.css';

interface Props {
  email: string;
  setEmail: (value: string) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}

export default function Forgot({ email, setEmail, loading, error, success, onSubmit, onBack }: Props) {
  return (
    <>
      <h1 className={styles.heading}>Recuperar contraseña</h1>
      <p className={styles.sub}>Te enviaremos un código a tu correo</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          Correo electrónico
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            required
            autoComplete="email"
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
        <div className={styles.actions}>
          <Button label={loading ? 'Enviando...' : 'Enviar código'} type="submit" variant="solid" color="primary" size="lg" fullWidth disabled={loading} />
          <button type="button" className={styles.link} onClick={onBack}>
            Volver al inicio de sesión
          </button>
        </div>
      </form>
    </>
  );
}
