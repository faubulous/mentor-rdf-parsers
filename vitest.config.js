import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.mjs'],
    environment: 'node',
    globals: true
  }
});
