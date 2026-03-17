import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface OrderReadyEmailProps {
  clientName: string;
  ticketNumber: string;
  shopName: string;
  pickupTime?: string;
  items: { name: string; quantity: number }[];
  total: string;
}

export function OrderReadyEmail({
  clientName,
  ticketNumber,
  shopName,
  pickupTime,
  items,
  total,
}: OrderReadyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Votre commande #{ticketNumber} est prete — {shopName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>{shopName}</Heading>
          <Hr style={hr} />

          <Text style={paragraph}>Bonjour {clientName},</Text>
          <Text style={paragraph}>
            Votre commande <strong>#{ticketNumber}</strong> est prete
            {pickupTime ? ` pour retrait ${pickupTime}` : ""}.
          </Text>

          <Section style={itemsSection}>
            <Text style={subheading}>Recapitulatif</Text>
            {items.map((item, i) => (
              <Text key={`${item.name}-${i}`} style={itemRow}>
                {item.quantity}x {item.name}
              </Text>
            ))}
            <Hr style={hr} />
            <Text style={totalRow}>Total : {total}</Text>
          </Section>

          <Text style={paragraph}>A bientot !</Text>
          <Text style={footer}>{shopName} — Envoye via PrepareOS</Text>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ─────────────────────────────────────────────

const main = {
  backgroundColor: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "32px",
  borderRadius: "10px",
  maxWidth: "480px",
  border: "1px solid #e2e8f0",
};

const heading = {
  color: "#2563eb",
  fontSize: "24px",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const hr = {
  borderColor: "#e2e8f0",
  margin: "16px 0",
};

const paragraph = {
  color: "#1e293b",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "8px 0",
};

const subheading = {
  color: "#1e293b",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 8px",
};

const itemsSection = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "16px",
  margin: "16px 0",
};

const itemRow = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "2px 0",
};

const totalRow = {
  color: "#1e293b",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "8px 0 0",
};

const footer = {
  color: "#94a3b8",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "24px 0 0",
};
