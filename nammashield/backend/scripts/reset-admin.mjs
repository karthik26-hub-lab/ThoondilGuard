import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';

const username = process.env.ADMIN_NEW_USERNAME?.trim();
const password = process.env.ADMIN_NEW_PASSWORD ?? '';

if (!username || password.length < 14 || password.length > 200) {
  throw new Error('ADMIN_NEW_USERNAME and a password of 14–200 characters are required.');
}

const salt = randomBytes(16).toString('hex');
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
let config = readFileSync('.env', 'utf8');

function replaceSetting(key, value) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  config = pattern.test(config) ? config.replace(pattern, line) : `${config.trimEnd()}\n${line}\n`;
}

replaceSetting('ADMIN_USERNAME', username);
replaceSetting('ADMIN_PASSWORD_HASH', passwordHash);
writeFileSync('.env', config, { mode: 0o600 });
console.log('Administrator credentials updated. Restart the backend to apply them.');
