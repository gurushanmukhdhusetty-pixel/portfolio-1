// Vercel Function entry: every /api/* request is rewritten here (see vercel.json).
import { handle } from '../server/api.js';

export default { fetch: handle };
