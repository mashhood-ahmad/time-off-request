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
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  externalId: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TimeOffRequest, (request) => request.location)
  timeOffRequests: TimeOffRequest[];

  @OneToMany(() => Balance, (balance) => balance.location)
  balances: Balance[];
}
