import './client/ui/panels.css';
import { loadContent } from './client/dataBundle.js';
import { Game } from './client/game.js';
import { setLogLevel } from './core/logger.js';

const params = new URLSearchParams(location.search);
if (params.has('debug')) setLogLevel('debug');

const registry = loadContent();
const dom = { gl: document.getElementById('gl'), overlay: document.getElementById('overlay'), ui: document.getElementById('ui') };
const game = new Game(registry, dom).boot();
if (typeof __DEV_TOOLS__ !== 'undefined' && __DEV_TOOLS__ || params.has('e2e')) window.__game = game;
// quick-start for tools and tests: ?autostart=cls.belfry&seed=abc
if (params.has('autostart')) game.newGame({ classId: `cls.${params.get('autostart') || 'belfry'}`, seed: params.get('seed') ?? 'e2e', name: 'Test' });
