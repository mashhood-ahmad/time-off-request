import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TimeOffRequest } from './time-off-request.entity';
import { Balance } from './balance.entity';

@Entity()
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  externalId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  email: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TimeOffRequest, (request) => request.employee)
  timeOffRequests: TimeOffRequest[];

  @OneToMany(() => Balance, (balance) => balance.employee)
  balances: Balance[];
}
