import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Location } from './location.entity';

export enum TimeOffStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity()
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @ManyToOne(() => Employee, (employee) => employee.timeOffRequests, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @ManyToOne(() => Location, (location) => location.timeOffRequests, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'float' })
  daysRequested: number;

  @Column({
    type: 'varchar',
    default: TimeOffStatus.PENDING,
  })
  status: TimeOffStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'boolean', default: false })
  syncedToHCM: boolean;

  @Column({ type: 'datetime', nullable: true })
  syncedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  hcmError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
