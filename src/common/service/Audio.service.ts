import { parseFile } from 'music-metadata';
import { Injectable } from '@nestjs/common';
@Injectable()
export class AudioService {
  async getAudioDuration(filePath: string): Promise<number> {
    // filePath is local path before uploading to MinIO
    const metadata = await parseFile(filePath);
    // duration in seconds
    return metadata.format.duration
      ? parseFloat(metadata.format.duration.toFixed(4))
      : 0;
  }
}
