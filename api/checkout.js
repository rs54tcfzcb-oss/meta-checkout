export default async function handler(req, res) {
  try {
    const { products = '' } = req.query;

    if (!products) {
      return res.status(400).send('Missing products param');
    }

    const lineItems = products.split(',').map(entry => {
      const [productId, qtyStr] = entry.split(':');
      const quantity = parseInt(qtyStr, 10);

      if (!productId || !quantity) return null;

      return {
        name: productId,
        quantity: quantity.toString(),
        itemType: 'ITEM',
        catalogObjectId: productId,
      };
    }).filter(Boolean);

    if (!lineItems.length) {
      return res.status(400).send('No valid line items');
    }

    const payload = {
      idempotencyKey: `meta-${Date.now()}`,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        lineItems,
      }
    };

    const response = await fetch('https://connect.squareup.com/v2/payment-links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).send(JSON.stringify(data));
    }

    return res.redirect(data.paymentLink.url);

  } catch (err) {
    return res.status(500).send('Server error');
  }
}
