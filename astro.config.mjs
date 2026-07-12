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
    '/answer/vaccine-schedule-sharing/': '/naraibase/answer/',
    '/methods/': '/apps/',
    '/answer/edit/': '/',
    '/results/vaccine-schedule-sharing/': '/',
    '/methods/family-verbal-reminder/': '/logs/002-vaccine/',
    '/methods/paper-calendar/': '/logs/002-vaccine/',
    '/methods/google-calendar/': '/apps/',
    '/methods/timetree/': '/apps/',
    '/methods/line-message/': '/apps/',
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