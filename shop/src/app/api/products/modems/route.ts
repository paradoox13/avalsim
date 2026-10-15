import { paginated, readQuery, route } from '@/lib/api';
import { modemFilterSchema } from '@/lib/validation/product';
import { listModems } from '@/lib/services/modem.service';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const filters = readQuery(request, modemFilterSchema);
  const result = await listModems(
    {
      brands: filters.brands,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      q: filters.q,
      inStock: filters.inStock,
      sort: filters.sort,
      page: filters.page,
      limit: filters.limit,
    },
    { forStorefront: true },
  );

  return paginated(
    result.items.map((modem) => ({
      id: modem.id,
      sku: modem.sku,
      brand: modem.brand,
      model: modem.model,
      title: modem.title,
      price: modem.price,
      stock: modem.stock,
      imageUrl: modem.imageUrl,
      warranty: modem.warranty,
      description: modem.description,
      views: modem.views,
    })),
    { page: result.page, limit: result.limit, total: result.total },
  );
});
