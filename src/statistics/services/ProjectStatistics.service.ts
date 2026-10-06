import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from 'src/auth/decorators/roles.enum';
import { UserService } from 'src/auth/service/User.service';
import { DialectService, LanguageService } from 'src/base_data/service';
import { MicroTask } from 'src/data_set/entities/MicroTask.entity';
import { DataSetService } from 'src/data_set/service/DataSet.service';
import { MicroTaskService } from 'src/data_set/service/MicroTask.service';
import { Project } from 'src/project/entities/Project.entity';
import { Task } from 'src/project/entities/Task.entity';
import { UserTask } from 'src/project/entities/UserTask.entity';
import { ProjectSanitize } from 'src/project/sanitize';
import { ProjectService } from 'src/project/service/Project.service';
import { TaskService } from 'src/project/service/Task.service';
import { UserTaskService } from 'src/project/service/UserTask.service';
import { In } from 'typeorm';

@Injectable()
export class ProjectStatisticsService {
  constructor(
    private readonly dataSetService: DataSetService,
    private readonly microTaskService: MicroTaskService,
    private readonly taskService: TaskService,
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
    private readonly languageService: LanguageService,
    private readonly dialectService: DialectService,
    private readonly userTaskService: UserTaskService,
  ) {}
  async getAllStatistics(user_id: string, project_id?: string) {
    let project: Project | null;
    console.log(project_id);
    if (project_id) {
      project = await this.projectService.findOne({
        where: { id: project_id },
      });
    } else {
      project = await this.projectService.findOne({
        where: { manager_id: user_id },
      });
    }
    if (!project) {
      return {
        project: null,
        total_data_sets: 0,
        total_micro_tasks: 0,
        total_tasks: 0,
        total_contributors: 0,
        total_facilitators: 0,
        total_reviewers: 0,
      };
    }
    // datasets
    const tasks: Task[] = await this.taskService.findAll({
      where: { project_id: project.id },
      select: { id: true },
    });
    const task_ids: string[] = tasks.map((t) => t.id);
    const microTasks: MicroTask[] = await this.microTaskService.findAll({
      where: { task_id: In(task_ids) },
      select: { id: true },
    });
    const total_data_sets: number = await this.dataSetService.countAll({
      micro_task_id: In(microTasks.map((m) => m.id)),
    });
    const total_micro_tasks: number = microTasks.length;

    // tasks
    const total_tasks: number = tasks.length;
    // users
    let user_tasks: UserTask[] = await this.userTaskService.findAll({
      where: { task_id: In(task_ids) },
      relations: { user: true },
    });
    // remove duplicates with same user_id
    user_tasks = user_tasks.filter(
      (value, index, self) =>
        self.findIndex((t) => t.user_id === value.user_id) === index,
    );
    const total_contributors = user_tasks.filter(
      (t) => t.role == Role.CONTRIBUTOR,
    ).length;
    const total_facilitators = user_tasks.filter(
      (t) => t.role == Role.FACILITATOR,
    ).length;
    const total_reviewers = user_tasks.filter(
      (t) => t.role == Role.REVIEWER,
    ).length;

    return {
      project: ProjectSanitize.from(project),
      total_data_sets,
      total_micro_tasks,
      total_tasks,
      total_contributors,
      total_facilitators,
      total_reviewers,
    };
  }
  async getAllTaskStatistics(user_id: string, task_id: string) {
    const task = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskRequirement: true, taskType: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const microTasks: MicroTask[] = await this.microTaskService.findAll({
      where: { task_id: task.id },
    });
    // let total_data_sets:number=await this.dataSetService.count({where:{micro_task_id:In(microTasks.map(m=>m.id))}});
    const total_micro_tasks: number = microTasks.length;
    // users
    const user_tasks: UserTask[] = await this.userTaskService.findAll({
      where: { task_id: task.id },
      relations: { user: true },
    });

    const total_contributors = user_tasks.filter(
      (t) => t.role == Role.CONTRIBUTOR,
    ).length;
    const total_facilitators = user_tasks.filter(
      (t) => t.role == Role.FACILITATOR,
    ).length;
    const total_reviewers = user_tasks.filter(
      (t) => t.role == Role.REVIEWER,
    ).length;

    return {
      // total_data_sets,
      total_micro_tasks,
      total_contributors,
      total_facilitators,
      total_reviewers,
    };
  }
  async getDataSetStatisticsByProject(
    view_type: 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'WEEKLY',
    project_id?: string,
    manager_id?: string,
  ): Promise<any[]> {
    let project: Project | null = null;
    if (project_id) {
      project = await this.projectService.findOne({
        where: { id: project_id },
        relations: { tasks: true },
      });
    } else if (manager_id) {
      project = await this.projectService.findOne({
        where: { manager_id: manager_id },
        relations: { tasks: true },
      });
    }
    if (!project) {
      return [];
    }
    const tasks = project.tasks.map((t) => t.id);
    const microTasks = await this.microTaskService.findAll({
      where: { task_id: In(tasks) },
    });
    const micro_task_ids: string[] = microTasks.map((m) => m.id);
    if (micro_task_ids.length == 0) {
      return [];
    }
    return this.dataSetService.countByMicroTasks(view_type, micro_task_ids);
  }
  async getDataSetStatisticsByTask(
    view_type: 'WEEKLY' | 'MONTHLY' | 'YEARLY' = 'WEEKLY',
    task_id: string,
  ): Promise<any[]> {
    return this.dataSetService.countByTasks(view_type, task_id);
  }

  async getDataSetByDialectAndLanguage(
    view_type: 'LANGUAGE' | 'DIALECT',
    project_id?: string,
    manager_id?: string,
  ) {
    let project: Project | null = null;
    if (project_id) {
      project = await this.projectService.findOne({
        where: { id: project_id },
        relations: { tasks: true },
      });
    } else if (manager_id) {
      project = await this.projectService.findOne({
        where: { manager_id: manager_id },
        relations: { tasks: true },
      });
    }
    if (!project) {
      return [];
    }
    const tasks = project.tasks.map((t) => t.id);
    const microTasks = await this.microTaskService.findAll({
      where: { task_id: In(tasks) },
    });
    const micro_task_ids = microTasks.map((m) => m.id);
    if (view_type == 'LANGUAGE') {
      return this.dataSetService.getDatasetCountsByLanguage(micro_task_ids);
    } else if (view_type == 'DIALECT') {
      return this.dataSetService.getDatasetCountsByDialect(micro_task_ids);
    }
  }
}
