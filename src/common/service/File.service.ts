import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { s3, s3Presigner } from 'src/config/minio.config';
import { DataSet } from 'src/data_set/entities/DataSet.entity';
import { MicroTask } from 'src/data_set/entities/MicroTask.entity';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
@Injectable()
export class FileService {
  // define constructor with s3
  private s3;
  private readonly bucketName: string;
  constructor(private readonly configService: ConfigService) {
    this.s3 = s3;
    this.bucketName = configService.get<string>('MINIO_BUCKET') || '';
  }

  // delete file from minio
  async deleteFile(objectKey: string): Promise<any> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      await s3.send(command);
      return { message: 'File deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
  // generate presigned url for minio
  async getPreSignedUrl(
    objectKey: string,
    expiresInSeconds = 3600 * 24,
  ): Promise<string> {
    try {
      // const objectExists = await this.objectExists(this.bucketName, objectKey);
      // if (!objectExists) {
      //   return objectKey;
      // }
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      const url = await getSignedUrl(s3Presigner, command, {
        expiresIn: expiresInSeconds,
      });
      return url;
    } catch (error) {
      return objectKey;
    }
  }
  async getMultiplePreSignedUrl(objectKeys: string[], expiresInSeconds = 3600) {
    const commands = objectKeys.map((objectKey) => {
      return new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });
    });
    const signedUrls = await Promise.all(
      commands.map((command) =>
        getSignedUrl(s3Presigner, command, { expiresIn: expiresInSeconds }),
      ),
    );
    return signedUrls;
  }
  async getPreSignedDatasets(dataSets: DataSet[]): Promise<DataSet[]> {
    return await Promise.all(
      dataSets.map(async (dataSet) => {
        return {
          ...dataSet,
          file_path: await this.getPreSignedUrl(dataSet.file_path),
        };
      }),
    );
  }
  async getPreSignedMicroTasks(microTasks: MicroTask[]): Promise<MicroTask[]> {
    return await Promise.all(
      microTasks.map(async (task) => {
        return {
          ...task,
          file_path: await this.getPreSignedUrl(task.file_path),
        };
      }),
    );
  }
  async setPreSignedMicroTask(microTask: MicroTask): Promise<void> {
    microTask.file_path = await this.getPreSignedUrl(microTask.file_path);
  }
  async setPreSignedDatasets(dataSets: DataSet): Promise<void> {
    dataSets.file_path = await this.getPreSignedUrl(dataSets.file_path);
  }
  async objectExists(bucket: string, key: string) {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      return true;
    } catch (err) {
      if (err.name === 'NotFound') {
        return false;
      }
      throw err; // rethrow other errors
    }
  }
  async getFile(objectKey: string): Promise<any> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });
      const response = await s3.send(command);
      return response;
    } catch (error) {
      throw new Error(`Failed to get file: ${error.message}`);
    }
  }
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
  async getXlsxContent(objectKey: string): Promise<any[]> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    const response = await this.s3.send(command);
    const buffer = await this.streamToBuffer(response.Body as Readable);

    const isText = objectKey.toLowerCase().endsWith('.txt');
    type ImportCell = string | number | boolean | null | undefined;
    let data: ImportCell[][];
    if (isText) {
      data = buffer
        .toString('utf8')
        .replace(/^\uFEFF/, '')
        .split(/\r\n|\n|\r/)
        .map((line) => [line]);
    } else {
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        codepage: 65001,
        raw: true,
      });
      data = XLSX.utils.sheet_to_json<ImportCell[]>(
        workbook.Sheets[workbook.SheetNames[0]],
        {
          header: 1,
          defval: '',
          blankrows: false,
        },
      );
    }
    data = data.filter((row) =>
      row.some((value) => String(value ?? '').trim()),
    );
    const headers = (data[0] || []).map((value) =>
      String(value ?? '')
        .trim()
        .toLowerCase(),
    );
    const hasHeaders = !isText && headers.includes('text');
    return (hasHeaders ? data.slice(1) : data)
      .map((row, index) => {
        const numbered =
          row.length > 1 && /^\d+$/.test(String(row[0] ?? '').trim());
        const item: Record<string, ImportCell> = hasHeaders
          ? Object.fromEntries(
              headers.map((header, column) => [header, row[column]]),
            )
          : { no: numbered ? row[0] : index + 1, text: row[numbered ? 1 : 0] };
        if (item.no == null || !String(item.no).trim()) item.no = index + 1;
        item.text = String(item.text ?? '');
        return item;
      })
      .filter((row) => String(row.text).trim());
  }
  async uploadAudioFiles(
    objectName: string,
    stream: Readable,
    contentType: string,
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: 'audios/' + objectName,
      Body: stream,
      ContentType: contentType,
    });
    return await this.s3.send(command);
  }
}
