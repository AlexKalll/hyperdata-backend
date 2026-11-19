import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { PaginationService } from 'src/common/service/pagination.service';
import { QueryOptions } from 'src/utils/queryOption.util';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { TaskType } from '../entities/TaskType.entity';
import { PaginatedResult } from 'src/utils/paginate.util';

@Injectable()
export class TaskTypeService {
  constructor(
    @InjectRepository(TaskType)
    private readonly taskTypeRepository: Repository<TaskType>,
    private readonly paginateService: PaginationService<TaskType>,
  ) {
    this.paginateService = new PaginationService<TaskType>(
      this.taskTypeRepository,
    );
  }

  async onModuleInit() {
    await this.initTaskType();
  }

  async create(
    taskData: Partial<TaskType>,
    queryRunner?: QueryRunner,
  ): Promise<TaskType> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      const project = manager.create(TaskType, taskData);
      return await manager.save(TaskType, project);
    } else {
      const manager = this.taskTypeRepository;
      const task = manager.create(taskData);
      return await manager.save(task);
    }
  }

  async findAll(
    queryOption: QueryOptions<TaskType>,
    queryRunner?: QueryRunner,
  ): Promise<TaskType[]> {
    const options: any = {
      where: queryOption.where,
      order: queryOption.order || {},
      relations: queryOption.relations || [],
    };
    if (queryOption.select) {
      options.select = queryOption.select;
    }
    const manager = queryRunner ? queryRunner.manager : this.taskTypeRepository;
    return await manager.find(options);
  }

  async findPaginate(
    queryOption: QueryOptions<TaskType>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<TaskType>> {
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
      'task',
      queryOption,
    );
  }

  async findOne(
    queryOption: QueryOptions<TaskType>,
    queryRunner?: QueryRunner,
  ): Promise<TaskType | null> {
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
      return await manager.findOne(TaskType, options);
    }

    const manager = this.taskTypeRepository;
    return await manager.findOne(options);
  }

  async update(
    id: string,
    taskData: Partial<TaskType>,
    queryRunner?: QueryRunner,
  ): Promise<TaskType | null> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      await manager.update(TaskType, id, taskData);
      return await manager.findOne(TaskType, { where: { id } });
    } else {
      const manager = this.taskTypeRepository;
      await manager.update(id, taskData);
      return await manager.findOne({ where: { id } });
    }
  }

  async remove(id: string): Promise<void> {
    await this.taskTypeRepository.delete(id);
    return;
  }

  async initTaskType(): Promise<void> {
    await Promise.all(
      (['audio-text', 'text-audio', 'text-text', 'image-text'] as const).map(
        async (task_type) => {
          await this.taskTypeRepository.upsert(
            { task_type: task_type },
            { conflictPaths: ['task_type'] },
          );
        },
      ),
    );
    Logger.log('Task Types are initialized');
  }
}
