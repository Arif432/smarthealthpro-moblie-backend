const express = require("express");
const router = express.Router();
const stripe = require("stripe")(
  "sk_test_51RAdPhFSalvX5ARZOuddnMWNr5GpUm1trSLG66EUJvt6TKSesD8T7kN5V2qdQk7PSrRYgiTxGTTZCLyJJ7rk9mjT004EmhVaRT"
);

router.post("/intents", async (req, res) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: req.body.amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({ paymentIntent: paymentIntent.client_secret });
  } catch (e) {
    res.status(400).json({
      error: e.message,
    });
  }
});

module.exports = router;
