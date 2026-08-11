import {
  MemoryGroomer,
  createMemoryClient,
  type MemoryClientLike,
} from "@daevox/memory-groomer";
import {
  DialogsMessagesRepository,
  DialogsRepository,
  PrismaClient,
  createPrismaClient,
} from "@daevox/storage";
import { Module } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { CompletionService } from "./completion-service.js";
import { DialogsController } from "./dialogs.controller.js";
import { EventsGateway, OrchestratorEventHandlers } from "./events.js";
import { getCompletion } from "@daevox/domain";
import {
  defaultMemoryGroomerConfig,
  type MemoryGroomerConfig,
} from "./memory-groomer.config.js";
import { MemoryGroomerService } from "./memory-groomer.service.js";
import {
  completionFunctionToken,
  dialogMessagesStoreToken,
  memoryClientToken,
  memoryGroomerConfigToken,
} from "./tokens.js";

class PrismaLifecycle implements OnModuleDestroy {
  constructor(private readonly client: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [DialogsController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: createPrismaClient,
    },
    {
      provide: DialogsRepository,
      useFactory: (client: PrismaClient) => new DialogsRepository(client),
      inject: [PrismaClient],
    },
    {
      provide: DialogsMessagesRepository,
      useFactory: (client: PrismaClient) => new DialogsMessagesRepository(client),
      inject: [PrismaClient],
    },
    {
      provide: dialogMessagesStoreToken,
      useExisting: DialogsMessagesRepository,
    },
    {
      provide: completionFunctionToken,
      useValue: getCompletion,
    },
    {
      provide: memoryGroomerConfigToken,
      useFactory: defaultMemoryGroomerConfig,
    },
    {
      provide: memoryClientToken,
      useFactory: (config: MemoryGroomerConfig): MemoryClientLike =>
        createMemoryClient(config.memoryServiceUrl),
      inject: [memoryGroomerConfigToken],
    },
    {
      provide: MemoryGroomer,
      useFactory: (
        config: MemoryGroomerConfig,
        memoryClient: MemoryClientLike,
      ) =>
        new MemoryGroomer(
          config.baseUrl,
          config.model,
          config.reasoningEffort,
          { memoryClient },
        ),
      inject: [memoryGroomerConfigToken, memoryClientToken],
    },
    {
      provide: PrismaLifecycle,
      useFactory: (client: PrismaClient) => new PrismaLifecycle(client),
      inject: [PrismaClient],
    },
    CompletionService,
    EventsGateway,
    OrchestratorEventHandlers,
    MemoryGroomerService,
  ],
})
class AppModule {}

export { AppModule };
