import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, QueryRunner, Repository } from 'typeorm';
import { Role } from '../entities/Role.entity';
@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  /**
   * Retrieves a single role from the database.
   * @param query The query to filter roles. Supports relations.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the role if found, or null.
   */
  async findOne(
    query: FindOptionsWhere<Role>,
    queryRunner?: QueryRunner,
  ): Promise<Role | null> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      return await manager.findOne(Role, { where: query });
    } else {
      return await this.roleRepository.findOne({
        where: query,
      });
    }
  }
  /**
   * Retrieves multiple roles from the database.
   * @param query The query to filter roles. Supports relations.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to an array of roles matching the query.
   */
  async findMany(query: any, queryRunner?: QueryRunner): Promise<Role[]> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      return await manager.find(Role, {
        where: query,
      });
    } else {
      const manager = this.roleRepository;
      return await manager.find({
        where: query,
      });
    }
  }
  /**
   * Creates a new role in the database.
   * @param userData The partial role data to create.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the created role.
   */
  async create(
    userData: Partial<Role>,
    queryRunner?: QueryRunner,
  ): Promise<Role> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      const user = manager.create(Role, userData);
      return await manager.save(Role, user);
    } else {
      const manager = this.roleRepository;
      const user = manager.create(userData);
      return await manager.save(user);
    }
  }
  /**
   * Updates a role in the database.
   * @param id The id of the role to update.
   * @param roleData The partial role data to update.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the updated role if found, or null.
   */
  async update(
    id: any,
    roleData: Partial<Role>,
    queryRunner?: QueryRunner,
  ): Promise<Role | null> {
    delete roleData.id;
    if (queryRunner) {
      const manager = queryRunner.manager;
      await manager.update(Role, id, roleData);
      return await manager.findOne(Role, { where: id });
    } else {
      const manager = this.roleRepository;
      return await manager.save(roleData);
    }
  }
  async deleteUser(id: any, queryRunner?: QueryRunner): Promise<boolean> {
    if (queryRunner) {
      const manager = queryRunner.manager;
      await manager.delete(Role, { id: id });
      return true;
    } else {
      const manager = this.roleRepository;
      await manager.delete(id);
      return true;
    }
  }
}
