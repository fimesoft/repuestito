'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as auth from '@/services/auth.service';
import Login from '../Login';
import Register from '../Register';
import Verify from '../Verify';
import Forgot from '../Forgot';
import Reset from '../Reset';
import styles from './AuthBlock.module.css';

type View = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

interface Props {
  initialView?: string;
  initialEmail?: string;
}

export default function AuthBlock({ initialView, initialEmail }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView === 'reset' ? 'reset' : 'login');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function resetFields() {
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirm('');
    setCode('');
  }

  function goTo(v: View) {
    resetFields();
    setView(v);
  }

  async function submit(action: () => Promise<void>) {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    submit(async () => {
      await auth.login(email, password);
      router.push('/dashboard');
    });
  }

  function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    submit(async () => {
      await auth.register(email, password);
      setSuccess('Código enviado. Revisa tu correo.');
      goTo('verify');
    });
  }

  function handleVerify(e: FormEvent) {
    e.preventDefault();
    submit(async () => {
      await auth.verifyEmail(email, code);
      setSuccess('Correo verificado. Ya puedes ingresar.');
      goTo('login');
    });
  }

  function handleForgot(e: FormEvent) {
    e.preventDefault();
    submit(async () => {
      await auth.forgotPassword(email);
      setSuccess('Si el correo existe, recibirás un código.');
      goTo('reset');
    });
  }

  function handleReset(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    submit(async () => {
      await auth.resetPassword(email, code, password);
      setSuccess('Contraseña actualizada. Ya puedes ingresar.');
      goTo('login');
    });
  }

  return (
    <div className={styles.block}>
      {view === 'login' && (
        <Login
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          loading={loading}
          error={error}
          success={success}
          onSubmit={handleLogin}
          onForgot={() => goTo('forgot')}
          onRegister={() => goTo('register')}
        />
      )}
      {view === 'register' && (
        <Register
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          confirm={confirm}
          setConfirm={setConfirm}
          loading={loading}
          error={error}
          onSubmit={handleRegister}
          onLogin={() => goTo('login')}
        />
      )}
      {view === 'verify' && (
        <Verify
          email={email}
          code={code}
          setCode={setCode}
          loading={loading}
          error={error}
          success={success}
          onSubmit={handleVerify}
          onBack={() => goTo('register')}
        />
      )}
      {view === 'forgot' && (
        <Forgot
          email={email}
          setEmail={setEmail}
          loading={loading}
          error={error}
          success={success}
          onSubmit={handleForgot}
          onBack={() => goTo('login')}
        />
      )}
      {view === 'reset' && (
        <Reset
          email={email}
          code={code}
          setCode={setCode}
          password={password}
          setPassword={setPassword}
          confirm={confirm}
          setConfirm={setConfirm}
          loading={loading}
          error={error}
          onSubmit={handleReset}
          onBack={() => goTo('forgot')}
        />
      )}
    </div>
  );
}
