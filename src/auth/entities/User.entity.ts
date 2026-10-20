import { DataSet } from 'src/data_set/entities/DataSet.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserLog } from './UserLog.entity';
import { Wallet } from 'src/finance/entities/Wallet.entity';
import Dialect from 'src/base_data/entities/Dialect.entity';
import { Role } from './Role.entity';
import { Language } from 'src/base_data/entities/Language.entity';
import { UserTask } from 'src/project/entities/UserTask.entity';
import { Project } from 'src/project/entities/Project.entity';
import { Region, Zone } from 'src/base_data/entities';
import { UserScore } from './UserScore.entity';
import { ActivityLogs } from 'src/common/entities/ActivityLogs.entity';
import { FacilitatorContributor } from 'src/project/entities/FacilitatorContributor.entity';
import { UserDeviceToken } from './UserDeviceToken.entity';
import { Transaction } from 'src/finance/entities/Transaction.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  middle_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phone_number: string;

  @Column({ unique: true, nullable: true })
  national_id: string;

  @Column({ select: false })
  password: string;

  @Column({ default: false })
  must_change_password: boolean;

  @Column({ nullable: true })
  profile_picture: string;

  @Column({ nullable: true })
  birth_date: Date;

  @Column({ nullable: true, enum: ['Male', 'Female'] })
  gender: 'Male' | 'Female';

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  created_by: string;

  @Column({ nullable: true })
  updated_by: string;

  @CreateDateColumn()
  created_date: Date;

  @UpdateDateColumn()
  updated_date: Date;

  @ManyToOne(() => Language, (language) => language.users)
  @JoinColumn({ name: 'language_id' })
  language: Language;

  @Column({ nullable: true })
  language_id: string;

  @ManyToOne(() => Dialect, (dialect) => dialect.users)
  @JoinColumn({ name: 'dialect_id' })
  dialect: Dialect;

  @Column({ nullable: true })
  dialect_id: string;

  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({})
  role_id: string;

  @Column({ nullable: true })
  woreda: string;

  @Column({ nullable: true })
  city: string;

  @ManyToOne(() => Zone, (zone) => zone.users)
  @JoinColumn({ name: 'zone_id' })
  zone: Zone;

  @Column({ nullable: true })
  zone_id: string;

  @ManyToOne(() => Region, (region) => region.users)
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column({ nullable: true })
  region_id: string;

  @OneToMany(() => DataSet, (attempt) => attempt.contributor)
  @JoinColumn({ name: 'contributor_id' })
  contributes: DataSet[];

  @OneToMany(
    () => FacilitatorContributor,
    (facilitatorContributor) => facilitatorContributor.facilitator,
  )
  @JoinColumn({ name: 'facilitator_id' })
  facilitatorContributors: FacilitatorContributor[];

  @OneToMany(() => DataSet, (attempt) => attempt.reviewer)
  @JoinColumn({ name: 'reviewer_id' })
  reviews: DataSet[];

  @OneToMany(() => UserLog, (userLog) => userLog.user)
  @JoinColumn({ name: 'user_id' })
  userLogs: UserLog[];

  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet[];

  @OneToMany(() => UserTask, (UserTask) => UserTask.user)
  @JoinColumn({ name: 'user_id' })
  userToTasks: UserTask[];

  // User has Many Project as a Manager
  @OneToMany(() => Project, (project) => project.manager)
  @JoinColumn({ name: 'manager_id' })
  projects: Project[];

  @OneToMany(() => UserDeviceToken, (userDeviceToken) => userDeviceToken.user)
  @JoinColumn({ name: 'user_id' })
  userDeviceTokens: UserDeviceToken[];

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  @JoinColumn({ name: 'user_id' })
  transactions: Transaction[];

  @OneToOne(() => UserScore, { eager: true })
  @JoinColumn({ name: 'score_id' })
  score: UserScore;

  @OneToOne(() => ActivityLogs, {})
  activityLogs: ActivityLogs[];

  @Column({ type: 'text', array: true, nullable: true })
  sectors: string[];
}
