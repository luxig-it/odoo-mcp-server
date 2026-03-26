import { build } from 'esbuild';

await build({
  entryPoints: ['src/stdio-server.ts'],
  outfile: 'dist/stdio-server.bundle.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: true,
  logLevel: 'info'
});