import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TimeOffStatus } from '../entities/time-off-request.entity';

export class ApproveRejectRequestDto {
  @ApiProperty({
    description: 'Action to perform',
    enum: ['approve', 'reject'],
  })
  @IsString()
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @ApiProperty({
    description: 'Reason for rejection (required if rejecting)',
    required: false,
  })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

export class UpdateTimeOffStatusDto {
  @ApiProperty({
    description: 'New status',
    enum: [
      TimeOffStatus.APPROVED,
      TimeOffStatus.REJECTED,
      TimeOffStatus.CANCELLED,
    ],
  })
  @IsString()
  @IsIn([
    TimeOffStatus.APPROVED,
    TimeOffStatus.REJECTED,
    TimeOffStatus.CANCELLED,
  ])
  status: TimeOffStatus;

  @ApiProperty({ description: 'Rejection reason', required: false })
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
