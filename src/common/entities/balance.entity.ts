import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Location } from './location.entity';

export enum BalanceChangeReason {
  INITIAL = 'initial',
  TIME_OFF_REQUEST = 'time_off_request',
  TIME_OFF_CANCELLED = 'time_off_cancelled',
  ANNIVERSARY_BONUS = 'anniversary_bonus',
  YEARLY_REFRESH = 'yearly_refresh',
  HCM_SYNC = 'hcm_sync',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
}

@Entity()
@Unique(['employeeId', 'locationId'])
export class Balance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @ManyToOne(() => Employee, (employee) => employee.balances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employeeId' })
  employee: Employee;

  @ManyToOne(() => Location, (location) => location.balances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'float', default: 0 })
  totalDays: number;

  @Column({ type: 'float', default: 0 })
  usedDays: number;

  @Column({ type: 'float', default: 0 })
  pendingDays: number;

  @Column({ type: 'varchar', default: BalanceChangeReason.INITIAL })
  lastChangeReason: string;

  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  get availableDays(): number {
    return this.totalDays - this.usedDays - this.pendingDays;
  }
}
