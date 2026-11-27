import { ClipboardList, Droplets, Info, ListOrdered, Scale, Snowflake, Thermometer } from 'lucide-react';

import { mountApp } from '@x10/shared/runtime';

import { App } from './App';
import { config } from './app.config';
import './index.css';

const ICONS = {
  '/': <Snowflake className="size-4" />,
  '/door-log': <ClipboardList className="size-4" />,
  '/thermometer': <Thermometer className="size-4" />,
  '/thaw': <Scale className="size-4" />,
  '/fefo': <ListOrdered className="size-4" />,
  '/melt-ledger': <Droplets className="size-4" />,
  '/about': <Info className="size-4" />,
} as const;

mountApp(
  {
    ...config,
    nav: config.nav.map((item) => ({
      ...item,
      icon: ICONS[item.to as keyof typeof ICONS],
    })),
  },
  <App />,
);
