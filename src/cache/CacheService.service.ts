import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  TaskMicroTasksResponse,
  ContributorTaskRto,
} from 'src/task_distribution/rto/Task.rto';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService: ConfigService) {}
  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') as string;
    this.client = new Redis(redisUrl);
    this.client.on('connect', () => this.logger.log('Connected to Redis'));
    this.client.on('error', (err) => this.logger.error('Redis error', err));
  }
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;

  //This function takes a contributorId and returns a document that contains the contributors task with the given contributorId.
  private contributorTaskKey(contributorId: string) {
    return `contrib:task:${contributorId}`;
  }

  /**
   * contributorsTaskMicroKey returns a document that contains the contributors task with the given contributorId.
   * - param: taskId - task id
   * - param: contributorsId - contributor ids
   * - returns: document with contributors task
   */
  private contributorTaskMicroKey(taskId: string, contributorId: string) {
    return `contrib:task:micro:${taskId}:${contributorId}`;
  }

  /**
   * Destroys the Redis client and sets it to null when called.
   * - returns: void
   * */
  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  /**
   * Write a docstring for writeContributorTask
   * - param: contributorId - the id of the contributor
   * - param: payload - the data to be written to Redis
   * - returns: Promise<void>
   * - description: function that writes a contributor's task to Redis and sets the expire time
   */
  async writeContributorTask(
    contributorId: string,
    payload: ContributorTaskRto[],
  ): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    const key = this.contributorTaskKey(contributorId);
    await this.client.set(key, JSON.stringify(payload));
    // set expire time
    await this.client.expire(key, 12 * 60 * 60);
  }

  async writeContributorTaskMicroTasks(
    contributorId: string,
    taskId: string,
    payload: TaskMicroTasksResponse,
  ): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    const key = this.contributorTaskMicroKey(taskId, contributorId);
    await this.client.set(key, JSON.stringify(payload));
    await this.client.expire(key, 12 * 60 * 60);
  }

  /**
   * getContributorTasks returns a list of contributor tasks for the given contributorId.
   * - param: contributorId - the id of the contributor
   * - returns: Promise<ContributorTaskRto[]>
   */
  async getContributorTasks(
    contributorId: string,
  ): Promise<ContributorTaskRto[]> {
    if (!this.client) throw new Error('Redis client not initialized');
    const key = this.contributorTaskKey(contributorId);
    const raw = await this.client.get(key);
    if (!raw) return [];
    return JSON.parse(raw) as ContributorTaskRto[];
  }

  /**
   * Returns a list of contributor tasks for the given contributorId.
   * - param: taskId - task id
   * - param: contributorsId - contributor id
   * - returns: Promise<TaskMicrotasksResponse | null>
   */
  async getContributorTaskMicroTasks(
    taskId: string,
    contributorId: string,
  ): Promise<TaskMicroTasksResponse | null> {
    if (!this.client) throw new Error('Redis client not initialized');
    const key = this.contributorTaskMicroKey(taskId, contributorId);
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as TaskMicroTasksResponse;
  }

  /**
   * Update a dataset status for a contributor task and keep cached counts in sync.
   * @param contributorId contributor id
   * @param taskId task id
   * @param dataSetId dataset id to update
   * @param newStatus new status value (e.g. 'APPROVED' | 'REJECTED' | 'PENDING')
   */
  async updateDataSetStatus(
    contributorId: string,
    taskId: string,
    microTaskId: string,
    newStatus: 'Approved' | 'Rejected',
  ): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');

    const taskObj: ContributorTaskRto[] =
      await this.getContributorTasks(contributorId);
    const microObj: TaskMicroTasksResponse | null =
      await this.getContributorTaskMicroTasks(taskId, contributorId);
    if (!taskObj && !microObj) return;
    if (newStatus == 'Approved') {
      if (taskObj) {
        // increment approved count by 1 and
        // decrement pending count by 1
        const task = taskObj.find((t) => t.id === taskId);
        if (task) {
          task.approved_count = task.approved_count + 1;
          task.pending_count = task.pending_count - 1;
          await this.writeContributorTask(contributorId, taskObj);
        }
      }
      if (microObj) {
        const contributorTaskMicroTasks = microObj.contributorMicroTask;
        const microTask = contributorTaskMicroTasks.find(
          (t) => t.id === microTaskId,
        );
        if (microTask) {
          microTask.acceptance_status = 'APPROVED';
          await this.writeContributorTaskMicroTasks(
            contributorId,
            taskId,
            microObj,
          );
        }
      }
    } else {
      if (taskObj) {
        // increment approved count by 1 and
        // decrement pending count by 1
        const task = taskObj.find((t) => t.id === taskId);
        if (task) {
          task.rejected_count = task.rejected_count + 1;
          task.pending_count = task.pending_count - 1;
          await this.writeContributorTask(contributorId, taskObj);
        }
      }
      if (microObj) {
        const contributorTaskMicroTasks = microObj.contributorMicroTask;
        const microTask = contributorTaskMicroTasks.find(
          (t) => t.id === microTaskId,
        );
        if (microTask) {
          microTask.acceptance_status = 'REJECTED';
          microTask.can_retry =
            microTask.allowed_retry > microTask.current_retry + 1;
          microTask.current_retry = microTask.current_retry + 1;

          await this.writeContributorTaskMicroTasks(
            contributorId,
            taskId,
            microObj,
          );
        }
      }
    }
    return;
  }
  /**
   * Update a dataset status for a contributor task and keep cached counts in sync.
   * @param contributorId contributor id
   * @param taskId task id
   * @param dataSetId dataset id to update
   * @param microtaskId microtask id
   * @param filePath file path
   */
  async updateDataSetFilPathAndQueueStatus(
    contributorId: string,
    taskId: string,
    dataSetId: string,
    microTaskId: string,
    filePath: string,
  ): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');

    const microObj: TaskMicroTasksResponse | null =
      await this.getContributorTaskMicroTasks(taskId, contributorId);
    if (!microObj) return;
    if (microObj) {
      const contributorTaskMicroTasks = microObj.contributorMicroTask;
      for (const microTask of contributorTaskMicroTasks) {
        if (microTask.id !== microTaskId) {
          continue;
        }
        if (!microTask) return;
        if (microTask.dataSet?.id === dataSetId) {
          microTask.dataSet.file_path = filePath;
          microTask.dataSet.isQueued = false;
          await this.writeContributorTaskMicroTasks(
            contributorId,
            taskId,
            microObj,
          );
          break;
        }
      }
    }
  }

  /**
   * Clear the cached contributor task for a given contributor and task.
   * @param contributorId contributor id
   * @param taskId task id (optional)
   */
  async clearContributorTaskCache(
    contributorId: string,
    taskId?: string,
  ): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    const k1 = this.contributorTaskKey(contributorId);
    await this.client.del(k1);
    if (taskId) {
      const k2 = this.contributorTaskMicroKey(taskId, contributorId);
      await this.client.del(k1, k2);
      return;
    }
    return;
  }
  /**
   * Clear all cached data from Redis.
   * - returns: Promise<void>
   * - description: function that clears all cached data from Redis
   */
  async clearAllCache(): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');
    await this.client.flushall();
  }
}
