import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HCMOrchestratorService } from './hcm-orchestrator.service';
import type { HCMWebhookPayload } from './hcm-client.service';

@ApiTags('HCM Sync')
@Controller('hcm')
export class HCMController {
  private readonly logger = new Logger(HCMController.name);

  constructor(private readonly orchestrator: HCMOrchestratorService) {}

  @Post('sync/pull')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pull all balances from HCM' })
  async pullBalances(): Promise<{ message: string }> {
    await this.orchestrator.pullBalancesFromHCM();
    return { message: 'Balances pulled from HCM successfully' };
  }

  @Post('sync/push')
  @HttpCode(200)
  @ApiOperation({ summary: 'Push all balances to HCM' })
  async pushBalances(): Promise<{ message: string }> {
    await this.orchestrator.pushBalancesToHCM();
    return { message: 'Balances pushed to HCM successfully' };
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive HCM balance change webhook' })
  async webhook(
    @Body() payload: HCMWebhookPayload,
  ): Promise<{ received: boolean }> {
    this.logger.log(`Received HCM webhook: ${payload.eventType}`);
    await this.orchestrator.handleWebhook(payload);
    return { received: true };
  }
}
