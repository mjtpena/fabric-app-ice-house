/**
 * App configuration. No React imports here: tools/seed-fabric.mjs loads this file in Node.
 */
import type { Persona } from '@x10/shared/identity';
import type { AppConfig } from '@x10/shared/runtime';

import { defs, type Schema } from './model';
import { seed } from './seed';

export const personas: Persona[] = [
  { sub: 'demo-admin', name: 'Morgan Ellis', email: 'morgan@example.com', isAdmin: true, role: 'QA lead' },
  { sub: 'demo-user', name: 'Casey Lin', email: 'casey@example.com', isAdmin: false, role: 'Cold-store operator' },
];

export const config: AppConfig<Schema> = {
  appId: 'ice-house',
  title: 'Ice House',
  tagline: 'Cold-chain excursions, MKT & effective shelf life',
  accent: 'cyan',
  logoPaths: [
    'M3 11l9-7 9 7',
    'M5 10v10h14V10',
    'M9 15h6',
    'M12 12v6',
  ],
  defs,
  personas,
  seed,
  nav: [
    { to: '/', label: 'Ice House', end: true },
    { to: '/door-log', label: 'Door log' },
    { to: '/thermometer', label: 'Thermometer' },
    { to: '/thaw', label: 'Thaw table' },
    { to: '/fefo', label: 'FEFO pick' },
    { to: '/melt-ledger', label: 'Melt ledger' },
    { to: '/about', label: 'About' },
  ],
};
