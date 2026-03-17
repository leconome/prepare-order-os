import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface BroadcastEmailProps {
  shopName: string;
  content: string;
}

export function BroadcastEmail({ shopName, content }: BroadcastEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {content.slice(0, 100)}
        {content.length > 100 ? "..." : ""}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>{shopName}</Heading>
          <Hr style={hr} />

          <Text style={paragraph}>{content}</Text>

          <Hr style={hr} />
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
  whiteSpace: "pre-wrap" as const,
};

const footer = {
  color: "#94a3b8",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "24px 0 0",
};
