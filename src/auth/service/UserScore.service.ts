import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryRunner, Repository } from 'typeorm';
import { UserScore } from '../entities/UserScore.entity';
import { ActionScore } from 'src/utils/constants/ActionScore.contant';
import { UserScoreDefaultPoint } from 'src/utils/constants/UserScoreAction.constant';
@Injectable()
export class UserScoreService {
  constructor(
    @InjectRepository(UserScore)
    private readonly userScoreRepository: Repository<UserScore>,
  ) {}

  async updateScore(
    user_id: string,
    action: 'SUBMIT' | 'ACCEPT' | 'REJECT',
    queryRunner: QueryRunner,
  ): Promise<UserScore | null> {
    // let point: number = 0;
    // if (action === UserScoreAction.SUBMIT) {
    //   point = ActionScore.SUBMIT;
    // } else if (action === UserScoreAction.ACCEPT) {
    //   point = ActionScore.ACCEPT;
    // } else if (action === UserScoreAction.REJECT) {
    //   point = ActionScore.REJECT;
    // } else {
    //   return null; // If action is not recognized, return null
    // }
    const point = ActionScore[action];
    // create a manager for the query
    const manager = queryRunner.manager;
    // Check if the user score already exists
    let userScore = await manager.findOne(UserScore, { where: { user_id } });
    if (!userScore) {
      // If not, create a new user score entry
      userScore = manager.create(UserScore, { user_id, score: point });
      return await manager.save(UserScore, userScore);
    }
    // If it exists, update the score
    userScore.score += point;
    return await manager.save(UserScore, userScore);
  }
  async createScore(
    user_id: string,
    queryRunner?: QueryRunner,
  ): Promise<UserScore> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      let userScore = await manager.findOne(UserScore, { where: { user_id } });
      if (!userScore) {
        userScore = manager.create(UserScore, {
          user_id,
          score: UserScoreDefaultPoint,
        });
        return await manager.save(UserScore, userScore);
      }
      return userScore;
    }

    let userScore = await this.userScoreRepository.findOne({
      where: { user_id },
    });
    if (!userScore) {
      userScore = this.userScoreRepository.create({
        user_id,
        score: UserScoreDefaultPoint,
      });
      return await this.userScoreRepository.save(userScore);
    }
    return userScore;
  }
  async reduceNoneSubmitScore(
    userIds: string[],
    queryRunner: QueryRunner,
  ): Promise<void> {
    // create a manager for the query
    const manager = queryRunner.manager;
    // Check if the user score already exists
    await Promise.all(
      userIds.map(async (user_id) => {
        const userScore = await manager.findOne(UserScore, {
          where: { user_id },
        });
        if (userScore) {
          userScore.score = userScore.score + ActionScore.EXPIRED;
          return await manager.save(UserScore, userScore);
        }
      }),
    );
  }
}
