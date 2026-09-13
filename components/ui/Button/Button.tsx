"use client";

import styles from "./Button.module.css";

interface ButtonProps {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "solid" | "outline" | "ghost" | "secondary";
  color?: "primary" | "success" | "danger" | "neutral";
  size?: "sm" | "md" | "lg" | "xl";
  icon?: string;
  iconOnly?: boolean;
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
  icon,
  iconOnly = false,
  shadow = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const classNames = [
    styles.btn,
    styles[variant],
    variant === "secondary" ? "" : styles[color],
    iconOnly ? styles.iconOnly : styles[size],
    shadow ? styles.shadow : "",
    fullWidth ? styles.fullWidth : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classNames} type={type} onClick={onClick} disabled={disabled} aria-label={iconOnly ? label : undefined}>
      {icon && <img src={icon} width={iconOnly ? 16 : 12} height={iconOnly ? 16 : 12} alt="" />}
      {!iconOnly && label}
    </button>
  );
}
