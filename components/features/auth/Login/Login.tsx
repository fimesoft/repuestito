import { FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Logo from '@/components/shared/Logo';
import styles from '../authForm.module.css';
import FloatingInput from '@/components/ui/FloatingInput';
import PasswordInput from '@/components/ui/PasswordInput';

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
      <div className={styles.loginLogo}>
        <Logo href="/" />
      </div>
      <form className={styles.form} onSubmit={onSubmit}>
        <FloatingInput
          label="Correo electrónico *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <PasswordInput
          label="Contraseña *"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
        <div className={styles.actions}>
          <Button label={loading ? 'Iniciando sesión...' : 'Iniciar sesión'} type="submit" variant="solid" color="primary" size="lg" fullWidth disabled={loading} />
          <button type="button" className={styles.link} onClick={onForgot}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </form>
      <p className={styles.signup}>
        ¿Eres nuevo?{' '}
        <button type="button" className={styles.signupLink} onClick={onRegister}>
          Crear cuenta
        </button>
      </p>
    </>
  );
}
