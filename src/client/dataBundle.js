// Browser-side content loader: Vite inlines every JSON under /data and /locales at build time.
import { Registry } from '../core/registry.js';
import { i18n } from '../core/i18n.js';

const dataFiles = import.meta.glob('../../data/**/*.json', { eager: true, import: 'default' });
const localeFiles = import.meta.glob('../../locales/**/*.json', { eager: true, import: 'default' });

export function loadContent() {
  const registry = new Registry().load(dataFiles);
  for (const [path, table] of Object.entries(localeFiles)) {
    const lang = path.split('/locales/')[1].split('/')[0];
    i18n.addTable(lang, table);
  }
  return registry;
}
