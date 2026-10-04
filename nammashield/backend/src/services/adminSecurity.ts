import { env, isProduction } from '../config/env.js';
import { hash, passwordMatches, secret } from './security.js';

export const adminSessionLifetimeMs = 2 * 60 * 60 * 1000;
export const adminIdleTimeoutMs = 30 * 60 * 1000;
export function adminCredentialVersion(): string {
  return hash('admin-credentials:' + process.env.ADMIN_USERNAME + ':' + process.env.ADMIN_PASSWORD_HASH);
}
export function assertProductionSecurity(): void {
  if (!isProduction) return;
  secret();
  if (!process.env.ADMIN_USERNAME?.trim() || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH ?? '')) {
    throw new Error('Production requires a valid administrator username and password hash.');
  }
  if (['admin_123', 'admin123', 'password', 'password123', 'Admin123!', '12345678'].some(p => passwordMatches(p, process.env.ADMIN_PASSWORD_HASH!))) {
    throw new Error('Replace the known administrator password using npm run reset:admin before production.');
  }
  if (!process.env.ADMIN_ORIGIN?.trim()) throw new Error('Set ADMIN_ORIGIN to the dedicated HTTPS administrator portal before production.');
  if ([...env.clientOrigins, ...env.adminOrigins].some(origin => !origin.startsWith('https://'))) {
    throw new Error('Production website and administrator origins must use HTTPS.');
  }
}
