'use client';

import { useRef, useState } from 'react';
import Button from '@/components/ui/Button/Button';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;

type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

interface JobState {
  jobId: string;
  status: JobStatus;
  total: number;
  succeeded: number;
  failed: number;
  errors: { line: number; reason: string }[];
}

export default function BulkUploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<JobState | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPoller() {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  }

  async function pollStatus(jobId: string) {
    try {
      const res = await fetch(`${API}/api/replacements/bulk-upload/${jobId}/status`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json() as JobState;
      setJob(data);
      if (data.status === 'done' || data.status === 'failed') stopPoller();
    } catch {
      // mantiene el poller corriendo
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setJob(null);
    stopPoller();

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`${API}/api/replacements/bulk-upload`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { code?: string };
        throw new Error(body.code ?? `Error ${res.status}`);
      }
      const { jobId } = await res.json() as { jobId: string };
      setJob({ jobId, status: 'queued', total: 0, succeeded: 0, failed: 0, errors: [] });
      pollerRef.current = setInterval(() => pollStatus(jobId), 2000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  }

  const statusLabel: Record<JobStatus, string> = {
    queued: 'En cola',
    processing: 'Procesando...',
    done: 'Completado',
    failed: 'Error',
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Carga masiva de repuestos</h1>
      <p className={styles.desc}>
        Subí un archivo CSV con los repuestos a importar. Máximo 5 MB.{' '}
        <a href="/templates/repuestos-ejemplo.csv" download className={styles.downloadLink}>
          Descargar CSV de ejemplo
        </a>
      </p>

      <div className={styles.card}>
        <div
          className={styles.dropzone}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className={styles.fileInput}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.uploadIcon}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {file ? (
            <p className={styles.fileName}>{file.name} <span>({(file.size / 1024).toFixed(1)} KB)</span></p>
          ) : (
            <p className={styles.dropText}>Arrastrá un CSV aquí o <span className={styles.link}>hacé clic para elegir</span></p>
          )}
        </div>

        {uploadError && <p className={styles.error}>{uploadError}</p>}

        <Button
          label={uploading ? 'Subiendo...' : 'Iniciar importación'}
          onClick={handleUpload}
          disabled={!file || uploading || (job?.status === 'processing' || job?.status === 'queued')}
          shadow
        />
      </div>

      {job && (
        <div className={styles.jobCard}>
          <div className={styles.jobHeader}>
            <span className={styles.jobId}>Job: <code>{job.jobId}</code></span>
            <span className={`${styles.badge} ${styles[job.status]}`}>{statusLabel[job.status]}</span>
          </div>

          {(job.status === 'processing' || job.status === 'done' || job.status === 'failed') && (
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Total</span>
                <span className={styles.statValue}>{job.total}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Exitosos</span>
                <span className={`${styles.statValue} ${styles.success}`}>{job.succeeded}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Fallidos</span>
                <span className={`${styles.statValue} ${job.failed > 0 ? styles.danger : ''}`}>{job.failed}</span>
              </div>
            </div>
          )}

          {job.errors.length > 0 && (
            <div className={styles.errors}>
              <p className={styles.errorsTitle}>Errores ({job.errors.length})</p>
              <ul className={styles.errorList}>
                {job.errors.map((e, i) => (
                  <li key={i} className={styles.errorItem}>
                    <span className={styles.errorLine}>Línea {e.line}</span>
                    <span>{e.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
