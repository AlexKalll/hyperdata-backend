import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ContactUsService } from '../service/ContactUs.service';
import { CreateContactUsDto, UpdateContactUsDto } from '../dto/ContactUs.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';

@Controller('contact-us')
@ApiTags('contact-us')
export class ContactUsController {
  constructor(private readonly contactUsService: ContactUsService) {}

  @Post()
  @ApiOperation({ summary: 'Create contact-us' })
  @UsePipes(new ZodValidationPipe(CreateContactUsDto))
  async create(@Body() body: CreateContactUsDto) {
    return await this.contactUsService.create(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all contact-us' })
  @UsePipes(new ZodValidationPipe())
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.contactUsService.findManyPaginate({}, paginationDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a contact-us by id' })
  @UsePipes(new ZodValidationPipe())
  async findOne(@Param('id') id: string) {
    return await this.contactUsService.findOne({ id });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a contact-us by id' })
  @UsePipes(new ZodValidationPipe())
  async update(
    @Param('id') id: string,
    @Body() updateContactUsDto: UpdateContactUsDto,
  ) {
    return await this.contactUsService.update(id, updateContactUsDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a contact-us by id' })
  @UsePipes(new ZodValidationPipe())
  async remove(@Param('id') id: string) {
    return await this.contactUsService.remove(id);
  }
}
