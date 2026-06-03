import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

export interface HCMBalanceResponse {
  employeeId: string;
  locationId: string;
  totalDays: number;
  usedDays: number;
}

export interface HCMDeductionRequest {
  employeeId: string;
  locationId: string;
  days: number;
  requestId: string;
}

export interface HCMDeductionResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface HCMBatchSyncRequest {
  balances: HCMBalanceResponse[];
}

export interface HCMBatchSyncResponse {
  success: boolean;
  processed: number;
  errors: Array<{ employeeId: string; locationId: string; error: string }>;
}

export interface HCMWebhookPayload {
  eventType: 'balance_change' | 'anniversary' | 'yearly_refresh';
  employeeId: string;
  locationId: string;
  totalDays?: number;
  usedDays?: number;
  timestamp: string;
}

@Injectable()
export class HCMClientService {
  private readonly logger = new Logger(HCMClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'HCM_API_URL',
      'http://localhost:3001/hcm-mock',
    );
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const m = (error as { message?: unknown }).message;
      if (typeof m === 'string') return m;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<HCMBalanceResponse> {
    try {
      const response: AxiosResponse<HCMBalanceResponse> = await firstValueFrom(
        this.httpService.get<HCMBalanceResponse>(
          `${this.baseUrl}/employees/${employeeId}/balance`,
          { params: { locationId } },
        ),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch HCM balance for employee ${employeeId} at location ${locationId}: ${this.extractErrorMessage(error)}`,
      );
      throw error;
    }
  }

  async deductBalance(
    request: HCMDeductionRequest,
  ): Promise<HCMDeductionResponse> {
    try {
      const response: AxiosResponse<HCMDeductionResponse> =
        await firstValueFrom(
          this.httpService.post<HCMDeductionResponse>(
            `${this.baseUrl}/employees/${request.employeeId}/balance/deduct`,
            request,
          ),
        );
      return response.data;
    } catch (error) {
      const err = error as unknown;
      let responseData: HCMDeductionResponse | undefined;
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const maybeResponse = (err as { response?: unknown }).response;
        if (
          typeof maybeResponse === 'object' &&
          maybeResponse !== null &&
          'data' in maybeResponse
        ) {
          responseData = (maybeResponse as { data?: unknown })
            .data as HCMDeductionResponse;
        }
      }
      this.logger.error(
        `HCM deduction failed for request ${request.requestId}: ${this.extractErrorMessage(err)}`,
      );
      return {
        success: false,
        error: responseData?.error || this.extractErrorMessage(err),
      };
    }
  }

  async batchSyncBalances(
    balances: HCMBalanceResponse[],
  ): Promise<HCMBatchSyncResponse> {
    try {
      const response: AxiosResponse<HCMBatchSyncResponse> =
        await firstValueFrom(
          this.httpService.post<HCMBatchSyncResponse>(
            `${this.baseUrl}/sync/balances`,
            { balances },
          ),
        );
      return response.data;
    } catch (error) {
      this.logger.error(
        `HCM batch sync failed: ${this.extractErrorMessage(error)}`,
      );
      throw error;
    }
  }
}
