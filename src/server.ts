import { buildApp } from "./app";
import { env } from "./config/env";

const app = buildApp();

app
  .listen({ port: env.PORT, host: env.HOST })
  .then((address) => {
    app.log.info(`fitness-dashboard-backend listening at ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down gracefully`);
    await app.close();
    process.exit(0);
  });
}
