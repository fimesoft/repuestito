import { FormEvent } from 'react';
import Button from '@/components/ui/Button';
import styles from '../authForm.module.css';

interface Props {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  onSubmit: (e: FormEvent) => void;
  onForgot: () => void;
  onRegister: () => void;
}

export default function Login({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  error,
  success,
  onSubmit,
  onForgot,
  onRegister,
}: Props) {
  return (
    <>
      <h1 className={styles.heading}>Bienvenido</h1>
      <p className={styles.sub}>Ingresa a tu cuenta para administrar tu marketplace</p>
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
        <label className={styles.label}>
          Contraseña
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
        <div className={styles.actions}>
          <Button label={loading ? 'Ingresando...' : 'Ingresar'} type="submit" variant="solid" color="primary" size="lg" fullWidth disabled={loading} />
          <button type="button" className={styles.link} onClick={onForgot}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </form>
      <div className={styles.divider}>o</div>
      <Button label="Crear cuenta" variant="outline" color="neutral" size="lg" fullWidth onClick={onRegister} />
    </>
  );
}
