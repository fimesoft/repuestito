'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button/Button';
import * as auth from '@/services/auth.service';
import styles from './AuthBlock.module.css';

type View = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

interface Props {
  initialView?: string;
  initialEmail?: string;
}

export default function AuthBlock({ initialView, initialEmail }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>(
    initialView === 'reset' ? 'reset' : 'login',
  );
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirm('');
    setCode('');
  }

  function goTo(v: View) {
    reset();
    setView(v);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await auth.login(email, password);
      router.push('/dashboard/replacement');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await auth.register(email, password);
      setSuccess('Código enviado. Revisa tu correo.');
      goTo('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await auth.verifyEmail(email, code);
      setSuccess('Correo verificado. Ya puedes ingresar.');
      goTo('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await auth.forgotPassword(email);
      setSuccess('Si el correo existe, recibirás un código.');
      goTo('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await auth.resetPassword(email, code, password);
      setSuccess('Contraseña actualizada. Ya puedes ingresar.');
      goTo('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.block}>
      {view === 'login' && (
        <>
          <h1 className={styles.heading}>Bienvenido</h1>
          <p className={styles.sub}>Ingresa a tu cuenta para administrar tu marketplace</p>
          <form className={styles.form} onSubmit={handleLogin}>
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
              <button type="button" className={styles.link} onClick={() => goTo('forgot')}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>
          <div className={styles.divider}>o</div>
          <Button label="Crear cuenta" variant="outline" color="neutral" size="lg" fullWidth onClick={() => goTo('register')} />
        </>
      )}

      {view === 'register' && (
        <>
          <h1 className={styles.heading}>Crear cuenta</h1>
          <p className={styles.sub}>Completa los datos para registrarte</p>
          <form className={styles.form} onSubmit={handleRegister}>
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
                autoComplete="new-password"
              />
            </label>
            <label className={styles.label}>
              Confirmar contraseña
              <input
                className={styles.input}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                autoComplete="new-password"
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <Button label={loading ? 'Registrando...' : 'Registrarse'} type="submit" variant="solid" color="primary" size="lg" fullWidth disabled={loading} />
              <button type="button" className={styles.link} onClick={() => goTo('login')}>
                ¿Ya tienes cuenta? Ingresa aquí
              </button>
            </div>
          </form>
        </>
      )}

      {view === 'verify' && (
        <>
          <h1 className={styles.heading}>Verifica tu correo</h1>
          <p className={styles.sub}>Enviamos un código de 6 dígitos a {email}</p>
          <form className={styles.form} onSubmit={handleVerify}>
            <label className={styles.label}>
              Código de verificación
              <input
                className={`${styles.input} ${styles.codeInput}`}
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
              <button type="button" className={styles.link} onClick={() => goTo('register')}>
                Volver al registro
              </button>
            </div>
          </form>
        </>
      )}

      {view === 'forgot' && (
        <>
          <h1 className={styles.heading}>Recuperar contraseña</h1>
          <p className={styles.sub}>Te enviaremos un código a tu correo</p>
          <form className={styles.form} onSubmit={handleForgot}>
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
              <button type="button" className={styles.link} onClick={() => goTo('login')}>
                Volver al inicio de sesión
              </button>
            </div>
          </form>
        </>
      )}

      {view === 'reset' && (
        <>
          <h1 className={styles.heading}>Nueva contraseña</h1>
          <p className={styles.sub}>Ingresa el código enviado a {email}</p>
          <form className={styles.form} onSubmit={handleReset}>
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
            <label className={styles.label}>
              Nueva contraseña
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"
              />
            </label>
            <label className={styles.label}>
              Confirmar contraseña
              <input
                className={styles.input}
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                autoComplete="new-password"
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <Button label={loading ? 'Guardando...' : 'Guardar contraseña'} type="submit" variant="solid" color="primary" size="lg" fullWidth disabled={loading} />
              <button type="button" className={styles.link} onClick={() => goTo('forgot')}>
                Volver
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
