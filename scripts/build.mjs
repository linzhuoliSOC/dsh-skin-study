/**
 * Build the dsh-skin-study bundles with esbuild from the DSH checkout.
 *
 * host:   src/index.ts        -> lib/index.js   (esm, platform node)
 * client: src/client/index.ts -> lib/client.js  (cjs wire format:
 *          window.__ModuleLoader__.load({ id, factory }) with exports.apply)
 *
 * The client is pure DOM/CSS (no React), so externals are empty; CSS is
 * inlined as a text string via loader { '.css': 'text' }.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** DSH source checkout root; override with $DSH_SOURCE. */
const CHECKOUT_CANDIDATES = [
  process.env.DSH_SOURCE,
  join(homedir(), '.dsh/source/current'),
  join(homedir(), 'Downloads/Tianxia2/Deepseek_harness'),
].filter(Boolean)
const CHECKOUT = CHECKOUT_CANDIDATES.find((path) => existsSync(path)) ?? CHECKOUT_CANDIDATES[0]

/** Loader entry name — must equal the patch row `name` EXACTLY. */
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const PLUGIN_ID = MANIFEST.name

/** Locate the esbuild package inside a pnpm checkout (store or hoisted). */
function resolveEsbuild(checkout) {
  const store = join(checkout, 'node_modules/.pnpm')
  if (existsSync(store)) {
    const entries = readdirSync(store).filter((name) => name.startsWith('esbuild@')).sort()
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const candidate = join(store, entries[i], 'node_modules/esbuild/package.json')
      if (existsSync(candidate)) return candidate
    }
  }
  const hoisted = join(checkout, 'node_modules/esbuild/package.json')
  if (existsSync(hoisted)) return hoisted
  throw new Error(`esbuild not found under ${checkout} (set DSH_SOURCE to the DSH checkout root)`)
}

const require = createRequire(resolveEsbuild(CHECKOUT))
const esbuild = require('esbuild')

await esbuild.build({
  entryPoints: [join(ROOT, 'src/index.ts')],
  outfile: join(ROOT, 'lib/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
})

console.log('lib/index.js built')

const banner = [
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
  'var module = { exports: {} }; var exports = module.exports;',
].join('\n')
const footer = 'return module.exports; } });'

await esbuild.build({
  entryPoints: [join(ROOT, 'src/client/index.ts')],
  outfile: join(ROOT, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: [],
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.MODE': '"production"',
    'import.meta.env': '{"MODE":"production"}',
  },
  loader: { '.css': 'text' },
  banner: { js: banner },
  footer: { js: footer },
})

console.log('lib/client.js built')
