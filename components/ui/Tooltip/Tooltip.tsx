'use client';

import { CSSProperties, ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  color?: string;
}

export default function Tooltip({ content, children, position = 'top', color }: TooltipProps) {
  return (
    <span className={styles.wrapper} style={color ? ({ '--tooltip-accent': color } as CSSProperties) : undefined}>
      {children}
      <span className={`${styles.tooltip} ${styles[position]}`} role="tooltip">
        {content}
      </span>
    </span>
  );
}
