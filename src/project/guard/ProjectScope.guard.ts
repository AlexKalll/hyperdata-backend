import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from 'src/auth/decorators/roles.enum';
import { Project } from '../entities/Project.entity';
import { Task } from '../entities/Task.entity';

@Injectable()
export class ProjectScopeGuard implements CanActivate {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.user?.role?.name !== Role.PROJECT_MANAGER) return true;

    const projectId =
      request.params?.project_id ||
      request.params?.projectId ||
      request.body?.project_id ||
      request.body?.projectId ||
      request.query?.project_id;
    if (projectId) {
      await this.assertProjectManager(projectId, request.user.id);
      return true;
    }

    const taskId =
      request.params?.task_id ||
      request.params?.taskId ||
      request.body?.task_id;

    // Only fall back to generic :id param for task-specific routes (e.g. /:id, /:id/members).
    if (!taskId && request.params?.id && !request.path?.includes('/project/')) {
      const task = await this.taskRepository.findOne({
        where: { id: request.params.id },
        relations: { project: true },
      });
      if (!task) throw new ForbiddenException('Task is not available');
      await this.assertProjectManager(task.project_id, request.user.id);
    } else if (taskId) {
      const task = await this.taskRepository.findOne({
        where: { id: taskId },
        relations: { project: true },
      });
      if (!task) throw new ForbiddenException('Task is not available');
      await this.assertProjectManager(task.project_id, request.user.id);
    }
    return true;
  }

  private async assertProjectManager(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, manager_id: userId },
    });
    if (!project)
      throw new ForbiddenException('You do not manage this project');
  }
}
