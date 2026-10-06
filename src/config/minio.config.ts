import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { diskStorage } from 'multer';
import { extname } from 'path';
import crypto from 'crypto';
import { Request } from 'express';

ConfigModule.forRoot({ envFilePath: '.env', isGlobal: true });
const configService = new ConfigService();

const minioEndpoint = configService.get<string>('MINIO_ENDPOINT');
const minioPublicEndpoint =
  configService.get<string>('MINIO_PUBLIC_ENDPOINT') || minioEndpoint;
const minioCredentials = {
  accessKeyId: configService.get<string>('MINIO_ACCESS_KEY') as string,
  secretAccessKey: configService.get<string>('MINIO_SECRET_KEY') as string,
};
const forcePathStyle =
  configService.get<string>('MINIO_S3_FORCE_PATH_STYLE') !== 'false';

const createS3Client = (endpoint?: string) =>
  new S3Client({
    endpoint,
    credentials: minioCredentials,
    region: 'us-east-1',
    forcePathStyle,
  });

// Keep uploads and server-side object operations on the private Docker route.
export const s3 = createS3Client(minioEndpoint);

// Signed URLs must contain a hostname reachable by browsers and mobile devices.
// When MINIO_PUBLIC_ENDPOINT is not configured, this intentionally falls back
// to the private endpoint for local development compatibility.
export const s3Presigner = createS3Client(minioPublicEndpoint);

export const MINIO_BUCKET = configService.get<string>('MINIO_BUCKET') as string;

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  stream: NodeJS.ReadableStream;
}

interface S3UploadResult {
  Location: string;
  ETag: string;
  key: string;
  Bucket: string;
}

class S3Storage {
  private bucket: string;
  private s3Client: S3Client;
  private folder: string;

  constructor(options: { s3: S3Client; bucket: string; folder?: string }) {
    this.bucket = options.bucket;
    this.s3Client = options.s3;
    this.folder = options.folder || '';
  }

  public _handleFile(
    req: Request,
    file: MulterFile,
    cb: (err: Error | null, info?: S3UploadResult) => void,
  ): void {
    const key = `${this.folder}${Date.now().toString()}-${file.originalname}`;

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: file.stream as any,
        ContentType: file.mimetype,
        ACL: 'private',
      },
    });

    upload
      .done()
      .then((result: any) => {
        cb(null, {
          Location: result.Location,
          ETag: result.ETag,
          key: result.Key,
          Bucket: result.Bucket,
        });
      })
      .catch((error: Error) => {
        cb(error);
      });
  }

  public _removeFile(
    req: Request,
    file: S3UploadResult,
    cb: (err: Error | null) => void,
  ): void {
    cb(null);
  }
}

export const multerAudioS3Storage = new S3Storage({
  s3: s3,
  bucket: MINIO_BUCKET,
  folder: 'audios/',
});

export const multerCSVS3Storage = new S3Storage({
  s3: s3,
  bucket: MINIO_BUCKET,
  folder: 'csv/',
});

export const multerImageS3Storage = new S3Storage({
  s3: s3,
  bucket: MINIO_BUCKET,
  folder: 'image/',
});

export const multerAudioDiskConfig = {
  storage: diskStorage({
    destination: './uploads',
    filename: (_req, file, cb) => {
      const uniqueName = `${crypto.randomUUID().split('-')[0]}-${crypto.randomUUID()}${extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
};
