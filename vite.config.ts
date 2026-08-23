import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * ARTIFACT=1 produces a single self-contained page with no service worker,
 * for sharing a clickable preview. It is not the deployable build.
 */
const artifact = process.env.ARTIFACT === '1';

/**
 * Fail the build rather than shipping an app that cannot reach its database.
 * A deploy that silently renders the setup screen is worse than a red build.
 */
function requireEnv(env: Record<string, string>, mode: string): Plugin {
  return {
    name: 'require-env',
    apply: 'build',
    buildStart() {
      if (artifact || mode === 'demo' || env.VITE_DEMO === '1') return;
      const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !env[k]);
      if (missing.length) {
        this.error(
          `Missing required environment: ${missing.join(', ')}.\n` +
            'Set them in the host\'s environment variables, or build with ' +
            '--mode demo for a build with no backend.',
        );
      }
    },
  };
}

/**
 * Content Security Policy, injected as a meta tag so it can name the actual
 * Supabase origin for this deployment. frame-ancestors cannot be set from a
 * meta tag, so that one lives in the host header config alongside it.
 */
function csp(env: Record<string, string>): Plugin {
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml(html) {
      if (artifact) return html;
      let origin = '';
      try {
        origin = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : '';
      } catch {
        origin = '';
      }
      const wss = origin.replace(/^https:/, 'wss:');
      const policy = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        "script-src 'self'",
        // Vite emits a stylesheet, but inline style attributes are used for
        // per-row animation delays and stream tokens.
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data:",
        "manifest-src 'self'",
        `connect-src 'self' ${origin} ${wss}`.trim(),
        // frame-ancestors is deliberately absent: it is ignored in a meta tag
        // and is set as a real header in vercel.json / netlify.toml instead.
      ].join('; ');
      return html.replace(
        /<head>|<title>/i,
        (m) => `<meta http-equiv="Content-Security-Policy" content="${policy}" />\n    ${m}`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  base: artifact ? './' : '/',
  plugins: [
    requireEnv(env, mode),
    csp(env),
    react(),
    !artifact && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Work Register',
        short_name: 'Register',
        description: 'What must I do today, and which stream is falling behind.',
        theme_color: '#F2F4F9',
        background_color: '#F2F4F9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The app shell is cached so it opens on the Underground. Data comes
        // from the query cache; writes go through the offline queue.
        navigateFallback: 'index.html',
        // Fonts are local and already covered by globPatterns, so there is
        // no third-party origin left to cache at runtime.
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: artifact
        ? // The single-file preview must be exactly one script, or the
          // inliner leaves chunk imports pointing at files that do not exist.
          { inlineDynamicImports: true, manualChunks: undefined }
        : {
            manualChunks: {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              supabase: ['@supabase/supabase-js'],
            },
          },
    },
  },
  };
});
