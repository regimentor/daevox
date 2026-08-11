import type { ContextInfo } from "@daevox/contracts";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ContextService } from "./context.service.js";

@Controller()
class ContextController {
  constructor(private readonly context: ContextService) {}

  @Get("api/context")
  async getContextInfo(): Promise<ContextInfo> {
    try {
      return await this.context.getContextInfo();
    } catch (error) {
      throw new ServiceUnavailableException(
        error instanceof Error
          ? error.message
          : "Context metadata is unavailable",
      );
    }
  }
}

export { ContextController };
