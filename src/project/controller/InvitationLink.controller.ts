import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guard/role.guard';
import { InvitationLinkService } from '../service/InvitationLink.service';
import { Role } from 'src/auth/decorators/roles.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import { ProjectScopeGuard } from '../guard/ProjectScope.guard';
import { PaginationDto } from 'src/common/dto/Pagination.dto';
import {
  AcceptInvitationDto,
  createInvitationLinkDto,
} from '../dto/InvitationLink.dto';
@Controller('/project-mgmt/invitation-link')
@ApiTags('InvitationLink')
@ApiBearerAuth()
export class InivitationController {
  constructor(private readonly invitationLinkService: InvitationLinkService) {}

  @Post('/accept-invite/:invitation_id')
  async findUserInvitationLinks(
    @Param('invitation_id') invitation_id: string,
    @Body() userData: AcceptInvitationDto,
  ) {
    return this.invitationLinkService.acceptInvitation(invitation_id, userData);
  }

  @Get('/project/:project_id')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard, ProjectScopeGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async findProjectInvitationLinks(
    @Param('project_id') project_id: string,
    @Query() paginateDto: PaginationDto,
  ) {
    return this.invitationLinkService.findPaginate(
      {
        where: {
          project_id: project_id,
        },
      },
      paginateDto,
    );
  }
  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return this.invitationLinkService.findOne({
      where: {
        id: id,
      },
    });
  }
  @Get('/task/:task_id')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @UseGuards(JwtAuthGuard, RolesGuard, ProjectScopeGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async findTaskInvitationLinks(
    @Param('task_id') task_id: string,
    @Query() paginateDto: PaginationDto,
  ) {
    return this.invitationLinkService.findPaginate(
      {
        where: {
          task_id,
        },
        relations: { organization: true },
      },
      paginateDto,
    );
  }
  @Post('/project/:project_id')
  @UseGuards(JwtAuthGuard, RolesGuard, ProjectScopeGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async createProjectInvitationLink(
    @Param('project_id') project_id: string,
    @Body(new ZodValidationPipe(createInvitationLinkDto))
    invitationData: createInvitationLinkDto,
  ) {
    return this.invitationLinkService.createProjectInvitationLink(
      project_id,
      invitationData,
    );
  }
  @Post('/task/:task_id')
  @UseGuards(JwtAuthGuard, RolesGuard, ProjectScopeGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.PROJECT_MANAGER)
  async invite(
    @Param('task_id') task_id: string,
    @Body(new ZodValidationPipe(createInvitationLinkDto))
    invitationData: createInvitationLinkDto,
  ) {
    return this.invitationLinkService.createTaskInvitationLink(
      task_id,
      invitationData,
    );
  }
}
