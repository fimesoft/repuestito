import Button from "./Button";
import styles from "./Search.module.css";

interface SearchProps {
  defaultValue?: string;
  placeholder?: string;
}

export default function Search({ defaultValue = "", placeholder = "Buscar por nombre..." }: SearchProps) {
  return (
    <form className={styles.form} method="GET" action="/">
      <input
        className={styles.input}
        name="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
      />
      <Button label="Buscar" type="submit" variant="solid" color="primary" />
    </form>
  );
}
