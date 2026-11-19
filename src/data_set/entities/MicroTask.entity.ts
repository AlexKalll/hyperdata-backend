import { Task } from 'src/project/entities/Task.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DataSet } from './DataSet.entity';

@Entity('micro_task')
@Index(
  'UQ_micro_task_image_upload',
  ['task_id', 'created_by', 'image_upload_id'],
  {
    unique: true,
  },
)
export class MicroTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column({ default: false })
  is_test: boolean;

  @Column({ type: 'text', nullable: true })
  instruction: string;

  @Column({ nullable: true })
  file_path: string;

  @Column({ type: 'uuid', nullable: true })
  image_upload_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  image_upload_fingerprint: string | null;

  @Column({ type: 'text', nullable: true })
  text: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  has_meet_target_dataset: number;

  @Column({ nullable: true })
  created_by: string;

  @Column({ nullable: true })
  updated_by: string;

  @CreateDateColumn()
  created_date: Date;

  @UpdateDateColumn()
  updated_date: Date;

  @DeleteDateColumn()
  deletedAt: Date;
  // Question belongs to a task

  @ManyToOne(() => Task, (task) => task.microTasks)
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({})
  task_id: string;

  // Question has Many Attempts
  @Column({
    type: 'enum',
    default: 'open',
    enum: ['open', 'closed'],
  })
  status: string;
  @OneToMany(() => DataSet, (dataSet) => dataSet.microTask)
  dataSets: DataSet[];
}
