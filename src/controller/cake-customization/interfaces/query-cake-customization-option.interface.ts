import { CakeCustomizationOption } from '../entities/cake-customization-option.entity';

export interface FindAllCakeCustomizationOptionsResult {
  data: CakeCustomizationOption[];
  meta: {
    total: number;
    currentPage: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
    limit: number;
  };
}
