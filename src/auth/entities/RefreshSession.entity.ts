import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('refresh_session')
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ unique: true })
  token_hash: string;

  @Column()
  expires_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date | null;

  @CreateDateColumn()
  created_date: Date;
}
