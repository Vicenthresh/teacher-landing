import { defineConfig } from 'astro/config';

export default defineConfig({
  // Uncomment once the domain exists (also needed for sitemap + canonical URLs).
  // site: 'https://teacher-landing.pages.dev',

  build: {
    format: 'directory',
  },

  // Spanish is the default (`/`), English lives under `/en/`.
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
