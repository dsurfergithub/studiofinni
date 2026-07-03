import { defineConfig } from 'vitest/config';

// Config de tests separada de vite.config.ts para no arrastrar el plugin PWA
// (innecesario en tests de lógica pura).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
