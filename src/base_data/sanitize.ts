import { AnnotationType } from './entities/AnnotationType.entity';
import {
  Country,
  Dialect,
  Language,
  Region,
  RejectionType,
  Zone,
} from './entities';
import { DataSetAnnotation } from './entities/DataSetAnnotation.entity';
import { Organization } from './entities/Organization.entity';
import { Sector } from './entities/Sector.entity';
import { FlagType } from './entities/FlagType.entity';
import { ApiProperty } from '@nestjs/swagger';

export const AnnotationTypeSanitizedFields = {
  id: true,
  name: true,
  created_date: true,
};
export class AnnotationTypeSanitized {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  created_date: Date;
  static from(annotationType: AnnotationType) {
    return {
      id: annotationType.id,
      name: annotationType.name,
      description: annotationType.description,
      created_date: annotationType.created_date,
    };
  }
}
export const CountrySanitizedFields = {
  id: true,
  name: true,
  code: true,
  continent: true,
  created_date: true,
};
export class CountrySanitized {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  code: string;
  @ApiProperty()
  continent: string;
  @ApiProperty()
  created_date: Date;
  static from(country: Country) {
    return {
      id: country.id,
      name: country.name,
      code: country.code,
      continent: country.continent,
      created_date: country.created_date,
    };
  }
}

export const DataSetAnnotationSanitizedFields = {
  id: true,
  name: true,
  created_date: true,
};
export class DataSetAnnotationSanitized {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  created_date: Date;
  static from(dataSetAnnotation: DataSetAnnotation) {
    return {
      id: dataSetAnnotation.id,
      name: dataSetAnnotation.name,
      description: dataSetAnnotation.description,
      created_date: dataSetAnnotation.created_date,
    };
  }
}
export class LanguageSanitized {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  created_date: Date;
  static from(language: Language) {
    return {
      id: language.id,
      name: language.name,
      code: language.code,
      created_date: language.created_date,
    };
  }
}
export const DialectSanitizedFields = {
  id: true,
  name: true,
  created_date: true,
};

export class DialectSanitized {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  created_date: Date;

  @ApiProperty({ type: LanguageSanitized })
  language?: LanguageSanitized;
  static from(dialect: Dialect) {
    return {
      id: dialect.id,
      name: dialect.name,
      created_date: dialect.created_date,
      language: dialect.language && LanguageSanitized.from(dialect.language),
    };
  }
}
export const FlagTypeSanitizedFields = {
  id: true,
  name: true,
  created_date: true,
};
export class FlagTypeSanitized {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  created_date: Date;
  static from(flagType: FlagType) {
    return {
      id: flagType.id,
      name: flagType.name,
      description: flagType.description,
      created_date: flagType.created_date,
    };
  }
}
export const LanguageSanitizedFields = {
  id: true,
  name: true,
  code: true,
  created_date: true,
};

export const OrganizationSanitizedFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  created_date: true,
};
export class OrganizationSanitized {
  @ApiProperty()
  id: number;
  @ApiProperty()
  name: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  phone: string;
  @ApiProperty()
  address: string;
  @ApiProperty()
  created_date: Date;
  static from(organization: Organization) {
    return {
      id: organization.id,
      name: organization.name,
      email: organization.email,
      phone: organization.phone,
      address: organization.address,
      created_date: organization.created_date,
    };
  }
}
export const RegionSanitizedFields = {
  id: true,
  name: true,
  created_date: true,
};
export class RegionSanitized {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  created_date: Date;
  @ApiProperty({ type: CountrySanitized })
  country?: CountrySanitized;
  static from(region: Region) {
    return {
      id: region.id,
      name: region.name,
      created_date: region.created_date,
      country: region.country && CountrySanitized.from(region.country),
    };
  }
}
export const RejectionTypeSanitizedFields = {
  id: true,
  name: true,
  created_date: true,
};
export class RejectionTypeSanitized {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  created_date: Date;
  static from(rejectionType: RejectionType) {
    return {
      id: rejectionType.id,
      name: rejectionType.name,
      description: rejectionType.description,
      created_date: rejectionType.created_date,
    };
  }
}
export const SectorSanitizedFields = {
  id: true,
  name: true,
  created_date: true,
};
export class SectorSanitized {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  created_date: Date;
  static from(sector: Sector) {
    return {
      id: sector.id,
      name: sector.name,
      created_date: sector.created_date,
    };
  }
}

export const ZoneSanitizedFields = {
  id: true,
  name: true,
  created_date: true,
};
export class ZoneSanitized {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  created_date: Date;
  static from(zone: Zone) {
    return {
      id: zone.id,
      name: zone.name,
      created_date: zone.created_date,
    };
  }
}
