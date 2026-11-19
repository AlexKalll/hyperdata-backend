import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Task } from './Task.entity';
import { taskTypes } from 'src/utils/constants/Task.constant';

@Entity('task_type')
export class TaskType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: [
      taskTypes.AUDIO_TO_TEXT,
      taskTypes.TEXT_TO_AUDIO,
      taskTypes.TEXT_TO_TEXT,
      taskTypes.IMAGE_TO_TEXT,
    ],
    unique: true,
  })
  task_type: 'audio-text' | 'text-audio' | 'text-text' | 'image-text';

  @Column({ nullable: true })
  created_by: string;

  @Column({ nullable: true })
  updated_by: string;

  @CreateDateColumn()
  created_date: Date;

  @UpdateDateColumn()
  updated_date: Date;

  // Task type has many tasks
  @OneToMany(() => Task, (task) => task.taskType)
  tasks: Task[];
}
