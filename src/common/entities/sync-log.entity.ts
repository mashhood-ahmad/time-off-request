import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum SyncEntityType {
  TIME_OFF_REQUEST = 'time_off_request',
  BALANCE = 'balance',
  EMPLOYEE = 'employee',
  LOCATION = 'location',
}

export enum SyncAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  SYNC = 'sync',
}

export enum SyncStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Entity()
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  entityType: string;

  @Column()
  entityId: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'text', nullable: true })
  requestPayload: string | null;

  @Column({ type: 'text', nullable: true })
  responsePayload: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
