import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTimeOffRequestDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Location ID' })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ description: 'Start date of time-off (ISO 8601)' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'End date of time-off (ISO 8601)' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ description: 'Number of days requested' })
  @IsNumber()
  @Min(0.5)
  daysRequested: number;

  @ApiProperty({ description: 'Reason for time-off', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
