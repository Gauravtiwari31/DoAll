import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** The app's platform-free logic (repeat rules, time zones, ordering), shared with the website. */
const appSource = fileURLToPath(new URL('../mobile/src', import.meta.url));

const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/;

/**
 * Google AdSense. Its crawler looks for the account tag and the ad script in
 * the HTML itself, so they're written into the pages at build time rather
 * than added by JavaScript. ads.txt at the site root names the publisher as
 * the site's authorised seller (AdSense warns, and earns less, without it).
 */
function adsense(client: string | null): Plugin {
  return {
    name: 'doall-adsense',
    transformIndexHtml() {
      if (!client) {
        return [];
      }
      return [
        {
          tag: 'meta',
          attrs: { name: 'google-adsense-account', content: client },
          injectTo: 'head',
        },
        {
          tag: 'script',
          attrs: {
            async: true,
            src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`,
            crossorigin: 'anonymous',
          },
          injectTo: 'head',
        },
      ];
    },
    generateBundle() {
      if (client) {
        this.emitFile({
          type: 'asset',
          fileName: 'ads.txt',
          source: `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`,
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const client = env.VITE_ADSENSE_CLIENT?.trim() || null;
  if (client && !ADSENSE_CLIENT.test(client)) {
    throw new Error(`VITE_ADSENSE_CLIENT must look like ca-pub-1234567890123456, not "${client}"`);
  }
  return {
    plugins: [react(), adsense(client)],
    resolve: { alias: { '@app': appSource } },
    // Compile the shared app files with this tsconfig too. Otherwise each file
    // uses its nearest one, mobile/tsconfig.json, which extends a package that
    // only the mobile app installs (and a clean build, like Cloudflare's, lacks).
    tsconfig: 'tsconfig.json',
    // The shared app code lives outside this folder.
    server: { fs: { allow: ['..'] } },
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('index.html', import.meta.url)),
          privacy: fileURLToPath(new URL('privacy.html', import.meta.url)),
        },
      },
    },
  };
});
