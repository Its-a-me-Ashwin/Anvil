import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Simple local proxy that fetches external pages so they can be shown in an iframe.
// This bypasses X-Frame-Options / CSP for the dev server only.
function proxyPlugin() {
  return {
    name: 'anvil-proxy',
    configureServer(server: any) {
      server.middlewares.use('/proxy', async (req: any, res: any, next: any) => {
        try {
          const url = new URL(req.url || '/', `http://${req.headers.host}`).searchParams.get('url');
          if (!url) {
            res.statusCode = 400;
            res.end('Missing url query parameter');
            return;
          }

          const target = decodeURIComponent(url);
          const response = await fetch(target, {
            headers: {
              'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          const contentType = response.headers.get('content-type') || 'text/html';
          res.setHeader('Content-Type', contentType);
          res.setHeader('X-Frame-Options', 'SAMEORIGIN');

          const buffer = Buffer.from(await response.arrayBuffer());
          res.statusCode = response.status;
          res.end(buffer);
        } catch (err: any) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'text/html');
          res.end(`<html><body style="color:#fff;background:#0b0d12;font-family:sans-serif;padding:2rem"><h2>Proxy error</h2><p>${err.message}</p></body></html>`);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), proxyPlugin()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
