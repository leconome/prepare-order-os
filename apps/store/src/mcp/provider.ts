// apps/store/src/mcp/provider.ts
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type Provider = "mistral" | "anthropic" | "openai";

const PROVIDER_CONFIG: Record<Provider, { envKey: string; defaultModel: string }> = {
  mistral: { envKey: "MISTRAL_API_KEY", defaultModel: "mistral-large-latest" },
  anthropic: { envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-4-20250514" },
  openai: { envKey: "OPENAI_API_KEY", defaultModel: "gpt-4o" },
};

export function getLanguageModel(): LanguageModel {
  const provider = (process.env.LLM_PROVIDER || "mistral") as Provider;
  const config = PROVIDER_CONFIG[provider];

  if (!config) {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}. Use "mistral", "anthropic", or "openai".`);
  }

  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    throw new Error(`Missing ${config.envKey} environment variable for provider "${provider}".`);
  }

  switch (provider) {
    case "mistral":
      return createMistral({ apiKey })(config.defaultModel);
    case "anthropic":
      return createAnthropic({ apiKey })(config.defaultModel);
    case "openai":
      return createOpenAI({ apiKey })(config.defaultModel);
  }
}
