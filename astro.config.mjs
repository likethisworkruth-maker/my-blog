// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://likethis.work',
  integrations: [
    mdx(), 
    sitemap({
      filter: (page) => {
        const excluded = [
          '/403/',
          '/answer/',
          '/results/',
          '/items/',
          '/naraibase/answer/',
          '/problems/',
          '/methods/',
          '/checklists/'
        ];
        return !excluded.some(path => page.includes(path));
      }
    })
  ],
  redirects: {
    '/problems/': '/',
    '/problems/vaccine-schedule-sharing/': '/logs/002-vaccine/',
    '/answer/vaccine-schedule-sharing/': 'https://naraibase.likethis.work/answer/',
    '/methods/': '/apps/',
    '/answer/edit/': '/',
    '/results/vaccine-schedule-sharing/': '/',
    '/methods/family-verbal-reminder/': '/logs/002-vaccine/',
    '/methods/paper-calendar/': '/logs/002-vaccine/',
    '/methods/google-calendar/': '/apps/',
    '/methods/timetree/': '/apps/',
    '/methods/line-message/': '/apps/',
    '/terms/': '/policy/#terms',
    '/privacy/': '/policy/#privacy',
    '/disclaimer/': '/policy/#disclaimer',
    '/naraibase/': 'https://naraibase.likethis.work/',
    '/naraibase/answer/': 'https://naraibase.likethis.work/answer/',
    '/naraibase/answer/edit/': 'https://naraibase.likethis.work/answer/edit/',
    '/naraibase/piano/': 'https://naraibase.likethis.work/piano/',
    '/naraibase/swimming/': 'https://naraibase.likethis.work/swimming/',
    '/naraibase/soccer/': 'https://naraibase.likethis.work/soccer/',
    '/naraibase/baseball/': 'https://naraibase.likethis.work/baseball/',
    '/naraibase/calligraphy/': 'https://naraibase.likethis.work/calligraphy/',
    '/naraibase/abacus/': 'https://naraibase.likethis.work/abacus/',
    '/naraibase/english/': 'https://naraibase.likethis.work/english/',
    '/naraibase/dance/': 'https://naraibase.likethis.work/dance/',
    '/naraibase/ballet/': 'https://naraibase.likethis.work/ballet/',
    '/naraibase/gymnastics/': 'https://naraibase.likethis.work/gymnastics/',
    '/naraibase/martial_arts/': 'https://naraibase.likethis.work/martial_arts/',
    '/naraibase/cram_school/': 'https://naraibase.likethis.work/cram_school/',
    '/naraibase/other/': 'https://naraibase.likethis.work/other/',
  },
  fonts: [
      {
          provider: fontProviders.local(),
          name: 'Atkinson',
          cssVariable: '--font-atkinson',
          fallbacks: ['sans-serif'],
          options: {
              variants: [
                  {
                      src: ['./src/assets/fonts/atkinson-regular.woff'],
                      weight: 400,
                      style: 'normal',
                      display: 'swap',
                  },
                  {
                      src: ['./src/assets/fonts/atkinson-bold.woff'],
                      weight: 700,
                      style: 'normal',
                      display: 'swap',
                  },
              ],
          },
      },
	],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        picomatch: fileURLToPath(new URL('./scripts/picomatch-esm.mjs', import.meta.url)),
      },
    },
  },
});
