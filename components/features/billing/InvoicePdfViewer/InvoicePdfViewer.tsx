'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { usePDF } from '@react-pdf/renderer';
import { Invoice } from '@/services/billing.service';
import InvoiceDocument from '@/components/features/billing/InvoiceDocument';
import Button from '@/components/ui/Button';
import styles from './InvoicePdfViewer.module.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const PAGE_GUTTER = 32;

function PdfPage({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const targetWidth = (canvas.parentElement?.clientWidth ?? PAGE_GUTTER) - PAGE_GUTTER;
      const unscaledWidth = page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale: targetWidth / unscaledWidth });
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    }

    void render();
    return () => { cancelled = true; };
  }, [pdf, pageNumber]);

  return <canvas ref={canvasRef} className={styles.page} />;
}

export default function InvoicePdfViewer({ invoice }: { invoice: Invoice }) {
  const [instance] = usePDF({ document: <InvoiceDocument invoice={invoice} /> });
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!instance.blob) return;
    let cancelled = false;
    instance.blob
      .arrayBuffer()
      .then(buffer => pdfjsLib.getDocument({ data: buffer }).promise)
      .then(doc => { if (!cancelled) setPdf(doc); });
    return () => { cancelled = true; };
  }, [instance.blob]);

  function handleDownload() {
    if (!instance.url) return;
    const link = document.createElement('a');
    link.href = instance.url;
    link.download = `factura-${invoice.invoiceNumber}.pdf`;
    link.click();
  }

  function handlePrint() {
    if (!instance.url) return;
    const printWindow = window.open(instance.url);
    printWindow?.addEventListener('load', () => printWindow.print());
  }

  if (instance.error) {
    return <p className={styles.error}>Error al generar el PDF</p>;
  }

  if (instance.loading || !pdf) {
    return <p className={styles.hint}>Generando PDF...</p>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <Button label="Descargar PDF" variant="secondary" icon="/icons/download.svg" onClick={handleDownload} />
        <Button label="Imprimir" variant="secondary" icon="/icons/print.svg" onClick={handlePrint} />
      </div>
      <div className={styles.viewer}>
        {Array.from({ length: pdf.numPages }, (_, i) => (
          <PdfPage key={i + 1} pdf={pdf} pageNumber={i + 1} />
        ))}
      </div>
    </div>
  );
}
