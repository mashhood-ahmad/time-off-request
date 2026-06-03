import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import {
  TimeOffRequest,
  TimeOffStatus,
} from '../common/entities/time-off-request.entity';
import { Employee } from '../common/entities/employee.entity';
import { Location } from '../common/entities/location.entity';
import { CreateTimeOffRequestDto } from '../common/dto/create-time-off-request.dto';
import { UpdateTimeOffStatusDto } from '../common/dto/approve-reject-request.dto';
import { BalancesService } from '../balances/balances.service';

export interface TimeOffQueryParams {
  employeeId?: string;
  status?: TimeOffStatus;
  fromDate?: string;
  toDate?: string;
}

@Injectable()
export class TimeOffService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly balancesService: BalancesService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateTimeOffRequestDto): Promise<TimeOffRequest> {
    const employee = await this.employeeRepository.findOne({
      where: { id: dto.employeeId },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    }

    const location = await this.locationRepository.findOne({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new NotFoundException(`Location ${dto.locationId} not found`);
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException('End date must be on or after start date');
    }

    if (dto.daysRequested <= 0) {
      throw new BadRequestException('Days requested must be positive');
    }

    await this.validateNoOverlap(dto.employeeId, dto.startDate, dto.endDate);

    return this.dataSource.transaction(async () => {
      await this.balancesService.reserveDays(
        dto.employeeId,
        dto.locationId,
        dto.daysRequested,
      );

      const request = this.requestRepository.create({
        employeeId: dto.employeeId,
        locationId: dto.locationId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        daysRequested: dto.daysRequested,
        reason: dto.reason || null,
        status: TimeOffStatus.PENDING,
      } as TimeOffRequest);

      return this.requestRepository.save(request);
    });
  }

  async findById(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: ['employee', 'location'],
    });

    if (!request) {
      throw new NotFoundException(`Time-off request ${id} not found`);
    }

    return request;
  }

  async findAll(params: TimeOffQueryParams): Promise<TimeOffRequest[]> {
    const where: Record<string, unknown> = {};

    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.status) where.status = params.status;
    if (params.fromDate) where.startDate = MoreThanOrEqual(params.fromDate);
    if (params.toDate) where.endDate = LessThanOrEqual(params.toDate);

    return this.requestRepository.find({
      where,
      relations: ['employee', 'location'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateTimeOffStatusDto,
  ): Promise<TimeOffRequest> {
    const request = await this.findById(id);

    if (request.status !== TimeOffStatus.PENDING) {
      throw new BadRequestException(
        `Cannot update a ${request.status} request. Only pending requests can be updated.`,
      );
    }

    await this.dataSource.transaction(async () => {
      if (dto.status === TimeOffStatus.APPROVED) {
        await this.balancesService.confirmDeduction(
          request.employeeId,
          request.locationId,
          request.daysRequested,
        );
      } else if (
        dto.status === TimeOffStatus.REJECTED ||
        dto.status === TimeOffStatus.CANCELLED
      ) {
        await this.balancesService.releasePendingDays(
          request.employeeId,
          request.locationId,
          request.daysRequested,
        );
      }
    });

    request.status = dto.status;
    if (dto.rejectionReason) {
      request.rejectionReason = dto.rejectionReason;
    }

    return this.requestRepository.save(request);
  }

  private async validateNoOverlap(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const overlapping = await this.requestRepository
      .createQueryBuilder('r')
      .where('r.employeeId = :employeeId', { employeeId })
      .andWhere('r.status IN (:...statuses)', {
        statuses: [TimeOffStatus.PENDING, TimeOffStatus.APPROVED],
      })
      .andWhere('(r.startDate <= :endDate AND r.endDate >= :startDate)', {
        startDate,
        endDate,
      })
      .getCount();

    if (overlapping > 0) {
      throw new ConflictException(
        'Employee already has a pending or approved time-off request for this period',
      );
    }
  }
}
