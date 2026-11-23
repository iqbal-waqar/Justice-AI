// Urdu interface text, keyed by the English text that t() is called with.
// Each area of the app keeps its own file; they are merged here.
import common from './common.js';
import site from './site.js';
import auth from './auth.js';
import research from './research.js';
import workspace from './workspace.js';
import practice from './practice.js';

export default { ...common, ...site, ...auth, ...research, ...workspace, ...practice };
