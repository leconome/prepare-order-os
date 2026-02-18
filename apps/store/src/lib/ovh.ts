import Ovh from "@ovhcloud/node-ovh";

const OVH_APP_KEY = process.env.OVH_APP_KEY;
const OVH_APP_SECRET = process.env.OVH_APP_SECRET;
const OVH_CONSUMER_KEY = process.env.OVH_CONSUMER_KEY;
const OVH_SMS_SERVICE_NAME = process.env.OVH_SMS_SERVICE_NAME;

let client: InstanceType<typeof Ovh> | null = null;

function getClient() {
  if (!client) {
    if (!OVH_APP_KEY || !OVH_APP_SECRET || !OVH_CONSUMER_KEY) {
      throw new Error("OVH credentials not configured");
    }
    client = new Ovh({
      endpoint: "ovh-eu",
      appKey: OVH_APP_KEY,
      appSecret: OVH_APP_SECRET,
      consumerKey: OVH_CONSUMER_KEY,
    });
  }
  return client;
}

function getServiceName(): string {
  if (!OVH_SMS_SERVICE_NAME) {
    throw new Error("OVH_SMS_SERVICE_NAME not configured");
  }
  return OVH_SMS_SERVICE_NAME;
}

export async function getAccountCredits(): Promise<{
  creditsLeft: number;
  name: string;
}> {
  const ovh = getClient();
  const serviceName = getServiceName();
  const result = await ovh.requestPromised("GET", `/sms/${serviceName}`);
  return {
    creditsLeft: result.creditsLeft ?? 0,
    name: result.name ?? serviceName,
  };
}

/**
 * Normalize a French phone number to international format (+33...)
 * Handles: 06..., 07..., 0033..., +33..., 33...
 */
function normalizePhoneNumber(phone: string): string {
  // Strip spaces, dashes, dots, parens
  let cleaned = phone.replace(/[\s\-.\(\)]/g, "");

  // 0033... → +33...
  if (cleaned.startsWith("0033")) {
    cleaned = "+33" + cleaned.slice(4);
  }
  // 06... or 07... → +336... or +337...
  else if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "+33" + cleaned.slice(1);
  }
  // 33... (no plus) → +33...
  else if (cleaned.startsWith("33") && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  // Already +33...
  else if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  return cleaned;
}

export async function sendSms(
  to: string,
  message: string,
): Promise<{ ids: number[] }> {
  const ovh = getClient();
  const serviceName = getServiceName();
  const receiver = normalizePhoneNumber(to);
  const result = await ovh.requestPromised("POST", `/sms/${serviceName}/jobs`, {
    message,
    receivers: [receiver],
    noStopClause: true,
    charset: "UTF-8",
    senderForResponse: true,
  });
  return { ids: result.ids ?? [] };
}

export async function getSmsStatus(
  messageId: number,
): Promise<{ status: string; receiver: string }> {
  const ovh = getClient();
  const serviceName = getServiceName();
  const result = await ovh.requestPromised(
    "GET",
    `/sms/${serviceName}/jobs/${messageId}`,
  );
  return {
    status: result.deliveryReceipt ?? "unknown",
    receiver: result.receiver ?? "",
  };
}

export function getCreditBuyUrl(): string {
  const serviceName = getServiceName();
  return `https://www.ovh.com/manager/#/sms/${serviceName}/order`;
}

export function isOvhConfigured(): boolean {
  return !!(
    OVH_APP_KEY &&
    OVH_APP_SECRET &&
    OVH_CONSUMER_KEY &&
    OVH_SMS_SERVICE_NAME
  );
}
