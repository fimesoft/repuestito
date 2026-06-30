'use client';

import dynamic from 'next/dynamic';

const PartMapLeaflet = dynamic(() => import('./PartMapLeaflet'), { ssr: false });

interface PartMapWrapperProps {
  storeLat: number;
  storeLng: number;
  storeName: string;
}

export default function PartMapWrapper(props: PartMapWrapperProps) {
  return <PartMapLeaflet {...props} />;
}
