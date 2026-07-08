import Link from 'next/link';
import { getReplacement } from '@/services/replacement.service';
import EditReplacementForm from '@/components/features/replacements/EditReplacementForm';
import styles from '@/styles/Create.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditReplacementPage({ params }: PageProps) {
  const { id } = await params;
  const replacement = await getReplacement(id);

  return (
    <main className={styles.main}>
      <Link href={`/parts/${id}`} className={styles.back}>← Volver</Link>
      <h1 className={styles.title}>Editar repuesto</h1>
      <EditReplacementForm replacement={replacement} />
    </main>
  );
}
