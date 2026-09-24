import { createSiteServer } from './app.mts';

const hostname = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8080);
/** Directory served as the site root. Overridable so the same server can serve `dist/`. */
const root = process.env.STATIC_DIR ?? 'public';

const server = createSiteServer(root);

// Kubernetes sends SIGTERM on rollout/scale-down; stop accepting connections and let in-flight ones drain.
process.on('SIGTERM', () => server.close());

server.listen(port, hostname, () => {
  console.log(`Serving ${root} at http://${hostname}:${port.toString()}/`);
});
