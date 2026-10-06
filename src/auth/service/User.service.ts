import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  FindOptionsWhere,
  Not,
  In,
  Between,
  QueryRunner,
  Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/User.entity';
import { RoleService } from './Role.service';
import { paginate, PaginatedResult } from 'src/utils/paginate.util';
import { PaginationService } from 'src/common/service/pagination.service';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { Role as RoleConstant } from '../decorators/roles.enum';
import { QueryOptions } from 'src/utils/queryOption.util';
import { UserVerificationCodeService } from './UserVerificationCode.service';
import { AfroResponse, SmsService } from 'src/sms/sms.service';
import {
  hashPassword,
  verifyPassword,
  generateOtp,
  hashOtp,
} from 'src/utils/security/credential.util';
import { FileService } from 'src/common/service/File.service';
import { DialectService } from 'src/base_data/service/Dialect.service';
import { LanguageService } from 'src/base_data/service/Language.service';
import { RegionService, ZoneService } from 'src/base_data/service';
import { TaskRequirement } from 'src/project/entities/TaskRequirement.entity';
import { JwtService } from '@nestjs/jwt';
import { GENDER_CONSTANT } from 'src/utils/constants/Gender.constant';
import { WalletService } from 'src/finance/service/Wallet.service';
import { UserScoreService } from './UserScore.service';
import { RefreshSessionService } from './RefreshSession.service';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly roleService: RoleService,
    private readonly paginationService: PaginationService<User>,
    private readonly fileService: FileService,
    private readonly smsService: SmsService,
    private readonly dialectService: DialectService,
    private readonly languageService: LanguageService,
    private readonly zoneService: ZoneService,
    private readonly regionService: RegionService,
    private readonly walletService: WalletService,
    private userScoreService: UserScoreService,
    private userVerificationService: UserVerificationCodeService,
    private jwtService: JwtService,
    private refreshSessions: RefreshSessionService,
    // private eventEmitter: EventEmitter2,
  ) {
    this.paginationService = new PaginationService<User>(this.userRepository);
  }
  async onModuleInit() {
    await this.createSuperAdminIfNotExists();
  }

  /**
   * Finds one user by the given options.
   * @param {QueryOptions<User> | null} optionQueries - The options to find one user.
   * @param {QueryRunner} queryRunner - The query runner to use.
   * @returns {Promise<User | null>} - The found user or null if not found.
   */
  async findOne(
    optionQueries: QueryOptions<User> | null,
    queryRunner?: QueryRunner,
  ): Promise<User | null> {
    const options: any = {
      where: optionQueries?.where || {},
      order: optionQueries?.order || {},
      relations: optionQueries?.relations || [],
    };
    if (optionQueries?.select) {
      options.select = optionQueries.select;
    }
    if (queryRunner) {
      const manager = queryRunner.manager;

      return await manager.findOne(User, options);
    } else {
      const manager = this.userRepository;
      return await manager.findOne(options);
    }
  }
  /**
   * Retrieves a user by id.
   * @param {string} id - The user id to retrieve.
   * @returns {Promise<User | null>} - The retrieved user or null if not found.
   * @throws {NotFoundException} - If the user is not found.
   */
  async userProfile(id: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: { role: true, wallet: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.profile_picture) {
      user.profile_picture = await this.fileService.getPreSignedUrl(
        user.profile_picture,
      );
    }
    return user;
  }
  /**
   * Finds one user by the given options with password.
   * @param {QueryOptions<User>} query - The options to find one user.
   * @returns {Promise<User | null>} - The found user or null if not found.
   * @throws {NotFoundException} - If the user is not found.
   */
  async findOneWithPassword(query: QueryOptions<User>): Promise<User | null> {
    const options: QueryOptions<User> = {
      where: query.where || {},
      order: query.order || {},
      relations: query.relations || undefined,
    };
    options.select = {
      id: true,
      email: true,
      password: true,
      is_active: true,
      profile_picture: true,
      first_name: true,
      middle_name: true,
      last_name: true,
      phone_number: true,
      gender: true,
      role_id: true,
    };
    if (query.select) {
      options.select = query.select;
    }

    const manager = this.userRepository;
    return await manager.findOne(options);
  }
  /**
   * Retrieves multiple users from the database.
   * Omits the superadmin user.
   * @param query The query to filter users.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to an array of users matching the query.
   */
  async findMany(query: QueryOptions<User>, queryRunner?: QueryRunner) {
    // omit the superadmin
    query.where = { ...query.where, first_name: Not('SuperAdmin') };
    if (queryRunner) {
      const manager = queryRunner.manager;
      return await manager.find(User, query);
    } else {
      const manager = this.userRepository;
      return await manager.find(query);
    }
  }
  /**
   * Creates a new user in the database.
   * Encrypts the password before saving it.
   * Checks if the email and phone number already exist.
   * Checks if the dialect, language, zone and region exist.
   * If the user is a contributor or reviewer, creates a new wallet.
   * @param userData The partial user data to create.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the created user.
   */
  async create(
    userData: Partial<User>,
    queryRunner?: QueryRunner,
  ): Promise<User> {
    const role = await this.roleService.findOne({ id: userData.role_id });
    const dialect = await this.dialectService.findOne({
      id: userData.dialect_id,
    });
    const language = await this.languageService.findOne({
      id: userData.language_id,
    });
    const zone = await this.zoneService.findOne({ id: userData.zone_id });
    const region = await this.regionService.findOne({ id: userData.region_id });
    if (userData.phone_number) {
      const userBefore = await this.findOne({
        where: { phone_number: userData.phone_number },
      });
      if (userBefore) {
        throw new BadRequestException('Phone number already exists');
      }
    }
    if (userData?.email) {
      const userBefore = await this.findOne({
        where: { email: userData.email },
      });
      if (userBefore) {
        throw new BadRequestException('Email already exists');
      }
    }
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (!dialect && userData.dialect_id) {
      throw new NotFoundException('Dialect not found');
    }
    if (!language && userData.language_id) {
      throw new NotFoundException('Language not found');
    }
    // encrypt password
    if (!userData.password) {
      throw new BadRequestException('Password is required');
    }
    if (!zone && userData.zone_id) {
      throw new NotFoundException('Zone not found');
    }
    if (!region && userData.region_id) {
      throw new NotFoundException('Region not found');
    }

    const hashedPassword = await hashPassword(userData.password);
    userData.password = hashedPassword;
    if (queryRunner) {
      const manager = queryRunner.manager;
      const user = manager.create(User, userData);
      const userCreated = await manager.save(User, user);
      if (
        role.name == RoleConstant.CONTRIBUTOR ||
        role.name == RoleConstant.REVIEWER
      ) {
        await this.userScoreService.createScore(userCreated.id, queryRunner);
        await this.walletService.findOneOrCreate(userCreated.id, queryRunner);
      }
      return userCreated;
    } else {
      const manager = this.userRepository;
      const user = manager.create(userData);
      const userCreated = await manager.save(user);

      if (
        role.name == RoleConstant.CONTRIBUTOR ||
        role.name == RoleConstant.REVIEWER
      ) {
        await this.userScoreService.createScore(userCreated.id, queryRunner);
        await this.walletService.findOneOrCreate(userCreated.id, queryRunner);
      }
      return userCreated;
    }
  }
  /**
   * Signs up a user based on the phone number.
   * If the user already exists, checks if the password is 'pending'.
   * If the password is 'pending', throws BadRequestException.
   * If the user does not exist, sends a verification code to the user's phone number.
   * If the SMS sending fails, throws InternalServerErrorException.
   * If the SMS sending is successful, creates a new UserVerificationCode and returns it.
   * @param {string} phone_number - The phone number of the user
   * @returns {Promise<any>} - A promise resolving to the signed-up user
   * @throws {BadRequestException} - If the user already exists and the password is not 'pending'
   * @throws {InternalServerErrorException} - If the SMS sending fails
   */
  async signUp(phone_number: string): Promise<any> {
    const findedUser = await this.findOneWithPassword({
      where: { phone_number: phone_number },
    });
    if (findedUser && findedUser.is_active) {
      const comparepassword = await verifyPassword(
        'pending',
        findedUser.password,
      );
      if (!comparepassword) {
        throw new BadRequestException('User already exists');
      }
    }

    const code = generateOtp();

    // let message = `Your verification code is ${code}`;
    const smsResponse: { error?: string; afro: AfroResponse | null } =
      await this.smsService.sendVerificationCode(phone_number, code);
    if (smsResponse.afro?.acknowledge == 'error' || smsResponse.error) {
      throw new InternalServerErrorException('Failed to send SMS');
    } else {
      const code_expiration_date = new Date();
      code_expiration_date.setMinutes(code_expiration_date.getMinutes() + 5);

      const uv = await this.userVerificationService.create({
        username: phone_number,
        code: hashOtp(code),
        expiration_date: code_expiration_date,
      });
      return {
        success: 'true',
        verification_id: uv.id,
      };
    }
  }
  /**
   * Verifies a user's OTP given a verification code
   * @throws {BadRequestException} - If the verification code is invalid or expired
   */
  async verifyOtp(id: string, username: string, code: string): Promise<void> {
    try {
      await this.userVerificationService.consume(username, code, id);
    } catch {
      throw new BadRequestException('Invalid or expired code');
    }
  }
  /**
   * Verifies a user's account given a verification code
   * and a phone number
   * @param verification_id - The verification id of the user
   * @param code - The verification code of the user
   * @param phone - The phone number of the user
   * @returns A promise resolving to an object containing the user and the access token
   * @throws {BadRequestException} - If the verification code is invalid or expired
   */
  async verifyAccount(
    verification_id: string,
    code: string,
    phone: string,
  ): Promise<{
    user: User;
    access_token: string;
  }> {
    await this.verifyOtp(verification_id, phone, code);
    const userBefore = await this.findOne({ where: { phone_number: phone } });
    const role = await this.roleService.findOne({
      name: RoleConstant.CONTRIBUTOR,
    });
    const user = userBefore
      ? userBefore
      : await this.create({
          phone_number: phone,
          password: 'pending',
          role_id: role?.id,
          is_active: false,
        });
    user.password = '';
    const access_token = this.jwtService.sign(
      {
        sub: user?.id,
        onboarding: true,
      },
      { expiresIn: '15m' },
    );
    return { user, access_token };
  }

  /**
   * Finds users with pagination
   * @param query - Query options for user
   * @param paginationDto - Pagination options
   * @returns A promise resolving to a paginated result of users
   * @throws {BadRequestException} - If the query is invalid
   */
  async findPaginate(
    query: QueryOptions<User>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<User>> {
    // check if the query is array
    const superAdminRole = await this.roleService.findOne({
      name: RoleConstant.SUPER_ADMIN,
    });
    const superAdminRole_id = superAdminRole?.id || '';
    if (Array.isArray(query.where)) {
      // check if a role_id is present in the query object array
      const role_id = query.where.find((item) => item.role_id);
      if (!role_id) {
        query.where.push({ role_id: Not(superAdminRole_id) }); //[...query.where,{first_name:Not('SuperAdmin')}];
      }
      // query.where.push({role_id:Not(superAdminRole_id)}) //[...query.where,{first_name:Not('SuperAdmin')}];
    } else {
      if (!query.where?.role_id) {
        query.where = { ...query.where, role_id: Not(superAdminRole_id) };
      }
    }
    return this.paginationService.paginateWithOptionQuery(
      paginationDto,
      'user',
      query,
    );
  }
  /**
   * Finds project managers with pagination
   * @param query - Query options for user
   * @param paginationDto - Pagination options
   * @returns A promise resolving to a paginated result of users
   * @throws {BadRequestException} - If the query is invalid
   */
  async findProjectManagersPaginate(
    query: QueryOptions<User>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<User>> {
    // check if the query is array
    const projectManagerRole = await this.roleService.findOne({
      name: RoleConstant.PROJECT_MANAGER,
    });
    const manager_role_id = projectManagerRole?.id;
    if (Array.isArray(query.where)) {
      if (query.where.length === 0) {
        query.where.push({ is_active: true, role_id: manager_role_id });
      } else {
        const data = query.where.map((item) => ({
          ...item,
          is_active: true,
          role_id: manager_role_id,
        }));
      }
    } else {
      query.where = {
        ...query.where,
        is_active: true,
        role_id: manager_role_id,
      };
    }
    return this.paginationService.paginateWithOptionQuery(
      paginationDto,
      'user',
      query,
    );
  }
  /**
   * Finds reviewers with pagination
   * @param query - Query options for user
   * @param paginationDto - Pagination options
   * @returns A promise resolving to a paginated result of users
   * @throws {BadRequestException} - If the query is invalid
   */
  async findReviewersPaginate(
    query: QueryOptions<User>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<User>> {
    // check if the query is array
    const reviewerRole = await this.roleService.findOne({
      name: RoleConstant.REVIEWER,
    });
    const reviewer_role_id = reviewerRole?.id || '';
    if (Array.isArray(query.where)) {
      query.where = query.where.map((item) => ({
        ...item,
        is_active: true,
        role_id: reviewer_role_id,
      }));
    } else {
      query.where = {
        ...query.where,
        is_active: true,
        role_id: reviewer_role_id,
      };
    }
    return this.paginationService.paginateWithOptionQuery(
      paginationDto,
      'user',
      query,
    );
  }
  /**
   * Finds contributors with pagination
   * @param query - Query options for user
   * @param paginationDto - Pagination options
   * @returns A promise resolving to a paginated result of users
   * @throws {BadRequestException} - If the query is invalid
   */
  async findContributorsPaginate(
    query: QueryOptions<User>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<User>> {
    // check if the query is array
    const contributorRole = await this.roleService.findOne({
      name: RoleConstant.CONTRIBUTOR,
    });
    const contributor_role_id = contributorRole?.id || '';
    if (Array.isArray(query.where)) {
      // query.where.push({ is_active: true, role_id: contributor_role_id });
      query.where = query.where.map((item) => ({
        ...item,
        is_active: true,
        role_id: contributor_role_id,
      }));
    } else {
      query.where = {
        ...query.where,
        is_active: true,
        role_id: contributor_role_id,
      };
    }
    return this.paginationService.paginateWithOptionQuery(
      paginationDto,
      'user',
      query,
    );
  }
  /**
   * Finds facilitators with pagination
   * @param query - Query options for user
   * @param paginationDto - Pagination options
   * @returns A promise resolving to a paginated result of users
   * @throws {BadRequestException} - If the query is invalid
   */
  async findFacilitatorPaginate(
    query: QueryOptions<User>,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<User>> {
    // check if the query is array
    const contributorRole = await this.roleService.findOne({
      name: RoleConstant.FACILITATOR,
    });
    const facilitator_role_id = contributorRole?.id;
    if (Array.isArray(query.where)) {
      query.where.push({ is_active: true, role_id: facilitator_role_id });
    } else {
      query.where = {
        ...query.where,
        is_active: true,
        role_id: facilitator_role_id,
      };
    }
    return this.paginationService.paginateWithOptionQuery(
      paginationDto,
      'user',
      query,
    );
  }
  /**
   * Updates a user with the given id and partial user data.
   * Deletes the id property from the userData, and sets the is_active property to true.
   * If the userData contains a password, it hashes the password and sets it to the userData.
   * If the userData contains an email, it checks if a user with the same email exists, and if so, throws a BadRequestException.
   * @param id The id of the user to update.
   * @param userData The partial user data to update.
   * @returns A promise resolving to the updated user if found, or null.
   * @throws {BadRequestException} - If the email already exists.
   */
  async firstUpdate(id: any, userData: Partial<User>): Promise<User | null> {
    const update = {
      first_name: userData.first_name,
      middle_name: userData.middle_name,
      last_name: userData.last_name,
      email: userData.email,
      password: await hashPassword(userData.password || 'pending'),
      birth_date: userData.birth_date,
      gender: userData.gender,
      city: userData.city,
      woreda: userData.woreda,
      dialect_id: userData.dialect_id,
      language_id: userData.language_id,
      region_id: userData.region_id,
      zone_id: userData.zone_id,
      is_active: true,
    };
    if (update.email) {
      const user = await this.findOne({
        where: { email: update.email, id: Not(id) },
      });
      if (user) {
        throw new BadRequestException('Email already exists');
      }
    }
    const manager = this.userRepository;
    await manager.update(id, update);
    const user = await manager.findOne({
      where: { id },
      relations: { role: true },
    });
    // if (user?.role.name==RoleConstant.CONTRIBUTOR) {
    //   this.eventEmitter.emit(
    //     ActionEvents.USER_CREATED,
    //   new ContributorCreatedEvent(id),
    // );
    // }
    return user;
  }
  /**
   * Updates a user with the given id and partial user data.
   * Deletes the id, password and is_active properties from the userData.
   * If the userData contains an email, it checks if a user with the same email exists, and if so, throws a BadRequestException.
   * If the userData contains a phone number, it checks if a user with the same phone number exists, and if so, throws a BadRequestException.
   * @param id The id of the user to update.
   * @param userData The partial user data to update.
   * @returns A promise resolving to the updated user if found, or null.
   * @throws {BadRequestException} - If the email or phone number already exists.
   */
  async update(id: any, userData: Partial<User>): Promise<User | null> {
    delete userData.id;
    delete userData.password;
    delete userData.is_active;
    const manager = this.userRepository;
    if (userData.email) {
      const user = await this.findOne({ where: { email: userData.email } });
      if (user) {
        throw new BadRequestException('Email already exists');
      }
    }
    if (userData.phone_number) {
      const user = await this.findOne({
        where: { phone_number: userData.phone_number },
      });
      if (user) {
        throw new BadRequestException('Phone number already exists');
      }
    }
    await manager.update(id, userData);
    const user = await manager.findOne({
      where: { id },
      relations: { role: true },
    });
    if (user) {
      user.profile_picture = await this.fileService.getPreSignedUrl(
        user.profile_picture,
      );
    }
    return user;
  }
  /**
   * Updates a user with the given id and partial user data.
   * Deletes the id, password and is_active properties from the userData.
   * If the userData contains an email, it checks if a user with the same email exists, and if so, throws a BadRequestException.
   * If the userData contains a phone number, it checks if a user with the same phone number exists, and if so, throws a BadRequestException.
   * It also checks if the userData contains dialect_id or language_id, and if so, throws a BadRequestException.
   * @param id The id of the user to update.
   * @param userData The partial user data to update.
   * @returns A promise resolving to the updated user if found, or null.
   * @throws {BadRequestException} - If the email or phone number already exists.
   * @throws {BadRequestException} - If the userData contains dialect_id or language_id.
   */
  async updateProfile(id: any, userData: Partial<User>): Promise<User | null> {
    delete userData.id;
    delete userData.password;
    delete userData.is_active;
    const manager = this.userRepository;
    const user = await this.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (userData.email && userData.email != user.email) {
      const usersBefore = await this.findOne({
        where: { email: userData.email },
      });
      if (usersBefore) {
        throw new BadRequestException('Email already exists');
      }
    }
    if (userData.phone_number && userData.phone_number != user.phone_number) {
      const usersBefore = await this.findOne({
        where: { phone_number: userData.phone_number },
      });
      if (usersBefore) {
        throw new BadRequestException('Phone number already exists');
      }
    }
    if (userData.dialect_id && userData.dialect_id != user.dialect_id) {
      throw new BadRequestException('You cannot change your dialect');
    }
    if (userData.language_id && userData.language_id != user.language_id) {
      throw new BadRequestException('You cannot change your language');
    }
    await manager.update(id, userData);
    if (user) {
      user.profile_picture = await this.fileService.getPreSignedUrl(
        user.profile_picture,
      );
    }
    return user;
  }
  /**
   * Changes the password of a user given the id and new password.
   * Hashes the new password before updating the user.
   * @param id The id of the user to update the password for.
   * @param password The new password of the user.
   * @returns A promise resolving to the updated user if found, or null.
   */
  async changePasswordFromVerification(
    id: any,
    password: string,
  ): Promise<User | null> {
    const hashedPassword = await hashPassword(password);
    const manager = this.userRepository;
    await manager.update(id, { password: hashedPassword });
    const user = await manager.findOne({
      where: { id },
      relations: { role: true },
    });

    return user;
  }

  /**
   * Toggles the is_active property of a user given the id.
   * Throws a NotFoundException if the user is not found.
   * @param id The id of the user to toggle the is_active property for.
   * @param queryRunner The query runner to use for the query.
   * @returns A promise resolving to the updated user if found, or null.
   */
  async activateToggle(
    id: any,
    queryRunner?: QueryRunner,
  ): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.save({ ...user, is_active: !user.is_active });
    if (user.is_active) await this.refreshSessions.revokeAll(user.id);
    return await this.findOne({ where: { id } });
  }

  /**
   * Ensures all roles exist in the database.
   * Creates any missing roles on startup.
   * @returns A promise resolving to nothing.
   */
  private async createSuperAdminIfNotExists() {
    await Promise.all(
      [
        'SuperAdmin',
        'ProjectManager',
        'Reviewer',
        'Facilitator',
        'Contributor',
      ].map(async (name) => {
        const role = await this.roleService.findOne({ name });
        if (!role) {
          await this.roleService.create({
            name,
            description: `${name} Role`,
          });
        }
      }),
    );
  }
  /**
   * Changes the password of a user
   * @param {string} user_id - The id of the user
   * @param {string} current_password - The current password of the user
   * @param {string} new_password - The new password of the user
   * @throws {NotFoundException} - If the user is not found
   * @throws {BadRequestException} - If the new password is the same as the old password
   * @throws {BadRequestException} - If the current password is incorrect
   * @returns {Promise<User>} - The updated user
   */
  async changePassword(
    user_id: string,
    current_password: string,
    new_password: string,
  ) {
    const user = await this.findOneWithPassword({ where: { id: user_id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const validate_new_password = await verifyPassword(
      new_password,
      user.password,
    );
    if (validate_new_password) {
      throw new BadRequestException(
        'New password cannot be the same as the old password',
      );
    }
    const validate_current_password = await verifyPassword(
      current_password,
      user.password,
    );
    if (!validate_current_password) {
      throw new BadRequestException('Current password is incorrect');
    }
    const hashedPassword = await hashPassword(new_password);
    user.password = hashedPassword;
    const updatedUser = await this.userRepository.save(user);
    await this.refreshSessions.revokeAll(user_id);
    return updatedUser;
  }

  /**
   * Filter contributors by task requirement.
   * @param {TaskRequirement | null} requirement - The task requirement to filter by.
   * @param {string} language_id - The language id to filter by.
   * @returns {Promise<string[]>} - The ids of the contributors that match the requirement.
   */
  async filterContributorByTaskRequirement(
    requirement: TaskRequirement | null,
    language_id: string,
  ): Promise<string[]> {
    const contributor_queries: {
      age?: {
        min: number;
        max: number;
      };
      dialects?: string[];
      gender?: string[];
      language_id?: string;
      sectors?: string[];
    } = {};
    if (requirement) {
      if (requirement.is_age_specific) {
        contributor_queries['age'] = {
          min: requirement.age.min,
          max: requirement.age.max,
        };
      }
      if (requirement.is_dialect_specific) {
        contributor_queries['dialects'] = requirement.dialects.map(
          (dialect) => {
            return dialect.id;
          },
        );
      }
      if (requirement.is_gender_specific) {
        contributor_queries['genders'] = requirement.gender;
      }
      contributor_queries['language_id'] = language_id;
    }
    // changing the query to match the user table
    const whereCondition: FindOptionsWhere<User> | FindOptionsWhere<User>[] =
      {};
    const query: {
      dialects?: string[];
      language_id?: string;
      age?: {
        min: number;
        max: number;
      };
      sector?: string[];
      genders?: string[];
    } = contributor_queries;
    if (query.dialects) {
      whereCondition.dialect_id = In(query.dialects); // Assuming dialects is a string array in the User entity
    }
    if (query.language_id) {
      whereCondition.language_id = query.language_id;
    }
    if (query.age) {
      whereCondition.birth_date = Between(
        new Date(
          new Date().setFullYear(new Date().getFullYear() - query.age.max),
        ),
        new Date(
          new Date().setFullYear(new Date().getFullYear() - query.age.min),
        ),
      );
    }
    if (query.genders) {
      whereCondition.gender = In(query.genders);
    }
    const role = await this.roleService.findOne({
      name: RoleConstant.CONTRIBUTOR,
    });
    whereCondition.role_id = role?.id;
    whereCondition.is_active = true;
    const users = await this.userRepository.find({
      where: whereCondition,
      relations: { score: true },
    });
    const usersWithScore: { id: string; score: number }[] = [];
    if (users) {
      users.map((user) => {
        if (user.score) {
          usersWithScore.push({ id: user.id, score: user.score.score });
        } else {
          usersWithScore.push({ id: user.id, score: 0 });
        }
      });
    }
    usersWithScore.sort((a, b) => b.score - a.score);
    return usersWithScore.map((user) => user.id);
  }
  /**
   * Filter users by task requirement.
   * @param {TaskRequirement | null} requirement - The task requirement to filter by.
   * @param {string} language_id - The language id to filter by.
   * @returns {Promise<{ id: string; score: number; gender: string }[]>} - The filtered users with their scores and genders.
   **/
  async filterUserByTaskRequirement(
    requirement: TaskRequirement | null,
    language_id: string,
  ): Promise<{ id: string; score: number; gender: string }[]> {
    const contributor_queries: {
      age?: {
        min: number;
        max: number;
      };
      dialects?: string[];
      gender?: string[];
      language_id?: string;
      sectors?: string[];
    } = {};
    if (requirement) {
      if (requirement.is_age_specific) {
        contributor_queries['age'] = {
          min: requirement.age.min,
          max: requirement.age.max,
        };
      }
      if (requirement.is_dialect_specific) {
        contributor_queries['dialects'] = requirement.dialects.map(
          (dialect) => {
            return dialect.id;
          },
        );
      }
      if (requirement.is_gender_specific) {
        const genders: string[] = [];
        if (requirement.gender.male > 0) {
          genders.push(GENDER_CONSTANT.MALE);
        }
        if (requirement.gender.female > 0) {
          genders.push(GENDER_CONSTANT.FEMALE);
        }
        contributor_queries['genders'] = genders;
      }
      contributor_queries['language_id'] = language_id;
    }
    // changing the query to match the user table
    const whereCondition: FindOptionsWhere<User> | FindOptionsWhere<User>[] =
      {};
    const query: {
      dialects?: string[];
      language_id?: string;
      age?: {
        min: number;
        max: number;
      };
      sector?: string[];
      genders?: string[];
    } = contributor_queries;
    if (query.dialects) {
      whereCondition.dialect_id = In(query.dialects); // Assuming dialects is a string array in the User entity
    }
    if (query.language_id) {
      whereCondition.language_id = query.language_id;
    }
    if (query.age) {
      whereCondition.birth_date = Between(
        new Date(
          new Date().setFullYear(new Date().getFullYear() - query.age.max),
        ),
        new Date(
          new Date().setFullYear(new Date().getFullYear() - query.age.min),
        ),
      );
    }
    if (query.genders) {
      whereCondition.gender = In(query.genders);
    }
    const role = await this.roleService.findOne({
      name: RoleConstant.CONTRIBUTOR,
    });
    whereCondition.role_id = role?.id;
    whereCondition.is_active = true;
    const users = await this.userRepository.find({
      where: whereCondition,
      relations: { score: true },
    });
    const usersWithScore: { id: string; score: number; gender: string }[] = [];
    if (users) {
      users.map((user) => {
        if (user.score) {
          usersWithScore.push({
            id: user.id,
            score: user.score.score,
            gender: user.gender,
          });
        } else {
          usersWithScore.push({ id: user.id, score: 0, gender: user.gender });
        }
      });
    }
    usersWithScore.sort((a, b) => b.score - a.score);
    return usersWithScore;
  }
  async findUserByTaskRequirement(
    requirement: TaskRequirement | null,
    queryOptions: QueryOptions<User>,
    language_id: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<User>> {
    const contributor_queries: {
      age?: {
        min: number;
        max: number;
      };
      dialects?: string[];
      gender?: string[];
      language_id?: string;
      sectors?: string[];
    } = {};
    if (requirement) {
      if (requirement.is_age_specific) {
        contributor_queries['age'] = {
          min: requirement.age.min,
          max: requirement.age.max,
        };
      }
      if (requirement.is_dialect_specific) {
        contributor_queries['dialects'] = requirement.dialects.map(
          (dialect) => {
            return dialect.id;
          },
        );
      }
      if (requirement.is_gender_specific) {
        const genders: string[] = [];
        if (requirement.gender.male > 0) {
          genders.push(GENDER_CONSTANT.MALE);
        }
        if (requirement.gender.female > 0) {
          genders.push(GENDER_CONSTANT.FEMALE);
        }
        contributor_queries['genders'] = genders;
      }
      contributor_queries['language_id'] = language_id;
    }
    // changing the query to match the user table
    let whereCondition: FindOptionsWhere<User> = {};
    const query: {
      dialects?: string[];
      language_id?: string;
      age?: {
        min: number;
        max: number;
      };
      sector?: string[];
      genders?: string[];
    } = contributor_queries;
    if (query.dialects) {
      whereCondition.dialect_id = In(query.dialects); // Assuming dialects is a string array in the User entity
    }
    if (query.language_id) {
      whereCondition.language_id = query.language_id;
    }
    if (query.age) {
      whereCondition.birth_date = Between(
        new Date(
          new Date().setFullYear(new Date().getFullYear() - query.age.max),
        ),
        new Date(
          new Date().setFullYear(new Date().getFullYear() - query.age.min),
        ),
      );
    }
    if (query.genders) {
      whereCondition.gender = In(query.genders);
    }
    const role = await this.roleService.findOne({
      name: RoleConstant.CONTRIBUTOR,
    });
    whereCondition.role_id = role?.id;
    whereCondition.is_active = true;
    const offset = (page - 1) * limit;

    let finalWhere: FindOptionsWhere<User> | FindOptionsWhere<User>[] =
      whereCondition;
    if (queryOptions) {
      if (!Array.isArray(queryOptions.where)) {
        finalWhere = { ...whereCondition, ...queryOptions.where };
      } else if (Array.isArray(queryOptions.where)) {
        finalWhere = queryOptions.where.map((condition) => ({
          ...whereCondition,
          ...condition,
        }));
      }
      if (queryOptions.where) {
        whereCondition = { ...whereCondition, ...queryOptions.where };
      }
    }
    const [user, count] = await this.userRepository.findAndCount({
      where: finalWhere,
      relations: { score: true },
      take: limit,
      skip: offset,
    });
    return paginate<User>(user, count, page, limit);
  }
  /**
   * Retrieves the count of users based on the query options provided.
   * If a role_name is provided, the count will be filtered by the role_id.
   * @param queryOption - The query options to filter the count.
   * @param role_name - The name of the role to filter the count.
   * @returns A promise resolving to the count of users.
   */
  async count(queryOption: QueryOptions<User>, role_name?: string) {
    if (role_name) {
      const role = await this.roleService.findOne({ name: role_name });
      if (role) {
        queryOption.where = { ...queryOption.where, role_id: role.id };
      }
    }
    return this.userRepository.count(queryOption);
  }
  /**
   * Retrieves a list of user groups based on the provided user_ids and role_id.
   * If user_ids is provided, the result will be filtered by the user_ids.
   * If role_id is provided, the result will be filtered by the role_id.
   * The result will contain the dialect_id, dialect_name, dialect_description, count and language_id.
   * @param user_ids - An array of user ids to filter the result.
   * @param role_id - The id of the role to filter the result.
   * @returns A promise resolving to the list of user groups.
   */
  async getUserGroupByLanguageAndDialect(
    user_ids?: string[],
    role_id?: string,
  ) {
    const whereCondition: FindOptionsWhere<User> | FindOptionsWhere<User>[] =
      {};
    if (user_ids) {
      whereCondition.id = In(user_ids);
    }
    if (role_id) {
      whereCondition.role_id = role_id;
    }
    return this.userRepository
      .createQueryBuilder('user')
      .select([
        // 'user.dialect_id AS user_dialect_id',
        'dialect.id AS dialect_id',
        'dialect.name AS dialect_name',
        'dialect.description AS dialect_description',
        'COUNT(user.id) AS count',
      ])
      .leftJoin('user.dialect', 'dialect', 'dialect.deletedAt IS NULL')
      .where(whereCondition || {})
      .groupBy('user.dialect_id')
      .addGroupBy('dialect.id')
      .addGroupBy('dialect.name')
      .addGroupBy('dialect.description')
      .addGroupBy('dialect.created_by')
      .addGroupBy('dialect.updated_by')
      .addGroupBy('dialect.created_date')
      .addGroupBy('dialect.updated_date')
      .addGroupBy('dialect.language_id')
      .addGroupBy('dialect.deletedAt')
      .getRawMany();
  }
  /**
   * Get the count of users by gender.
   * @param user_ids - An array of user ids to filter the result.
   * @param role_id - The id of the role to filter the result
   * @returns A promise resolving to the list of user groups
   */
  async getUserGroupByGender(user_ids?: string[], role_id?: string) {
    const whereCondition: FindOptionsWhere<User> | FindOptionsWhere<User>[] =
      {};
    if (user_ids) {
      whereCondition.id = In(user_ids);
    }
    if (role_id) {
      whereCondition.role_id = role_id;
    }
    return this.userRepository
      .createQueryBuilder('user')
      .select(['user.gender AS gender', 'COUNT(user.id) AS count'])
      .where(whereCondition || {})
      .groupBy('user.gender')
      .getRawMany();
  }
}
