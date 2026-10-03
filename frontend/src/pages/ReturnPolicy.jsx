import React from "react";

const policySections = [
  {
    title: "1. Return requests",
    text: "Sample term: contact ShopNest within 14 days of delivery to request a return. Include your order number and the reason for the request. Wait for return instructions before sending anything back.",
  },
  {
    title: "2. Item condition",
    text: "Sample term: returned items should be unused and include their original packaging and included accessories. Some product types may be excluded where hygiene, customization, or local law requires it.",
  },
  {
    title: "3. Refunds",
    text: "After a return is received and reviewed, an approved refund is sent to the original payment method. The time it takes to appear depends on the payment provider and bank.",
  },
  {
    title: "4. Damaged or incorrect items",
    text: "If an order arrives damaged or contains the wrong item, contact support with your order number and photos so the issue can be reviewed.",
  },
  {
    title: "5. Return shipping",
    text: "Sample term: return-shipping costs and any exceptions should be confirmed in the final store policy before publication.",
  },
];

const ReturnPolicy = () => (
  <main
    style={{
      maxWidth: 900,
      margin: "0 auto",
      padding: "clamp(20px, 4vw, 40px)",
      background: "#10221b",
      borderRadius: 16,
      border: "1px solid rgba(255, 255, 255, 0.05)",
      lineHeight: 1.8,
      color: "#a9b9ae",
    }}
  >
    <p style={{ color: "#48c9a1", fontWeight: 700, marginBottom: 10 }}>
      SHOPNEST · SAMPLE POLICY
    </p>
    <h1 style={{ color: "#f2f7f3", fontSize: "2.1rem", marginBottom: 14 }}>
      Returns &amp; refunds
    </h1>
    <p style={{ marginBottom: 28 }}>
      This is placeholder content for development. Confirm the return window,
      item conditions, shipping responsibilities, and consumer-law requirements
      for your store before publishing or accepting live orders.
    </p>

    {policySections.map((section) => (
      <section key={section.title} style={{ marginTop: 24 }}>
        <h2
          style={{
            color: "#48c9a1",
            fontSize: "1.2rem",
            marginBottom: 8,
          }}
        >
          {section.title}
        </h2>
        <p>{section.text}</p>
      </section>
    ))}

    <p style={{ marginTop: 28 }}>
      Sample contact:{" "}
      <a href="mailto:support@example.com" style={{ color: "#48c9a1" }}>
        support@example.com
      </a>
    </p>
  </main>
);

export default ReturnPolicy;
