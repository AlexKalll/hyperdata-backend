import { MicroTask } from 'src/data_set/entities/MicroTask.entity';
import { DataSetStatus } from './constants/DataSetStatus.constant';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { Task } from 'src/project/entities/Task.entity';

export const checkIfMicroTasIskRejectedAndTotalAttempts = (
  microTask: MicroTask,
  maxRetry: number,
): {
  acceptanceStatus: 'APPROVED' | 'REJECTED' | 'PENDING' | 'NOT_STARTED';
  totalAttempts: number;
  canRetry: boolean;
  dataSet: DataSet | undefined;
} => {
  // if there is a rejected dataset and no pending or approved dataset it will be a rejected microtask
  const rejected = microTask.dataSets.some(
    (dataSet) => dataSet.status === DataSetStatus.REJECTED,
  );
  const pending = microTask.dataSets.some(
    (dataSet) => dataSet.status === DataSetStatus.PENDING,
  );
  const approved = microTask.dataSets.some(
    (dataSet) => dataSet.status === DataSetStatus.APPROVED,
  );
  const isRejected = rejected && !pending && !approved;
  const hasPending = pending ? true : false;
  const hasDataSet = microTask.dataSets.length > 0;
  let acceptanceStatus: 'APPROVED' | 'REJECTED' | 'PENDING' | 'NOT_STARTED' =
    'NOT_STARTED';
  if (hasDataSet) {
    if (isRejected) {
      acceptanceStatus = 'REJECTED';
    } else if (hasPending) {
      acceptanceStatus = 'PENDING';
    } else if (approved) {
      acceptanceStatus = 'APPROVED';
    } else {
      acceptanceStatus = 'REJECTED';
    }
  }
  const totalAttempts = microTask.dataSets.length;
  const canRetry = hasDataSet ? isRejected && totalAttempts <= maxRetry : true;
  const totalDatasets = microTask.dataSets.length;
  const lastDataset =
    totalDatasets == 0 ? undefined : microTask.dataSets[totalDatasets - 1];
  return {
    acceptanceStatus,
    totalAttempts,
    canRetry,
    dataSet: lastDataset,
  };
};
export const getMicroTaskStatus = (
  microTask: MicroTask,
  maxRetry: number,
): {
  acceptanceStatus: 'APPROVED' | 'REJECTED' | 'PENDING' | 'NOT_STARTED';
  totalAttempts: number;
  canRetry: boolean;
  dataSet: DataSet | undefined;
} => {
  // if there is a rejected dataset and no pending or approved dataset it will be a rejected microtask
  const rejected = microTask.dataSets.some(
    (dataSet) => dataSet.status === DataSetStatus.REJECTED,
  );
  const pending = microTask.dataSets.some(
    (dataSet) => dataSet.status === DataSetStatus.PENDING,
  );
  const approved = microTask.dataSets.some(
    (dataSet) => dataSet.status === DataSetStatus.APPROVED,
  );
  const isRejected = rejected && !pending && !approved;
  const hasPending = pending ? true : false;
  const hasDataSet = microTask.dataSets.length > 0;
  let acceptanceStatus: 'APPROVED' | 'REJECTED' | 'PENDING' | 'NOT_STARTED' =
    'NOT_STARTED';
  const sortDataSets = microTask.dataSets.sort((a, b) =>
    a.created_date > b.created_date
      ? 1
      : b.created_date > a.created_date
        ? -1
        : 0,
  );
  if (hasDataSet) {
    if (isRejected) {
      acceptanceStatus = 'REJECTED';
    } else if (hasPending) {
      acceptanceStatus = 'PENDING';
    } else if (approved) {
      acceptanceStatus = 'APPROVED';
    } else {
      acceptanceStatus = 'REJECTED';
    }
  }
  const totalAttempts = microTask.dataSets.length;
  const canRetry = isRejected && totalAttempts <= maxRetry;
  const totalDatasets = microTask.dataSets.length;
  const lastDataset =
    totalDatasets == 0 ? undefined : microTask.dataSets[totalDatasets - 1];

  return {
    acceptanceStatus,
    totalAttempts,
    canRetry,
    dataSet: lastDataset,
  };
};
export interface TaskStatus extends Task {
  totalRejectedMicroTasks: number;
  totalPendingMicroTasks: number;
  totalApprovedMicroTasks: number;
  totalRejectedTestMicroTasks: number;
  totalPendingTestMicroTasks: number;
  totalApprovedTestMicroTasks: number;
  hasPendingOrUndoneMicroTasks: boolean;
}
export const getTaskStatus = (tasks: Task[]): TaskStatus[] => {
  const taskStatus: TaskStatus[] = [];
  for (const t of tasks) {
    let rejectedCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedTestCount = 0;
    let pendingTestCount = 0;
    let approvedTestCount = 0;
    let hasPendingOrUndoneMicroTasks = false;
    for (const microTask of t.microTasks) {
      const status = getMicroTaskStatus(
        microTask,
        t.taskRequirement?.max_retry_per_task || 5,
      );
      if (status.acceptanceStatus == 'REJECTED') {
        if (microTask.is_test) {
          rejectedTestCount += 1;
        } else {
          rejectedCount += 1;
        }
      } else if (status.acceptanceStatus == 'PENDING') {
        // console.log("Pending ",t.name + " " + microTask.text);

        if (microTask.is_test) {
          pendingTestCount += 1;
        } else {
          pendingCount += 1;
        }
      } else if (status.acceptanceStatus == 'APPROVED') {
        if (microTask.is_test) {
          approvedTestCount += 1;
        } else {
          approvedCount += 1;
        }
      }

      if (
        status.acceptanceStatus == 'NOT_STARTED' ||
        status.acceptanceStatus == 'PENDING'
      ) {
        hasPendingOrUndoneMicroTasks = true;
      } else if (status.acceptanceStatus == 'REJECTED' && status.canRetry) {
        hasPendingOrUndoneMicroTasks = true;
      }
    }
    taskStatus.push({
      ...t,
      totalRejectedMicroTasks: rejectedCount,
      totalPendingMicroTasks: pendingCount,
      totalApprovedMicroTasks: approvedCount,
      totalRejectedTestMicroTasks: rejectedTestCount,
      totalPendingTestMicroTasks: pendingTestCount,
      totalApprovedTestMicroTasks: approvedTestCount,
      hasPendingOrUndoneMicroTasks,
    });
  }
  return taskStatus;
};
