import { FormEvent, useState } from 'react';
import Button from '@/components/ui/Button';
import Logo from '@/components/shared/Logo';
import styles from '../authForm.module.css';
import FloatingInput from '@/components/ui/FloatingInput';

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);

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
        <FloatingInput
          label="Contraseña *"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          endAdornment={
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          }
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
      <div className={styles.divider}>o</div>
      <Button label="Crear cuenta" variant="outline" color="neutral" size="lg" fullWidth onClick={onRegister} />
    </>
  );
}
