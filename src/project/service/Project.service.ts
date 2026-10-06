import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { Project } from '../entities/Project.entity';
import { AssignProjectManagerDto, GetProjectsDto } from '../dto/Project.dto';
import { PaginationService } from 'src/common/service/pagination.service';
import { QueryOptions } from 'src/utils/queryOption.util';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { UserService } from 'src/auth/service/User.service';
import { RoleService } from 'src/auth/service/Role.service';
import { Role as RoleEnum } from 'src/auth/decorators/roles.enum';
import { User } from 'src/auth/entities/User.entity';
import { Role } from 'src/auth/entities/Role.entity';
import { EmailService } from 'src/email/email.service';
import { paginate, PaginatedResult } from 'src/utils/paginate.util';
import { TaskService } from './Task.service';
import { UserTask } from '../entities/UserTask.entity';
import { UserTaskService } from './UserTask.service';
@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly paginateService: PaginationService<Project>,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
    private readonly userTaskService: UserTaskService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => TaskService))
    private taskService: TaskService,
  ) {
    this.paginateService = new PaginationService<Project>(
      this.projectRepository,
    );
  }

  /**
   * Create a new project
   * @param projectData - The project data
   * @param queryRunner - The query runner
   * @returns Promise<Project> - The created project
   */
  async create(
    projectData: Partial<Project>,
    queryRunner?: QueryRunner,
  ): Promise<Project> {
    const projectBefore = await this.projectRepository.findOne({
      where: { name: projectData.name },
    });
    if (projectBefore) {
      throw new BadRequestException('Project name already exists');
    }
    if (queryRunner) {
      const manager = queryRunner.manager;
      const project = manager.create(Project, projectData);
      return await manager.save(Project, project);
    } else {
      const manager = this.projectRepository;
      const project = manager.create(projectData);
      return await manager.save(project);
    }
  }

  /**
   * Create a new project and assign a project manager if provided.
   * @param projectData - The project data
   * @param queryRunner - The query runner
   * @param manager_email - The email of the project manager
   * @returns Promise<Project> - The created project
   */
  async createProjectWithManager(
    projectData: Partial<Project>,
    queryRunner: QueryRunner,
    manager_email?: string,
  ): Promise<Project> {
    const project = await this.create(projectData, queryRunner);
    if (manager_email) {
      await this.assignProjectManager(
        { email: manager_email, project_id: project.id },
        queryRunner,
      );
    }
    return project;
  }

  async findAll(
    queryOption: QueryOptions<Project>,
    queryRunner?: QueryRunner,
  ): Promise<Project[]> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    const manager = queryRunner ? queryRunner.manager : this.projectRepository;
    return await manager.find(options);
  }

  async findPaginate(
    queryOption: QueryOptions<Project>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Project>> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    return await this.paginateService.paginateWithOptionQuery(
      paginationDto,
      'project',
      queryOption,
    );
  }
  async searchPaginate(
    searchSchema: GetProjectsDto,
    manager_id?: string,
  ): Promise<PaginatedResult<Project>> {
    const projects = this.projectRepository
      .createQueryBuilder('project')
      .where('project.is_archived = false');
    if (searchSchema.manager_id || manager_id) {
      projects.andWhere('project.manager_id = :manager_id', {
        manager_id: searchSchema.manager_id || manager_id,
      });
    }
    if (searchSchema.name) {
      projects.andWhere('project.name ILIKE :name', {
        name: `%${searchSchema.name}%`,
      });
    }
    if (searchSchema.status) {
      projects.andWhere('project.status = :status', {
        status: searchSchema.status,
      });
    }
    if (searchSchema.search) {
      if (searchSchema.search) {
        const searchTerm = `%${searchSchema.search.trim()}%`; // Add wildcards for partial matching
        projects.andWhere(
          `(project.name ILIKE :search OR EXISTS (
              SELECT 1 FROM unnest(project.tags) AS tag WHERE tag ILIKE :search
            ))`,
          { search: searchTerm },
        );
      }
    }
    projects.orderBy('project.start_date', 'DESC');
    const page = searchSchema.page || 1;
    const limit = searchSchema.limit || 10;
    const skip = (page - 1) * limit;
    const [result, total] = await projects
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return paginate(result, total, page, limit);
  }

  async findOne(
    queryOption: QueryOptions<Project>,
    queryRunner?: QueryRunner,
  ): Promise<Project | null> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }

    if (queryRunner) {
      const manager = queryRunner.manager;
      return await manager.findOne(Project, options);
    }

    const manager = this.projectRepository;
    return await manager.findOne(options);
  }

  async update(
    id: string,
    projectData: Partial<Project>,
    queryRunner?: QueryRunner,
  ): Promise<Project | null> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      await manager.update(Project, id, projectData);
      return await manager.findOne(Project, { where: { id } });
    } else {
      const manager = this.projectRepository;
      await manager.update(id, projectData);
      return await manager.findOne({ where: { id } });
    }
  }

  async remove(id: string): Promise<void> {
    await this.projectRepository.delete(id);
    return;
  }
  async archiveToggle(id: string): Promise<Project | null> {
    const project = await this.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }
    project.is_archived = !project.is_archived;
    return await this.update(id, project);
  }
  /**
   * Assigns a project manager to a project
   * @param projectManager - object containing email and project id of the project manager
   * @param queryRunner - query runner to use for database operations
   * @returns a promise resolving to the updated project
   * @throws {NotFoundException} - if the project is not found
   * @throws {NotFoundException} - if the role is not found
   */
  async assignProjectManager(
    projectManager: AssignProjectManagerDto,
    queryRunner: QueryRunner,
  ): Promise<Project | null> {
    let user: User | null = await this.userService.findOne({
      where: { email: projectManager.email },
    });
    const role: Role | null = await this.roleService.findOne({
      name: RoleEnum.PROJECT_MANAGER,
    });
    const project: Project | null = await this.findOne(
      { where: { id: projectManager.project_id } },
      queryRunner,
    );

    if (!project) {
      throw new NotFoundException(`Project not found`);
    }
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    if (user) {
      const userEmail = user.email;
      this.emailService
        .sendEmail(
          userEmail,
          'Welcome to Mahder platform',
          `
          Dear ${user.first_name} ${user.middle_name},you are assigned as a Project Manager for the project ${project?.name}
          `,
        )
        .catch((err) => {
          console.error(
            `Failed to send email to ${userEmail}:`,
            err instanceof Error ? err.message : err,
          );
        });
    }
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8);
      user = await this.userService.create(
        {
          email: projectManager.email,
          role_id: role.id,
          password: randomPassword,
        },
        queryRunner,
      );
      // Send email to user with random password
      const userEmail = user.email;
      this.emailService
        .sendEmail(
          userEmail,
          'Welcome to Mahder platform',
          `
            Dear user, welcome to our platform,you are assigned as a Project Manager for the project ${project?.name}
            Your password is ${randomPassword}
            `,
        )
        .catch((err) => {
          console.error(
            `Failed to send email to ${userEmail}:`,
            err instanceof Error ? err.message : err,
          );
        });
    }
    return await this.update(
      projectManager.project_id,
      { manager_id: user.id },
      queryRunner,
    );
  }
  async findPaginateProjectMembers(
    project_id: string,
    queryOption: QueryOptions<UserTask>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<UserTask>> {
    const project: Project | null = await this.findOne({
      where: { id: project_id },
      relations: { tasks: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    const taskIds = project.tasks.map((task) => task.id);
    if (taskIds.length == 0) {
      return { result: [], total: 0, totalPages: 1, page: 1, limit: 10 };
    }

    return this.userTaskService.findPaginateUniqueMembers(
      taskIds,
      paginationDto,
    );
  }
  async count(queryOption: QueryOptions<Project>): Promise<number> {
    const total_projects: number =
      await this.projectRepository.count(queryOption);
    return total_projects;
  }
  async getProjectManager(project_id: string): Promise<User | null> {
    const project: Project | null = await this.findOne({
      where: { id: project_id },
      relations: { manager: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with id ${project_id} not found`);
    }
    return project.manager;
  }
}
