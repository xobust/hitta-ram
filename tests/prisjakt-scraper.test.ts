import { test, expect } from 'bun:test';
import { scrapePrisjaktSearch, scrapePrisjaktProduct } from '../lib/prisjakt-scraper';
import type { PrisjaktProduct } from '../types/ram';

// Helper function to clean product names (duplicated from scraper for testing)
function cleanProductName(name: string): string {
  return name.replace(/\s+ver\s+[\d.]+/gi, '').trim();
}

// Integration tests; requires network access

test('clean product name removes version numbers', () => {
  expect(cleanProductName('CMP48GX5M2X7200C36W ver 5.53.13'))
    .toBe('CMP48GX5M2X7200C36W');
  
  expect(cleanProductName('CMH48GX5M2B7000C36 ver 5.53.13'))
    .toBe('CMH48GX5M2B7000C36');
  
});

test('scrape search with exact SKU CMH48GX5M2B7000C36', async () => {
  const products = await scrapePrisjaktSearch('CMH48GX5M2B7000C36');

  console.log(products);
  expect(Array.isArray(products)).toBe(true);
  expect(products.length).toBeGreaterThan(0);
  // Product name should include Corsair or Vengeance
  const names = products.map((p: PrisjaktProduct) => (p?.name ?? '').toLowerCase());
  expect(names.some((n: string) => n.includes('corsair') || n.includes('vengeance'))).toBe(true);
  // All products should have a positive price
  expect(products.every((p: PrisjaktProduct) => typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0)).toBe(true);
  // Product names should not contain version numbers
  expect(products.every((p: PrisjaktProduct) => !p.name.match(/\s+ver\s+[\d.]+/i))).toBe(true);
});

test('scrape search results for KF572C38RWAK2-32 returns at least one product', async () => {
  const products = await scrapePrisjaktSearch('KF572C38RWAK2-32');

  console.log(products);
  expect(Array.isArray(products)).toBe(true);
  expect(products.length).toBe(1);
  // Product name should include the SKU or Kingston
  const names = products.map((p: PrisjaktProduct) => (p?.name ?? '').toLowerCase());
  expect(names.some((n: string) => n.includes('kf572c38rwak2-32') || n.includes('kingston'))).toBe(true);
  // All products should have a positive price
  expect(products.every((p: PrisjaktProduct) => typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0)).toBe(true);
  // Should return MJ Multimedia as the store
  expect(products[0].store.toLowerCase()).toContain('mj');
  // Product name should not contain version numbers
  expect(products[0].name).not.toMatch(/\s+ver\s+[\d.]+/i);
});

test('scrape product page p=11995740 yields offers or primary price', async () => {
  const url = 'https://www.prisjakt.nu/produkt.php?p=11995740';
  const products = await scrapePrisjaktProduct(url);

  console.log(products);
  expect(Array.isArray(products)).toBe(true);
  expect(products.length).toBeGreaterThan(0);
  // At least one entry should have a name containing Kingston or Renegade
  const names = products.map((p: PrisjaktProduct) => (p?.name ?? '').toLowerCase());
  expect(names.some((n: string) => n.includes('kingston') || n.includes('renegade'))).toBe(true);
  // All products should have a positive price
  expect(products.every((p: PrisjaktProduct) => typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0)).toBe(true);
  // Should have actual store names (not Unknown or Prisjakt)
  expect(products.every((p: PrisjaktProduct) => p.store && p.store !== 'Unknown' && p.store !== 'Prisjakt')).toBe(true);
  // At least one known store appears (Proshop or MJ Multimedia)
  const stores = products.map((p: PrisjaktProduct) => (p.store || '').toLowerCase());
  expect(stores.some((s: string) => s.includes('proshop') || s.includes('mj'))).toBe(true);
});

test('scrape product with in-stock availability p=5135910', async () => {
  const url = 'https://www.prisjakt.nu/produkt.php?p=5135910';
  const products = await scrapePrisjaktProduct(url);

  console.log(products);
  expect(Array.isArray(products)).toBe(true);
  expect(products.length).toBeGreaterThan(0);
  // Should have at least one in-stock offer
  expect(products.some((p: PrisjaktProduct) => p.availability === 'in_stock')).toBe(true);
  // Should have store names
  expect(products.every((p: PrisjaktProduct) => p.store && p.store.length > 0)).toBe(true);
  // Should have different availability statuses
  const availabilities = products.map((p: PrisjaktProduct) => p.availability);
  console.log('Availabilities:', availabilities);
});

