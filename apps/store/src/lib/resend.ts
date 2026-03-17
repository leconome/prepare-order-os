import { Resend } from "resend";

/**
 * Get Resend client instance (lazy initialization)
 * Only creates the instance when actually needed, not at module load time
 * This prevents errors during migrations or other operations that don't need email
 */
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is not set. Email functionality requires a Resend API key.",
      );
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

// Export a proxy object that lazily initializes Resend when properties are accessed
const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return getResend()[prop as keyof Resend];
  },
});

export default resend;
