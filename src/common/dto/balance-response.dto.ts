import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  locationId: string;

  @ApiProperty()
  totalDays: number;

  @ApiProperty()
  usedDays: number;

  @ApiProperty()
  pendingDays: number;

  @ApiProperty()
  availableDays: number;

  @ApiProperty()
  lastChangeReason: string;

  @ApiProperty({ nullable: true })
  lastSyncedAt: Date | null;

  constructor(partial: Partial<BalanceResponseDto>) {
    Object.assign(this, partial);
  }
}

export class TimeOffRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  locationId: string;

  @ApiProperty()
  startDate: string;

  @ApiProperty()
  endDate: string;

  @ApiProperty()
  daysRequested: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty({ nullable: true })
  rejectionReason: string | null;

  @ApiProperty()
  syncedToHCM: boolean;

  @ApiProperty({ nullable: true })
  hcmError: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<TimeOffRequestResponseDto>) {
    Object.assign(this, partial);
  }
}
