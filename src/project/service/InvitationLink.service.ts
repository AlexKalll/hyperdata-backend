import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InvitationLink } from '../entities/InvitationLink.entity';
import { QueryOptions } from 'src/utils/queryOption.util';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { PaginatedResult } from 'src/utils/paginate.util';
import { PaginationService } from 'src/common/service/pagination.service';
import { UserService } from 'src/auth/service/User.service';
import { User } from 'src/auth/entities/User.entity';
import { RoleService } from 'src/auth/service/Role.service';
import { UserTaskService } from './UserTask.service';
import { ProjectService } from './Project.service';
import { TaskService } from './Task.service';
import {
  Country,
  Dialect,
  Language,
  Region,
  Zone,
} from 'src/base_data/entities';
import { UserSanitize } from 'src/auth/sanitize';
@Injectable()
export class InvitationLinkService {
  constructor(
    @InjectRepository(InvitationLink)
    private readonly invitationLinkRepository: Repository<InvitationLink>,
    private readonly paginateService: PaginationService<InvitationLink>,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly userTaskService: UserTaskService,
    private readonly projectService: ProjectService,
    private readonly taskService: TaskService,
    private readonly dataSource: DataSource,
  ) {
    this.paginateService = new PaginationService<InvitationLink>(
      this.invitationLinkRepository,
    );
  }

  async create(
    invitationData: Partial<InvitationLink>,
  ): Promise<InvitationLink> {
    const invitationLink = this.invitationLinkRepository.create(invitationData);
    return await this.invitationLinkRepository.save(invitationLink);
  }
  async createProjectInvitationLink(
    project_id: string,
    invitationLink: Partial<InvitationLink>,
  ): Promise<InvitationLink> {
    const project = await this.projectService.findOne({
      where: { id: project_id },
    });
    if (!project) {
      throw new BadRequestException('Project not found or deleted');
    }
    return await this.create({ ...invitationLink, project_id });
  }
  async createTaskInvitationLink(
    task_id: string,
    invitationLink: Partial<InvitationLink>,
  ): Promise<InvitationLink> {
    const task = await this.taskService.findOne({ where: { id: task_id } });
    if (!task) {
      throw new BadRequestException('Task not found or deleted');
    }
    return await this.create({ ...invitationLink, task_id });
  }
  async findPaginate(
    queryOption: QueryOptions<InvitationLink>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<InvitationLink>> {
    return this.paginateService.paginateWithOptionQuery(
      paginationDto,
      'invitation_link',
      queryOption,
    );
  }
  async acceptInvitation(invitation_id: string, userData: Partial<User>) {
    const invitationLink = await this.findActiveInvitationLink(invitation_id);
    const role_name = invitationLink.role;
    const role = await this.roleService.findOne({ name: role_name });
    if (!role) {
      throw new BadRequestException('Invitation Role not found or deleted');
    }
    if (invitationLink.current_invitations >= invitationLink.max_invitations) {
      throw new BadRequestException('Invitation limit reached');
    }
    userData.role_id = role.id;
    const invitation_is_project_level = invitationLink.project_id
      ? true
      : false;
    const invitation_is_task_level = invitationLink.task_id ? true : false;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await this.userService.create(userData, queryRunner);
      if (invitation_is_project_level) {
        const project = await this.projectService.findOne({
          where: { id: invitationLink.project_id },
          relations: { tasks: true },
        });
        const projectTasks = project?.tasks.filter(
          (task) => task.is_closed !== true && task.is_archived === false,
        );
        if (projectTasks) {
          await Promise.all(
            projectTasks.map(async (task) => {
              await this.userTaskService.create(
                { task_id: task.id, user_id: user.id, role: role_name },
                queryRunner,
              );
            }),
          );
        }
      } else if (invitation_is_task_level) {
        await this.userTaskService.create(
          {
            task_id: invitationLink.task_id,
            user_id: user.id,
            role: role_name,
          },
          queryRunner,
        );
      }
      invitationLink.current_invitations += 1;
      await queryRunner.commitTransaction();
      await this.invitationLinkRepository.save(invitationLink);
      return UserSanitize.from(user);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      if (queryRunner) {
        try {
          await queryRunner.release();
        } catch (releaseError) {
          console.error('Error releasing queryRunner:', releaseError);
        }
      }
    }
  }
  async findActiveInvitationLink(
    invitation_id: string,
  ): Promise<InvitationLink> {
    const invitationLink = await this.invitationLinkRepository.findOne({
      where: { id: invitation_id },
    });
    if (!invitationLink) {
      throw new BadRequestException('Invitation link not found');
    }
    if (invitationLink.expiry_date < new Date()) {
      throw new BadRequestException('Invitation link has expired');
    }
    return invitationLink;
  }

  async registrationOptions(invitationId: string) {
    await this.findOne({ where: { id: invitationId } });
    // Only the reference fields needed by a valid invitation are exposed.
    const [countries, regions, zones, languages, dialects] = await Promise.all([
      this.dataSource
        .getRepository(Country)
        .find({ select: { id: true, name: true }, order: { name: 'ASC' } }),
      this.dataSource.getRepository(Region).find({
        select: { id: true, name: true, country_id: true },
        order: { name: 'ASC' },
      }),
      this.dataSource.getRepository(Zone).find({
        select: { id: true, name: true, region_id: true },
        order: { name: 'ASC' },
      }),
      this.dataSource
        .getRepository(Language)
        .find({ select: { id: true, name: true }, order: { name: 'ASC' } }),
      this.dataSource.getRepository(Dialect).find({
        select: { id: true, name: true, language_id: true },
        order: { name: 'ASC' },
      }),
    ]);
    return { countries, regions, zones, languages, dialects };
  }
  async findOne(
    queryOption: QueryOptions<InvitationLink>,
  ): Promise<InvitationLink | null> {
    const invitationLink =
      await this.invitationLinkRepository.findOne(queryOption);
    if (!invitationLink) {
      throw new BadRequestException('Invitation link not found');
    }
    if (invitationLink?.expiry_date < new Date()) {
      throw new BadRequestException('Invitation link has expired');
    }
    if (
      invitationLink?.current_invitations >= invitationLink?.max_invitations
    ) {
      throw new BadRequestException('Invitation limit reached');
    }
    return invitationLink;
  }

  async delete(id: string): Promise<void> {
    await this.invitationLinkRepository.delete(id);
    return;
  }
}
