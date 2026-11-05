export default {
  server: { port: 5173, host: true },
  esbuild: { jsx: 'automatic' },
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes rarely; split it out so app updates stay small and cache well.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/')) return 'three';
          if (id.includes('@react-three') || id.includes('three-stdlib') || id.includes('troika')) return 'r3f';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
};
