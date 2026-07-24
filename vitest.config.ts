import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    // Placeholder config so env-dependent helpers (crypto, etc.) can be unit-tested.
    env: {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      SESSION_SECRET: 'test-session-secret-00000000000000000000000000',
      ENCRYPTION_KEY: 'test-encryption-key-000000000000000000000000000',
    },
  },
  resolve: {
    alias: {
      // Stub server-only so pure helpers can be unit-tested in node.
      'server-only': path.resolve(__dirname, 'tests/stubs/empty.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
