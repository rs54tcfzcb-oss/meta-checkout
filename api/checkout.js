export default async function handler(req, res) {
  try {
    const { products = '' } = req.query;

    if (!products) {
      return res.status(400).send('Missing products param');
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': '2025-01-23',
    };

    async function resolveToVariationId(inputId) {
      const lookupResp = await fetch(
        `https://connect.squareup.com/v2/catalog/object/${inputId}`,
        { headers }
      );

      const lookupData = await lookupResp.json();

      if (!lookupResp.ok) {
        throw new Error(`Catalog lookup failed for ${inputId}: ${JSON.stringify(lookupData)}`);
      }

      const obj = lookupData.object;

      if (!obj) {
        throw new Error(`No catalog object returned for ${inputId}`);
      }

      if (obj.type === 'ITEM_VARIATION') {
        return obj.id;
      }

      if (obj.type === 'ITEM') {
        const variations = obj.item_data?.variations || [];
        if (!variations.length) {
          throw new Error(`Item ${inputId} has no variations`);
        }
        return variations[0].id;
      }

      throw new Error(`Unsupported catalog object type for ${inputId}: ${obj.type}`);
    }

    const rawProducts = products.split(',').map((entry) => {
      const [productId, qtyStr] = entry.split(':');
      const quantity = parseInt(qtyStr, 10);
      if (!productId || !quantity) return null;
      return { productId, quantity };
    }).filter(Boolean);

    if (!rawProducts.length) {
      return res.status(400).send('No valid line items');
    }

    const line_items = [];
    for (const item of rawProducts) {
      const variationId = await resolveToVariationId(item.productId);

      line_items.push({
        catalog_object_id: variationId,
        quantity: item.quantity.toString(),
      });
    }

    const payload = {
      idempotency_key: `meta-${Date.now()}`,
      order: {
        location_id: process.env.SQUARE_LOCATION_ID,
        line_items,
      },
    };

    const response = await fetch(
      'https://connect.squareup.com/v2/online-checkout/payment-links',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).send(JSON.stringify(data));
    }

    return res.redirect(data.payment_link.url);
  } catch (err) {
    return res.status(500).send(`Server error: ${err.message}`);
  }
}
