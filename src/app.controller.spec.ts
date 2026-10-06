jest.mock('./common/service/File.service', () => ({
  FileService: class FileService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileService } from './common/service/File.service';

describe('AppController', () => {
  let appController: AppController;
  let fileService: { getFile: jest.Mock };

  beforeEach(async () => {
    fileService = {
      getFile: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: FileService,
          useValue: fileService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('getFile', () => {
    it('should stream the requested file to the response', async () => {
      const stream = {
        pipe: jest.fn(),
        on: jest.fn(),
      };
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      fileService.getFile.mockResolvedValue({
        Body: stream,
        ContentType: 'image/png',
        ContentLength: 128,
      });

      await appController.getFile('avatar.png', res);

      expect(fileService.getFile).toHaveBeenCalledWith('image/avatar.png');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Length', 128);
      expect(stream.pipe).toHaveBeenCalledWith(res);
      expect(stream.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 500 when file retrieval fails', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      fileService.getFile.mockRejectedValue(new Error('boom'));

      await appController.getFile('avatar.png', res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Failed to get file');

      consoleError.mockRestore();
    });
  });
});
