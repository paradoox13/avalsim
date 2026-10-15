import { ok, route } from '@/lib/api';
import { getModemById, incrementModemViews } from '@/lib/services/modem.service';
import { notFound } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const GET = route(async (_request, ctx: { params: { id: string } }) => {
  const modem = await getModemById(ctx.params.id);
  if (!modem.isActive || modem.stock <= 0) throw notFound('این محصول موجود نیست');
  await incrementModemViews(modem.id);

  return ok({
    id: modem.id,
    sku: modem.sku,
    brand: modem.brand,
    model: modem.model,
    title: modem.title,
    price: modem.price,
    stock: modem.stock,
    imageUrl: modem.imageUrl,
    gallery: modem.gallery,
    warranty: modem.warranty,
    description: modem.description,
    specs: modem.specs,
    ownerType: modem.ownerType,
  });
});
