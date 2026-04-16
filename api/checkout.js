export default async function handler(req, res) {
  try {
    const { products = '' } = req.query;

    if (!products) {
      return res.status(400).send('Missing products param');
    }

    const line_items = products
      .split(',')
      .map((entry) => {
        const [productId, qtyStr] = entry.split(':');
        const quantity = parseInt(qtyStr, 10);

        if (!productId || !quantity) return null;

        return {
          name: productId,
          quantity: quantity.toString(),
          item_type: 'ITEM',
          catalog_object_id: productId,
        };
      })
      .filter(Boolean);

    if (!line_items.length) {
      return res.status(400).send('No valid line items');
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2025-01-23',
        },
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
