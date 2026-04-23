import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 开发时直连 vc-biz 源码，改设计侧包后无需每次 `npm run build`。
 * 设为 `1` 可强制走 node_modules 的 dist（与生产构建一致，便于对照）。
 */
const vcBizFromDist = process.env.VCELL_VC_BIZ_FROM_DIST === '1';
const vcBizSrcEntry = path.resolve(
  __dirname,
  '../../../vc-design/packages/vc-biz/src/index.ts'
);

export default defineConfig(({ command }) => {
  /** 仅 dev server 走源码；`vite build` 仍用 node_modules 的 dist，与发布物一致 */
  const useVcBizSrc =
    command === 'serve' && !vcBizFromDist && fs.existsSync(vcBizSrcEntry);

  return {
    plugins: [react()],
    ...(useVcBizSrc
      ? {
          resolve: {
            /** 只替换包根 `vc-biz`，保留 `vc-biz/dist/index.css` 走 node_modules */
            alias: [{ find: /^vc-biz$/, replacement: vcBizSrcEntry }],
          },
        }
      : {}),
    optimizeDeps: {
      exclude: ['vc-biz'],
    },
    server: {
      port: 5174,
      open: true,
      proxy: {
        '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      },
    },
  };
});
