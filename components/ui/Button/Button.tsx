"use client";

import styles from "./Button.module.css";

interface ButtonProps {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "solid" | "outline" | "ghost";
  color?: "primary" | "success" | "danger" | "neutral";
  size?: "sm" | "md" | "lg" | "xl";
  shadow?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  label,
  onClick,
  type = "button",
  variant = "solid",
  color = "primary",
  size = "md",
  shadow = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const classNames = [
    styles.btn,
    styles[variant],
    styles[color],
    styles[size],
    shadow ? styles.shadow : "",
    fullWidth ? styles.fullWidth : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classNames} type={type} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
