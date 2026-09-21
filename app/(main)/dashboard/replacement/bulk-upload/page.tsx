'use client';

import { useRef, useState } from 'react';
import Button from '@/components/ui/Button/Button';
import MainTitle from '@/components/shared/MainTitle';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import FileDropzone from '@/components/shared/FileDropzone';
import { parseCsv } from '@/lib/csv';
import { validateBulkCsv, CsvError } from '@/lib/bulk-upload';
import styles from './page.module.css';

const API = process.env.NEXT_PUBLIC_API_URL;
const MAX_CSV_ERRORS_SHOWN = 50;

type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

interface JobState {
  jobId: string;
  status: JobStatus;
  total: number;
  succeeded: number;
  failed: number;
  catalogCreated: number;
  catalogReused: number;
  brandsCreated: number;
  errors: { line: number; reason: string }[];
}

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [csvErrors, setCsvErrors] = useState<CsvError[]>([]);
  const [validating, setValidating] = useState(false);
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

  async function handleFileSelect(selected: File) {
    setFile(selected);
    setUploadError(null);
    setCsvErrors([]);
    setValidating(true);
    try {
      setCsvErrors(validateBulkCsv(parseCsv(await selected.text())));
    } catch {
      setUploadError('No se pudo leer el archivo');
    } finally {
      setValidating(false);
    }
  }

  function handleDownloadTemplate() {
    const link = document.createElement('a');
    link.href = '/templates/productos-ejemplo.csv';
    link.download = '';
    link.click();
  }

  async function handleUpload() {
    if (!file || csvErrors.length > 0) return;
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
      setJob({ jobId, status: 'queued', total: 0, succeeded: 0, failed: 0, catalogCreated: 0, catalogReused: 0, brandsCreated: 0, errors: [] });
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
      <Breadcrumbs items={[{ label: 'Productos', href: '/dashboard/replacement' }, { label: 'Carga masiva' }]} />
      <MainTitle title="Carga masiva de productos" subtitle="Importá múltiples productos desde un archivo CSV" className={styles.pageTitle} />
      <div className={styles.desc}>
        <Button label="Descargar CSV de ejemplo" onClick={handleDownloadTemplate} variant="secondary" icon="/icons/download.svg" />
      </div>
      <p className={styles.detail}>Columnas obligatorias: <code>name</code>, <code>brand</code>, <code>price</code> y <code>cost</code>. Opcionales: <code>sku</code>, <code>imageUrl</code> y <code>stock</code>.</p>

      <div className={styles.card}>
        <FileDropzone onFileSelect={handleFileSelect} accept=".csv" className={styles.dropzone}>
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
        </FileDropzone>

        {csvErrors.length > 0 && (
          <div className={styles.errors}>
            <p className={styles.errorsTitle}>
              El archivo tiene {csvErrors.length} {csvErrors.length === 1 ? 'error' : 'errores'}: corrígelos y vuelve a elegirlo
            </p>
            <ul className={styles.errorList}>
              {csvErrors.slice(0, MAX_CSV_ERRORS_SHOWN).map((e, i) => (
                <li key={i} className={styles.errorItem}>
                  <span className={styles.errorLine}>Línea {e.line}</span>
                  <span>{e.reason}</span>
                </li>
              ))}
            </ul>
            {csvErrors.length > MAX_CSV_ERRORS_SHOWN && <p className={styles.detail}>… y {csvErrors.length - MAX_CSV_ERRORS_SHOWN} más</p>}
          </div>
        )}

        {uploadError && <p className={styles.error}>{uploadError}</p>}

        <Button
          label={uploading ? 'Subiendo...' : 'Iniciar carga'}
          onClick={handleUpload}
          disabled={!file || validating || csvErrors.length > 0 || uploading || (job?.status === 'processing' || job?.status === 'queued')}
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

          {job.succeeded > 0 && (
            <p className={styles.detail}>
              {job.catalogCreated} nuevo{job.catalogCreated === 1 ? '' : 's'} en el catálogo · {job.catalogReused} reutilizado{job.catalogReused === 1 ? '' : 's'} de productos ya cargados · {job.brandsCreated} marca{job.brandsCreated === 1 ? '' : 's'} nueva{job.brandsCreated === 1 ? '' : 's'}
            </p>
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
