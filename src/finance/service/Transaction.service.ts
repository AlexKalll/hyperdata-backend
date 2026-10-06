import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, QueryRunner, Repository } from 'typeorm';
import { Transaction } from '../entities/Transaction.entity';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { paginate, PaginatedResult } from 'src/utils/paginate.util';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    // private readonly paginationService: PaginationService<Transaction>,
  ) {
    // this.paginationService = new PaginationService<Transaction>(
    //   this.transactionRepository,
    // );
  }
  async create(
    transactionData: Partial<Transaction>,
    queryRunner: QueryRunner,
  ) {
    const manager = queryRunner.manager;
    const transaction = manager.create(Transaction, transactionData);
    return await manager.save(transaction);
  }
  async findOne(id: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({ where: { id } });
  }
  async findPendingPayouts(): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: {
        type: 'Withdraw',
        status: In(['Processing', 'Submitted']),
      },
    });
  }
  async getUserTransactionsPaginated(
    userId: string,
    queryFindOptions: FindOptionsWhere<Transaction>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Transaction>> {
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const [transactions, count] = await this.transactionRepository.findAndCount(
      {
        where: { ...queryFindOptions, user_id: userId },
        skip: (page - 1) * limit,
        take: limit,
        order: { created_date: 'DESC' },
      },
    );
    return paginate(transactions, count, page, limit);
  }
}
