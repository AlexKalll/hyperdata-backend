import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/User.entity';

@Entity('transaction')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: ['Credit', 'Withdraw'] })
  type: 'Credit' | 'Withdraw';

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    [key: string]: any;
  };

  @Column({
    type: 'enum',
    enum: [
      'Pending',
      'Done',
      'Reserved',
      'Processing',
      'Submitted',
      'Settled',
      'Failed',
      'Reversed',
    ],
  })
  status:
    | 'Pending'
    | 'Done'
    | 'Reserved'
    | 'Processing'
    | 'Submitted'
    | 'Settled'
    | 'Failed'
    | 'Reversed';

  @Column({ type: 'varchar', nullable: true, unique: true })
  provider_reference: string | null;

  @Column({ type: 'varchar', nullable: true })
  provider_status: string | null;

  @Column({ type: 'varchar', nullable: true })
  failure_reason: string | null;

  @Column({ type: 'uuid' })
  user_id: string;

  @CreateDateColumn()
  created_date: Date;

  @UpdateDateColumn()
  updated_date: Date;

  // Wallet belongs to User
  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
