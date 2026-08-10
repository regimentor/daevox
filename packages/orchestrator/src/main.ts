import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module.js";

type OrchestratorOptions = {
  host?: string;
  port?: number;
};

const defaultHost = "127.0.0.1";
const defaultPort = 8787;

const startOrchestrator = async (
  options: OrchestratorOptions = {},
) => {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.useWebSocketAdapter(new WsAdapter(app));
  const host = options.host ?? process.env.DAEVOX_ORCHESTRATOR_HOST ?? defaultHost;
  const configuredPort = options.port ?? Number(process.env.DAEVOX_ORCHESTRATOR_PORT);
  const port = Number.isFinite(configuredPort) && configuredPort > 0
    ? configuredPort
    : defaultPort;

  app.enableShutdownHooks();
  await app.listen(port, host);
  return app;
};

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  startOrchestrator().catch((error) => {
    console.error("[orchestrator] failed to start", error);
    process.exitCode = 1;
  });
}

export { defaultHost, defaultPort, startOrchestrator };
export type { OrchestratorOptions };
