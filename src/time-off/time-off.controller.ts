import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TimeOffService } from './time-off.service';
import { CreateTimeOffRequestDto } from '../common/dto/create-time-off-request.dto';
import { UpdateTimeOffStatusDto } from '../common/dto/approve-reject-request.dto';
import { TimeOffRequestResponseDto } from '../common/dto/balance-response.dto';
import { TimeOffStatus } from '../common/entities/time-off-request.entity';

@ApiTags('Time-Off')
@Controller('time-off')
export class TimeOffController {
  constructor(private readonly timeOffService: TimeOffService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new time-off request' })
  async create(@Body() dto: CreateTimeOffRequestDto) {
    const request = await this.timeOffService.create(dto);
    return new TimeOffRequestResponseDto({
      id: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      startDate: request.startDate,
      endDate: request.endDate,
      daysRequested: request.daysRequested,
      status: request.status,
      reason: request.reason,
      rejectionReason: request.rejectionReason,
      syncedToHCM: request.syncedToHCM,
      hcmError: request.hcmError,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List time-off requests' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: TimeOffStatus })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: TimeOffStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const requests = await this.timeOffService.findAll({
      employeeId,
      status,
      fromDate,
      toDate,
    });
    return requests.map(
      (r) =>
        new TimeOffRequestResponseDto({
          id: r.id,
          employeeId: r.employeeId,
          locationId: r.locationId,
          startDate: r.startDate,
          endDate: r.endDate,
          daysRequested: r.daysRequested,
          status: r.status,
          reason: r.reason,
          rejectionReason: r.rejectionReason,
          syncedToHCM: r.syncedToHCM,
          hcmError: r.hcmError,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get time-off request by ID' })
  @ApiParam({ name: 'id' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const request = await this.timeOffService.findById(id);
    return new TimeOffRequestResponseDto({
      id: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      startDate: request.startDate,
      endDate: request.endDate,
      daysRequested: request.daysRequested,
      status: request.status,
      reason: request.reason,
      rejectionReason: request.rejectionReason,
      syncedToHCM: request.syncedToHCM,
      hcmError: request.hcmError,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Approve, reject, or cancel a time-off request' })
  @ApiParam({ name: 'id' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeOffStatusDto,
  ) {
    const request = await this.timeOffService.updateStatus(id, dto);
    return new TimeOffRequestResponseDto({
      id: request.id,
      employeeId: request.employeeId,
      locationId: request.locationId,
      startDate: request.startDate,
      endDate: request.endDate,
      daysRequested: request.daysRequested,
      status: request.status,
      reason: request.reason,
      rejectionReason: request.rejectionReason,
      syncedToHCM: request.syncedToHCM,
      hcmError: request.hcmError,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    });
  }
}
