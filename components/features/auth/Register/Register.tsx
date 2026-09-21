import { FormEvent } from 'react';
import Button from '@/components/ui/Button';
import styles from '../authForm.module.css';
import FloatingInput from '@/components/ui/FloatingInput';

interface Props {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirm: string;
  setConfirm: (value: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
  onLogin: () => void;
}

export default function Register({
  email,
  setEmail,
  password,
  setPassword,
  confirm,
  setConfirm,
  loading,
  error,
  onSubmit,
  onLogin,
}: Props) {
  return (
    <>
      <h1 className={styles.heading}>Crear cuenta</h1>
      <p className={styles.sub}>Completa los datos para registrarte</p>
      <form className={styles.form} onSubmit={onSubmit}>
        <FloatingInput
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <FloatingInput
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          autoComplete="new-password"
        />
        <FloatingInput
          label="Confirmar contraseña"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repite la contraseña"
          required
          autoComplete="new-password"
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button label={loading ? 'Registrando...' : 'Registrarse'} type="submit" variant="solid" color="primary" size="lg" fullWidth disabled={loading} />
          <button type="button" className={styles.link} onClick={onLogin}>
            ¿Ya tienes cuenta? Ingresa aquí
          </button>
        </div>
      </form>
    </>
  );
}
