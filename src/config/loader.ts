import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { productConfigSchema } from './schema.js';
import { ConfigError } from '../utils/errors.js';
import type { ProductConfig } from './types.js';

const PRODUCTS_DIR = resolve(import.meta.dirname, '..', 'products');

export async function loadProductConfig(productName: string): Promise<ProductConfig> {
  const filePath = join(PRODUCTS_DIR, `${productName}.yml`);

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new ConfigError(
      `Product config not found: ${filePath}. Create a YAML config for "${productName}".`,
      { productName, filePath },
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new ConfigError(
      `Invalid YAML in product config: ${filePath}`,
      { productName, error: String(err) },
    );
  }

  const result = productConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    ).join('\n');
    throw new ConfigError(
      `Invalid product config for "${productName}":\n${issues}`,
      { productName, issues: result.error.issues },
    );
  }

  return result.data as ProductConfig;
}

export async function listAvailableProducts(): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(PRODUCTS_DIR);
  return files
    .filter((f) => f.endsWith('.yml') && !f.startsWith('_'))
    .map((f) => f.replace('.yml', ''));
}
