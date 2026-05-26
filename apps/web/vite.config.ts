import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 判断是否为Electron打包模式
const isElectronBuild = process.env.ELECTRON_BUILD === 'true';

export default defineConfig({
  plugins: [react()],
  // Electron打包时使用相对路径，Web部署时使用/VCell/
  base: isElectronBuild ? './' : '/VCell/',
  resolve: {
    alias: {
      '@vinson.hx/vc-biz': '/Users/chenhui/Desktop/vc-design/packages/vc-biz/dist/index.js',
      '@vinson.hx/vc-design': '/Users/chenhui/Desktop/vc-design/dist/index.js',
      'vc-design': '/Users/chenhui/Desktop/vc-design/dist/index.js',
    },
  },
  server: {
    port: 5174,
    open: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  build: {
    // Electron打包时输出到根目录的dist-electron
    outDir: isElectronBuild ? '../../dist-electron/web' : 'dist',
    emptyOutDir: true,
  },
});