import { z } from 'zod';

export const categories = ['all', 'books', 'electronics', 'fashion', 'home'] as const;
export type Category = (typeof categories)[number];

export const filtersSchema = z.object({
  search: z.string().default(''),
  category: z.enum(categories).default('all'),
  minPrice: z.coerce.number().min(0).default(0),
  maxPrice: z.coerce.number().min(0).default(500),
  includeOutOfStock: z.coerce.boolean().default(false),
});

export type Filters = z.output<typeof filtersSchema>;

type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstValue(values: string | string[] | undefined): string | undefined {
  if (Array.isArray(values)) {
    return values[0];
  }
  return values ?? undefined;
}

export function parseFiltersFromSearchParams(searchParams: SearchParamsRecord): Filters {
  const draft = {
    search: firstValue(searchParams.search),
    category: firstValue(searchParams.category),
    minPrice: firstValue(searchParams.minPrice),
    maxPrice: firstValue(searchParams.maxPrice),
    includeOutOfStock: firstValue(searchParams.includeOutOfStock),
  };

  return filtersSchema.parse(draft);
}
