import { Processor, WorkerHost } from '@nestjs/bullmq';
import { createReadStream, unlink } from 'fs';
import { promisify } from 'util';
import { DataSetService } from 'src/data_set/service/DataSet.service';
import { FileService } from 'src/common/service/File.service';
import { promises as fs } from 'fs';
import { Job } from 'bullmq';
const unlinkAsync = promisify(unlink);

@Processor('file-upload', {
  concurrency: 1, //  ensures one-by-one upload
})
export class FileUploadProcessor extends WorkerHost {
  constructor(
    private readonly fileService: FileService,
    private readonly dataSetService: DataSetService,
  ) {
    super();
  }

  /**
   * Process a job for uploading an audio file to MinIO.
   * The job data should contain the following properties:
   * - path: the path to the audio file to be uploaded
   * - filename: the name of the audio file
   * - mimetype: the MIME type of the audio file
   * - dataSetId: the ID of the data set to which the audio file belongs
   * If the upload is successful, the queue status of the data set will be updated to 'completed' and the file path will be added to the data set.
   * If the upload fails, the queue status of the data set will be updated to 'failed'.
   * @param job - the job to be processed
   * @param token - an optional token for authentication
   * @returns a promise that resolves to void
   */
  async process(
    job: Job<{
      path: string;
      filename: string;
      mimetype: string;
      dataSetId: string;
    }>,
    token?: string,
  ): Promise<void> {
    const data = job.data;
    try {
      await fs.access(data.path);
      const stream = createReadStream(data.path);
      const folder = 'audios/';
      const result = await this.fileService.uploadAudioFiles(
        data.filename,
        stream,
        data.mimetype,
      );
      const filePath = folder + data.filename;
      await this.dataSetService.updateQueueStatus(
        data.dataSetId,
        'completed',
        filePath,
      );
      await unlinkAsync(data.path);
    } catch (e) {
      await this.dataSetService.update(data.dataSetId, {
        queue_status: 'failed',
      });
      console.error(e);
    }
  }
}
