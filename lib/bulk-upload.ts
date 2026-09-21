export interface CsvError { line: number; reason: string }

const REQUIRED_COLUMNS = ['name', 'brand', 'price', 'cost'] as const;

// Límites de la base: numeric(10,2) para price y cost, integer para stock, varchar(100) para la marca
const MAX_MONEY = 99999999.99;
const MAX_STOCK = 2147483647;
const MAX_BRAND_LENGTH = 100;
const MAX_SKU_LENGTH = 64;

const MONEY_FORMAT = /^\d+(\.\d{1,2})?$/;
const INTEGER_FORMAT = /^\d+$/;

/** Tipo de error de un monto: null si es válido. `positive` exige mayor a 0 (precio); si no, admite 0 (costo). */
function moneyError(label: string, raw: string, positive: boolean): string | null {
  if (raw === '') return `Falta el ${label}`;
  if (!MONEY_FORMAT.test(raw)) {
    return `${label[0].toUpperCase()}${label.slice(1)} inválido "${raw}": usa un número ${positive ? 'mayor a 0' : 'sin negativos'}, con punto y hasta 2 decimales`;
  }
  const value = Number(raw);
  if (positive && value <= 0) return `El ${label} debe ser mayor a 0`;
  if (value > MAX_MONEY) return `El ${label} supera el máximo permitido (99.999.999,99)`;
  return null;
}

/**
 * Valida en el navegador las mismas reglas que aplica el backend a cada fila (`BulkUploadRowDto`), más los
 * límites de la base y el largo de las filas, para mostrar los errores antes de subir el archivo.
 * Columnas obligatorias: name, brand, price y cost (el costo solo se exige acá; el API aún lo acepta vacío).
 * Opcionales: sku, imageUrl y stock. La numeración de líneas es la del backend (el encabezado es la línea 1).
 */
export function validateBulkCsv(rows: string[][]): CsvError[] {
  const header = (rows[0] ?? []).map(column => column.trim());
  const missing = REQUIRED_COLUMNS.filter(column => !header.includes(column));
  if (missing.length > 0) {
    return [{ line: 1, reason: `Faltan las columnas obligatorias: ${missing.join(', ')}` }];
  }

  const index = (column: string) => header.indexOf(column);
  const [nameAt, brandAt, priceAt, costAt, stockAt, skuAt] = ['name', 'brand', 'price', 'cost', 'stock', 'sku'].map(index);

  const errors: CsvError[] = [];
  const skuLines = new Map<string, number>();

  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const add = (reason: string | null) => { if (reason) errors.push({ line, reason }); };
    const cell = (at: number) => (at === -1 ? '' : (row[at] ?? '').trim());

    // csv-parse (backend) rechaza las filas con distinta cantidad de columnas y aborta todo el archivo
    if (row.length !== header.length) {
      add(`La fila tiene ${row.length} ${row.length === 1 ? 'columna' : 'columnas'} y el encabezado ${header.length}: revisa las comas y las comillas`);
      return;
    }

    if (cell(nameAt) === '') add('Falta el nombre');

    const brand = cell(brandAt);
    if (brand === '') add('Falta la marca');
    else if (brand.length > MAX_BRAND_LENGTH) add(`La marca supera los ${MAX_BRAND_LENGTH} caracteres`);
    else if (!/[\p{L}\p{N}]/u.test(brand)) add(`La marca "${brand}" no es válida: debe tener letras o números`);

    add(moneyError('precio', cell(priceAt), true));
    add(moneyError('costo', cell(costAt), false));

    const stock = cell(stockAt);
    if (stock !== '' && (!INTEGER_FORMAT.test(stock) || Number(stock) > MAX_STOCK)) {
      add(`Stock inválido "${stock}": usa un número entero de 0 o más`);
    }

    const sku = cell(skuAt);
    if (sku !== '') {
      const normalized = sku.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (normalized === '') add(`El SKU "${sku}" no es válido: debe tener letras o números`);
      else if (normalized.length > MAX_SKU_LENGTH) add(`El SKU supera los ${MAX_SKU_LENGTH} caracteres`);
      else if (skuLines.has(normalized)) add(`El SKU "${normalized}" está duplicado: ya aparece en la línea ${skuLines.get(normalized)}`);
      else skuLines.set(normalized, line);
    }
  });
  return errors;
}
