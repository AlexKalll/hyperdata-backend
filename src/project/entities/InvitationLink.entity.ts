import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from './Project.entity';
import { Task } from './Task.entity';
import { Organization } from 'src/base_data/entities/Organization.entity';

@Entity({ name: 'invitation_link' })
export class InvitationLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  project_id: string;

  @Column({ nullable: true })
  task_id: string;

  @ManyToOne(() => Project, (project) => project.invitationLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Task, (task) => task.invitationLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ type: 'timestamp', nullable: true })
  expiry_date: Date | null;

  @Column({ nullable: true })
  max_invitations: number;

  @Column({ default: 0 })
  current_invitations: number;

  @Column({
    nullable: true,
    type: 'enum',
    enum: ['Contributor', 'Facilitator', 'Reviewer'],
  })
  role: 'Contributor' | 'Facilitator' | 'Reviewer';

  @Column({ nullable: true })
  organization_id: string;

  @ManyToOne(
    () => Organization,
    (organization) => organization.invitationLinks,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ nullable: true })
  created_by: string;

  @CreateDateColumn()
  created_date: Date;
}
