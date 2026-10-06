import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScoreValue } from '../entities/ScoreValue.entity';
import { QueryOptions } from 'src/utils/queryOption.util';

@Injectable()
export class ScoreValueService {
  // Create a logger
  constructor(
    @InjectRepository(ScoreValue)
    private readonly scoreValueRepository: Repository<ScoreValue>,
  ) {}

  async onModuleInit() {
    try {
      await this.create({ value_in_birr: 1 });
    } catch (error) {
      console.error('Error creating score value:', error);
    }
  }

  async create(scoreValue: Partial<ScoreValue>): Promise<ScoreValue> {
    const score = await this.get();
    if (score) {
      return score;
    }
    const scoree = this.scoreValueRepository.create(scoreValue);
    return await this.scoreValueRepository.save(scoree);
  }

  async findOne(query: QueryOptions<ScoreValue>): Promise<ScoreValue | null> {
    return await this.scoreValueRepository.findOne(query);
  }
  async get(): Promise<ScoreValue> {
    const score = await this.scoreValueRepository.find({});
    if (!score) {
      throw new Error('Score Value Not Found');
    }
    return score[0];
  }

  async update(scoreValue: Partial<ScoreValue>): Promise<ScoreValue | null> {
    const score = await this.get();

    const id = score.id;
    await this.scoreValueRepository.update(id, scoreValue);
    return await this.findOne({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    const score = await this.findOne({ where: { id } });
    await this.scoreValueRepository.delete(id);
  }
}
