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
import { BlogService } from '../service/Blog.service';
import { CreateBlogDto } from '../dto/Blog.dto';
import { UpdateBlogDto } from '../dto/Blog.dto';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/decorators/roles.enum';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';

@ApiTags('Blog')
@ApiExtraModels(PaginationDto)
@ApiBearerAuth()
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe(CreateBlogDto))
  async create(@Body() createBlogDto: CreateBlogDto) {
    return await this.blogService.create(createBlogDto);
  }

  @Get()
  async findAll(@Query() paginationDto: PaginationDto) {
    return await this.blogService.findManyPaginate({}, paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.blogService.findOne({ id });
  }

  @ApiOperation({ summary: 'Update a Country by id' })
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async update(@Param('id') id: string, @Body() updateBlogDto: UpdateBlogDto) {
    return await this.blogService.update(id, updateBlogDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async remove(@Param('id') id: string) {
    return await this.blogService.remove(id);
  }
}
