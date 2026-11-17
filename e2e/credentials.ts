import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Sign-in details for the end-to-end run: `E2E_EMAIL` / `E2E_PASSWORD`, or —
 * for local runs — the bootstrap administrator from `../backend/.env`.
 * Nothing is hard-coded and nothing is written anywhere.
 */
export function credentials(): { email: string; password: string } {
  const fromEnv = { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD };
  if (fromEnv.email && fromEnv.password) return { email: fromEnv.email, password: fromEnv.password };

  const envFile = fileURLToPath(new URL('../../backend/.env', import.meta.url));
  if (existsSync(envFile)) {
    const values = new Map<string, string>();
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (match) values.set(match[1], match[2]);
    }
    const email = values.get('BOOTSTRAP_ADMIN_EMAIL');
    const password = values.get('BOOTSTRAP_ADMIN_PASSWORD');
    if (email && password) return { email, password };
  }
  throw new Error('Set E2E_EMAIL and E2E_PASSWORD (or create ../backend/.env with BOOTSTRAP_ADMIN_*).');
}
