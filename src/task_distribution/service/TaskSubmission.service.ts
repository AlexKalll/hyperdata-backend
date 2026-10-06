import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ContributorMicroTaskService } from './ContributorMicroTask.service';
import { TaskService } from 'src/project/service/Task.service';
import { UserService } from 'src/auth/service/User.service';
import { Task } from 'src/project/entities/Task.entity';
import { MicroTaskService } from 'src/data_set/service/MicroTask.service';
import { DataSetService } from 'src/data_set/service/DataSet.service';
import { ContributorMicroTasksConstantStatus } from 'src/utils/constants/ContributorMicroTasks.constant';
// import { UserScoreService } from '../../auth/service/UserScore.service';
// import { UserScoreAction } from 'src/utils/constants/UserScoreAction.constant';
import { MicroTask } from 'src/data_set/entities/MicroTask.entity';
import { UserTaskService } from 'src/project/service/UserTask.service';
import { taskTypes, UserTaskStatus } from 'src/utils/constants/Task.constant';
import { User } from 'src/auth/entities/User.entity';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { CacheService } from 'src/cache/CacheService.service';

@Injectable()
export class TaskSubmissionService {
  constructor(
    private readonly dataSetService: DataSetService,
    private readonly contributorMicroTaskService: ContributorMicroTaskService,
    private readonly taskService: TaskService,
    private readonly dataSource: DataSource,
    private readonly userService: UserService,
    private readonly microTaskService: MicroTaskService,
    // private readonly userScoreService: UserScoreService,
    private readonly userTaskService: UserTaskService,
    private readonly cacheService: CacheService,
  ) {}

  async submitMultipleTextDatasets(
    user_id: string,
    datasets: {
      micro_task_id: string;
      text_data_set: string;
    }[],
    task_id: string,
    is_test: boolean = false,
  ) {
    const user: User | null = await this.userService.findOne({
      where: { id: user_id },
    });
    const task: Task | null = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskRequirement: true, taskType: true },
    });
    if (!task || task.is_archived || task.is_closed) {
      throw new BadRequestException('Task Not Found');
    }
    const dialect_id = user?.dialect_id;
    const language_id = user?.language_id;
    if (!datasets || datasets.length == 0) {
      throw new BadRequestException('No datasets provided');
    }
    if (!dialect_id || !language_id) {
      throw new BadRequestException('User Dialect or Language not found');
    }
    // filter the micro task ids
    const micro_task_ids = datasets.map((d) => d.micro_task_id);
    const microTasks = await this.assertSubmissionMicroTasks(
      user_id,
      task_id,
      micro_task_ids,
      is_test,
    );
    const contributorSubmittedDataSets = await this.dataSetService.findAll({
      where: { micro_task_id: In(micro_task_ids), contributor_id: user_id },
      select: { id: true, micro_task_id: true, status: true },
    });
    const task_type = task.taskType.task_type || '';
    if (
      [taskTypes.AUDIO_TO_TEXT, taskTypes.TEXT_TO_TEXT].indexOf(task_type) ===
      -1
    ) {
      throw new BadRequestException(`Invalid Dataset Type for this task`); // or throw a custom error
    }
    const microTaskMap = new Map<string, MicroTask>(
      microTasks.map((mt) => [mt.id, mt]),
    );
    await Promise.all(
      datasets.map((item) => {
        const microTask = microTaskMap.get(item.micro_task_id);
        if (!microTask) {
          throw new NotFoundException(
            `MicroTask with id ${item.micro_task_id} not found`,
          );
        }
        return this.dataSetService.validateSubmission(
          contributorSubmittedDataSets.filter(
            (dataSet) => dataSet.micro_task_id === item.micro_task_id,
          ),
          user_id,
          task.taskRequirement.max_retry_per_task,
        );
      }),
    );
    await this.cacheService.clearContributorTaskCache(user_id, task_id);
    if (is_test) {
      const test_micro_tasks = microTasks.filter((m) => m.is_test == true);
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const test_data_set: {
          micro_task_id: string;
          text_data_set: string;
          dialect_id: string;
          language_id: string;
          is_test: boolean;
        }[] = [];

        datasets.forEach((d) => {
          if (test_micro_tasks.find((m) => m.id == d.micro_task_id)) {
            test_data_set.push({
              ...d,
              dialect_id,
              language_id,
              is_test: true,
            });
          }
        });
        const datasets_created =
          await this.dataSetService.createMultipleTextDataSet(
            test_data_set,
            user_id,
            queryRunner,
          );
        await this.taskService.updateOrCreateUserToPending(
          {
            task_id: task_id,
            user_id: user_id,
            role: 'Contributor',
            status: UserTaskStatus.PENDING,
          },
          queryRunner,
        );
        // await this.userScoreService.updateScore(
        //   user_id,
        //   UserScoreAction.SUBMIT,
        //   queryRunner,
        // );
        await queryRunner.commitTransaction();

        return datasets_created;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        if (queryRunner) {
          try {
            await queryRunner.release();
          } catch (_releaseError) {
            /* best effort */
          }
        }
      }
    } else {
      // check and filter those datasets that are in the Contributor MicroTask List

      const filtered_datasets = datasets;
      const data_set_given: {
        micro_task_id: string;
        text_data_set: string;
        dialect_id: string;
        language_id: string;
        is_test: boolean;
      }[] = filtered_datasets.map((d) => ({
        micro_task_id: d.micro_task_id,
        text_data_set: d.text_data_set,
        dialect_id,
        language_id,
        is_test: false,
      }));
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await this.userTaskService.findOneOrCreate(
          { where: { task_id: task_id, user_id: user_id } },
          {
            task_id: task_id,
            user_id: user_id,
            role: 'Contributor',
            status: task.require_contributor_test
              ? UserTaskStatus.PENDING
              : UserTaskStatus.ACTIVE,
            has_done_task: true,
          },
          queryRunner,
        );
        const datasetsCreated =
          await this.dataSetService.createMultipleTextDataSet(
            data_set_given,
            user_id,
            queryRunner,
          );
        const contributorMicroTasks =
          await this.contributorMicroTaskService.findOne({
            where: { contributor_id: user_id, task_id: task_id },
          });
        if (contributorMicroTasks) {
          // const userExpectedTasks = contributorMicroTasks.micro_task_ids.slice(
          //   contributorMicroTasks.current_batch,
          //   Math.min(
          //     contributorMicroTasks.current_batch +
          //       contributorMicroTasks.batch,
          //     contributorMicroTasks.total_micro_tasks,
          //   ),
          // );
          // const userDoneExpectedTasks = userExpectedTasks.filter((et) =>
          //   datasets.map((d) => d.micro_task_id).includes(et),
          // );
          // const hasDoneAllExpectedTasks =
          //   userDoneExpectedTasks.length == userExpectedTasks.length;
          // if (!hasDoneAllExpectedTasks) {
          //   throw new BadRequestException(
          //     'You have not submitted all the expected micro tasks for this batch',
          //   );
          // }
          // Retries create a new dataset, but do not complete another microtask.
          const nextTaskIds = datasets.filter(
            (d) =>
              contributorMicroTasks.micro_task_ids.includes(d.micro_task_id) &&
              !contributorSubmittedDataSets.some(
                (previous) => previous.micro_task_id === d.micro_task_id,
              ),
          );
          const current_batch = contributorMicroTasks.current_batch;
          // if (current_batch >= contributorMicroTasks.total_micro_tasks) {
          //   throw new BadRequestException(
          //     'You have already submitted all the micro tasks',
          //   );
          // }
          if (current_batch < contributorMicroTasks.total_micro_tasks) {
            const nextBatch =
              contributorMicroTasks.current_batch + nextTaskIds.length;
            const totalDatasets = contributorMicroTasks.total_micro_tasks;
            const batch = Math.min(totalDatasets, nextBatch);
            if (nextTaskIds.length > 0) {
              const status =
                batch >= contributorMicroTasks.total_micro_tasks
                  ? ContributorMicroTasksConstantStatus.COMPLETED
                  : ContributorMicroTasksConstantStatus.IN_PROGRESS;
              const time_number = task?.contributor_completion_time_limit || 24;
              const new_dead_line = new Date(
                new Date().getTime() + time_number * 60 * 60 * 1000,
              );

              await this.contributorMicroTaskService.update(
                contributorMicroTasks.id,
                {
                  current_batch: batch,
                  dead_line: new_dead_line,
                  status: status,
                },
                queryRunner,
              );
            }
          }
        }

        // await this.userScoreService.updateScore(
        //   user_id,
        //   UserScoreAction.SUBMIT,
        //   queryRunner,
        // );
        await queryRunner.commitTransaction();
        return datasetsCreated;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        if (queryRunner) {
          try {
            await queryRunner.release();
          } catch (_releaseError) {
            /* best effort */
          }
        }
      }
    }
  }

  async submitMultipleAudioDatasets(
    user_id: string,
    datasets: {
      micro_task_id: string;
      file_path: string;
      audio_duration: number;
    }[],
    task_id: string,
    is_test: boolean = false,
  ): Promise<DataSet[]> {
    if (!datasets || datasets.length == 0) {
      throw new BadRequestException('No datasets provided');
    }
    const micro_task_ids = datasets.map((d) => d.micro_task_id);
    const user: User | null = await this.userService.findOne({
      where: { id: user_id },
    });
    const task: Task | null = await this.taskService.findOne({
      where: { id: task_id },
      relations: { taskRequirement: true, taskType: true },
    });
    if (!task) {
      throw new BadRequestException('Task not found');
    }
    // check if task type is valid
    if (!task || task.is_archived || task.is_closed) {
      throw new BadRequestException('Task Not Found');
    }
    const task_type = task.taskType?.task_type || '';
    // const data_set_type = task_type.split('-')[0];
    if (task_type !== taskTypes.TEXT_TO_AUDIO) {
      throw new BadRequestException(`Invalid Dataset Type for this task`); // or throw a custom error
    }
    const dialect_id = user?.dialect_id;
    const language_id = user?.language_id;
    if (!datasets || datasets.length == 0) {
      throw new BadRequestException('No datasets provided');
    }
    if (!dialect_id || !language_id) {
      throw new BadRequestException('User has no dialect and language');
    }
    await this.assertSubmissionMicroTasks(
      user_id,
      task_id,
      micro_task_ids,
      is_test,
    );
    const contributorSubmittedDataSets = await this.dataSetService.findAll({
      where: { micro_task_id: In(micro_task_ids), contributor_id: user_id },
      select: { id: true, micro_task_id: true, status: true },
    });
    await Promise.all(
      datasets.map((item) =>
        this.dataSetService.validateSubmission(
          contributorSubmittedDataSets.filter(
            (dataSet) => dataSet.micro_task_id === item.micro_task_id,
          ),
          user_id,
          task.taskRequirement.max_retry_per_task,
        ),
      ),
    );
    await this.cacheService.clearContributorTaskCache(user_id, task_id);
    if (is_test) {
      const test_microTasks: MicroTask[] =
        await this.microTaskService.findAllTestMicroTasks({
          where: { id: In(micro_task_ids) },
          relations: { dataSets: true },
        });
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const test_data_set: {
          micro_task_id: string;
          file_path: string;
          dialect_id: string;
          language_id: string;
          is_test: boolean;
          audio_duration: number;
        }[] = [];
        datasets.forEach((d) => {
          if (test_microTasks.find((m) => m.id == d.micro_task_id)) {
            test_data_set.push({
              ...d,
              audio_duration: d.audio_duration,
              dialect_id: user.dialect_id,
              language_id: user.language_id,
              is_test: true,
            });
          }
        });
        const savedDataSets =
          await this.dataSetService.createMultipleAudioDataSet(
            test_data_set,
            user_id,
            queryRunner,
          );
        await this.taskService.updateOrCreateUserToPending(
          {
            task_id: task_id,
            user_id: user_id,
            role: 'Contributor',
            status: UserTaskStatus.PENDING,
          },
          queryRunner,
        );
        // await this.userScoreService.updateScore(
        //   user_id,
        //   UserScoreAction.SUBMIT,
        //   queryRunner,
        // );
        await queryRunner.commitTransaction();
        return savedDataSets;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        if (queryRunner) {
          try {
            await queryRunner.release();
          } catch (releaseError) {
            console.log('Error releasing queryRunner:', releaseError);
          }
        }
      }
    } else {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const data_set_given: {
          micro_task_id: string;
          file_path: string;
          dialect_id: string;
          language_id: string;
          is_test: boolean;
          audio_duration: number;
        }[] = datasets.map((d) => ({
          micro_task_id: d.micro_task_id,
          file_path: d.file_path,
          dialect_id,
          language_id,
          is_test: false,
          audio_duration: d.audio_duration,
        }));
        await this.userTaskService.findOneOrCreate(
          { where: { task_id: task_id, user_id: user_id } },
          {
            task_id: task_id,
            user_id: user_id,
            role: 'Contributor',
            status: task.require_contributor_test
              ? UserTaskStatus.PENDING
              : UserTaskStatus.ACTIVE,
            has_done_task: true,
          },
          queryRunner,
        );
        const savedDataSets =
          await this.dataSetService.createMultipleAudioDataSet(
            data_set_given,
            user_id,
            queryRunner,
          );
        const contributorMicroTasks =
          await this.contributorMicroTaskService.findOne({
            where: { contributor_id: user_id, task_id: task_id },
          });
        if (contributorMicroTasks) {
          // Retries create a new dataset, but do not complete another microtask.
          const nextTaskIds = datasets.filter(
            (d) =>
              contributorMicroTasks.micro_task_ids.includes(d.micro_task_id) &&
              !contributorSubmittedDataSets.some(
                (previous) => previous.micro_task_id === d.micro_task_id,
              ),
          );
          const current_batch = contributorMicroTasks.current_batch;
          // if (current_batch >= contributorMicroTasks.total_micro_tasks) {
          // do nothing
          // throw new BadRequestException(
          //   'You have already submitted all the micro tasks',
          // );
          // }
          if (current_batch < contributorMicroTasks.total_micro_tasks) {
            const nextBatch =
              contributorMicroTasks.current_batch + nextTaskIds.length;
            const totalDatasets = contributorMicroTasks.total_micro_tasks;
            const batch = Math.min(totalDatasets, nextBatch);
            if (nextTaskIds.length > 0) {
              const status =
                batch >= contributorMicroTasks.total_micro_tasks
                  ? ContributorMicroTasksConstantStatus.COMPLETED
                  : ContributorMicroTasksConstantStatus.IN_PROGRESS;
              const time_number = task?.contributor_completion_time_limit || 12;
              const new_dead_line = new Date(
                new Date().getTime() + time_number * 60 * 60 * 1000,
              );

              await this.contributorMicroTaskService.update(
                contributorMicroTasks.id,
                {
                  current_batch: batch,
                  dead_line: new_dead_line,
                  status: status,
                },
                queryRunner,
              );
            }
          }
        }

        // await this.userScoreService.updateScore(
        //   user_id,
        //   UserScoreAction.SUBMIT,
        //   queryRunner,
        // );
        await queryRunner.commitTransaction();
        return savedDataSets;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        if (queryRunner) {
          try {
            await queryRunner.release();
          } catch (_releaseError) {
            /* best effort */
          }
        }
      }
    }
  }

  private async assertSubmissionMicroTasks(
    userId: string,
    taskId: string,
    microTaskIds: string[],
    isTest: boolean,
  ): Promise<MicroTask[]> {
    const uniqueIds = [...new Set(microTaskIds)];
    if (uniqueIds.length !== microTaskIds.length) {
      throw new BadRequestException(
        'A micro task may only be submitted once per request',
      );
    }
    const microTasks = await this.microTaskService.findAll({
      where: { id: In(uniqueIds), task_id: taskId },
      select: { id: true, is_test: true },
    });
    if (microTasks.length !== uniqueIds.length) {
      throw new NotFoundException(
        'One or more micro tasks do not belong to this task',
      );
    }
    if (microTasks.some((microTask) => microTask.is_test !== isTest)) {
      throw new BadRequestException(
        'Micro task does not match the submission type',
      );
    }
    if (isTest) {
      return microTasks;
    }
    const assignment = await this.contributorMicroTaskService.findOne({
      where: { contributor_id: userId, task_id: taskId },
    });
    if (!assignment || !assignment.micro_task_ids) {
      throw new ForbiddenException(
        'No micro tasks are assigned to this contributor',
      );
    }
    if (!uniqueIds.every((id) => assignment.micro_task_ids.includes(id))) {
      throw new ForbiddenException(
        'Micro task is not assigned to this contributor',
      );
    }
    return microTasks;
  }
}
