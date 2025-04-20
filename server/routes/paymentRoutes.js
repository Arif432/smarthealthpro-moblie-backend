const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/intents", async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in cart" });
    }

    let totalAmount = 0;
    let currency = null;

    for (const item of items) {
      const { priceId, quantity } = item;

      if (!priceId || !quantity) {
        return res.status(400).json({ error: "Invalid cart item format" });
      }

      // Retrieve price from Stripe
      const price = await stripe.prices.retrieve(priceId);

      if (!price.unit_amount || !price.currency) {
        return res
          .status(400)
          .json({ error: "Invalid Stripe price configuration" });
      }

      totalAmount += price.unit_amount * quantity;

      if (!currency) {
        currency = price.currency;
      } else if (currency !== price.currency) {
        return res
          .status(400)
          .json({ error: "Mixed currencies in cart not supported" });
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        cart: JSON.stringify(items),
      },
    });

    res.json({ paymentIntent: paymentIntent.client_secret });
  } catch (err) {
    console.error("Payment intent creation error:", err);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

module.exports = router;
