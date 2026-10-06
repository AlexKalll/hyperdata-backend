import { Module } from '@nestjs/common';
import { Language } from './entities/Language.entity';
import { Country } from './entities/Country.entity';
import { Region } from './entities/Region.entity';
import { Zone } from './entities/Zone.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RejectionType } from './entities/RejectionType.entity';
import {
  CountryService,
  RegionService,
  DialectService,
  LanguageService,
  RejectionTypeService,
  ZoneService,
  OrganizationService,
  SectorService,
} from './service';
import {
  CountryController,
  RegionController,
  DialectController,
  LanguageController,
  RejectionTypeController,
  ZoneController,
  SectorController,
  OrganizationController,
} from './controller';
import { Dialect } from './entities/Dialect.entity';
import { CommonModule } from 'src/common/common.module';
import { Sector } from './entities/Sector.entity';
import { Organization } from './entities/Organization.entity';
import { FlagTypeService } from './service/FlagType.service';
import { FlagType } from './entities/FlagType.entity';
import { DataSetAnnotationService } from './service/DataSetAnnotation.service';
import { DataSetAnnotationController } from './controller/DataSetAnnotation.controller';
import { DataSetAnnotation } from './entities/DataSetAnnotation.entity';
import { FlagTypeController } from './controller/FlagType.controller';
import { AnnotationTypeController } from './controller/AnnotationType.controller';
import { AnnotationTypeService } from './service/AnnotationType.service';
import { AnnotationType } from './entities/AnnotationType.entity';
import { ReferenceDataAdminGuard } from './guard/ReferenceDataAdmin.guard';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      Language,
      Dialect,
      Region,
      Zone,
      Country,
      FlagType,
      RejectionType,
      Sector,
      Organization,
      DataSetAnnotation,
      AnnotationType,
    ]), // Import necessary entities
  ],
  controllers: [
    CountryController,
    DialectController,
    LanguageController,
    RegionController,
    RejectionTypeController,
    ZoneController,
    SectorController,
    OrganizationController,
    DataSetAnnotationController,
    AnnotationTypeController,
    FlagTypeController,
  ],
  providers: [
    CountryService,
    DialectService,
    FlagTypeService,
    LanguageService,
    RegionService,
    RejectionTypeService,
    ZoneService,
    SectorService,
    DataSetAnnotationService,
    OrganizationService,
    AnnotationTypeService,
    ReferenceDataAdminGuard,
  ],
  exports: [
    LanguageService,
    DialectService,
    ZoneService,
    DataSetAnnotationService,
    RegionService,
  ],
})
export class BaseDataModule {}
