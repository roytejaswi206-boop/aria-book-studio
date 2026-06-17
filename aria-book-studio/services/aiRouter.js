const crypto = require("crypto");

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-sonnet-4-5";

const AI_PROVIDER_CATALOG = {
  anthropic: {
    label: "Anthropic",
    defaultModel: DEFAULT_MODEL,
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", speed: "Fast", power: "Powerful", cost: "Medium", recommended: true },
      { id: "claude-opus-4-5", label: "Claude Opus 4.5", speed: "Slow", power: "Most powerful", cost: "High" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", speed: "Fastest", power: "Lightweight", cost: "Low" }
    ]
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o",
    envKey: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4o", label: "GPT-4o", speed: "Fast", power: "Powerful", cost: "Medium" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", speed: "Fastest", power: "Good", cost: "Low" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", speed: "Measured", power: "Deep reasoning", cost: "High" }
    ]
  },
  google: {
    label: "Google",
    defaultModel: "gemini-1.5-pro",
    envKey: "GOOGLE_API_KEY",
    models: [
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", speed: "Fast", power: "Long context", cost: "Medium" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", speed: "Fastest", power: "Good", cost: "Low" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", speed: "Fastest", power: "Latest fast", cost: "Low" }
    ]
  },
  groq: {
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", speed: "Ultra fast", power: "Open model", cost: "Low" },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B 32768", speed: "Ultra fast", power: "Large context", cost: "Low" }
    ]
  },
  mistral: {
    label: "Mistral",
    defaultModel: "mistral-large-latest",
    envKey: "MISTRAL_API_KEY",
    models: [
      { id: "mistral-large-latest", label: "Mistral Large", speed: "Fast", power: "Powerful", cost: "Medium" },
      { id: "mistral-small-latest", label: "Mistral Small", speed: "Fastest", power: "Good", cost: "Low" }
    ]
  },
  ollama: {
    label: "Ollama",
    defaultModel: "llama3:8b",
    envKey: "OLLAMA_BASE_URL",
    models: [
      { id: "llama3:8b", label: "Llama 3 8B", speed: "Local", power: "Good", cost: "Local" },
      { id: "mistral:7b", label: "Mistral 7B", speed: "Local", power: "Good", cost: "Local" },
      { id: "phi3:medium", label: "Phi-3 Medium", speed: "Local", power: "Compact", cost: "Local" }
    ]
  }
};

function publicCatalog() {
  return {
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
    providers: AI_PROVIDER_CATALOG
  };
}

function normalizeProvider(provider) {
  const value = String(provider || DEFAULT_PROVIDER).trim().toLowerCase();
  return AI_PROVIDER_CATALOG[value] ? value : DEFAULT_PROVIDER;
}

function validateProviderModel(provider, model) {
  const normalizedProvider = normalizeProvider(provider);
  const catalog = AI_PROVIDER_CATALOG[normalizedProvider];
  const requestedModel = String(model || catalog.defaultModel || DEFAULT_MODEL).trim();
  const hasModel = catalog.models.some(item => item.id === requestedModel);
  return {
    provider: normalizedProvider,
    model: hasModel ? requestedModel : catalog.defaultModel,
    valid: hasModel,
    catalog
  };
}

function encryptionKey() {
  const secret = process.env.ARIA_SETTINGS_SECRET || "aria-local-settings-secret";
  return crypto.scryptSync(secret, "aria-ai-settings", 32);
}

function sealApiKey(apiKey) {
  const value = String(apiKey || "").trim();
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    value: encrypted.toString("base64"),
    updatedAt: new Date().toISOString()
  };
}

function openApiKey(sealed) {
  if (!sealed?.iv || !sealed?.tag || !sealed?.value) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(sealed.iv, "base64"));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(sealed.value, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return "";
  }
}

function ensureProfileAi(profile) {
  if (!profile.ai || typeof profile.ai !== "object") profile.ai = {};
  const normalized = validateProviderModel(profile.ai.provider, profile.ai.model);
  profile.ai.provider = normalized.provider;
  profile.ai.model = normalized.model;
  if (!profile.ai.encryptedApiKeys || typeof profile.ai.encryptedApiKeys !== "object") {
    profile.ai.encryptedApiKeys = {};
  }
  if (!profile.preferredLanguage) profile.preferredLanguage = "en";
  return profile;
}

function hasStoredApiKey(profile, provider) {
  ensureProfileAi(profile);
  return Boolean(profile.ai.encryptedApiKeys?.[provider]?.value || process.env[AI_PROVIDER_CATALOG[provider]?.envKey || ""]);
}

function sanitizeProfile(profile) {
  const source = ensureProfileAi({ ...(profile || {}) });
  const apiKeyStatus = Object.keys(AI_PROVIDER_CATALOG).reduce((acc, provider) => {
    acc[provider] = hasStoredApiKey(source, provider);
    return acc;
  }, {});
  return {
    ...source,
    ai: {
      provider: source.ai.provider,
      model: source.ai.model,
      apiKeyStatus,
      hasApiKey: apiKeyStatus[source.ai.provider],
      lastTest: source.ai.lastTest || null
    }
  };
}

function updateProfileAiSettings(profile, body = {}) {
  ensureProfileAi(profile);
  const selected = validateProviderModel(body.provider, body.model);
  profile.ai.provider = selected.provider;
  profile.ai.model = selected.model;
  if (typeof body.preferredLanguage === "string" && body.preferredLanguage.trim()) {
    profile.preferredLanguage = body.preferredLanguage.trim();
  }
  if (typeof body.authorName === "string") profile.authorName = body.authorName.trim();
  if (typeof body.fullName === "string") profile.fullName = body.fullName.trim();
  if (typeof body.bio === "string") profile.bio = body.bio.trim();
  if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    profile.ai.encryptedApiKeys[selected.provider] = sealApiKey(body.apiKey);
  }
  profile.ai.updatedAt = new Date().toISOString();
  return sanitizeProfile(profile);
}

function resolveApiKey(profile, provider, transientApiKey = "") {
  const value = String(transientApiKey || "").trim();
  if (value) return value;
  ensureProfileAi(profile);
  const sealed = profile.ai.encryptedApiKeys?.[provider];
  const opened = openApiKey(sealed);
  if (opened) return opened;
  const envKey = AI_PROVIDER_CATALOG[provider]?.envKey;
  return envKey ? (process.env[envKey] || "") : "";
}

function resolveEffectiveAiSettings(profile, book = {}, overrides = {}) {
  ensureProfileAi(profile);
  const selected = validateProviderModel(
    overrides.provider || book.aiProviderOverride || profile.ai.provider,
    overrides.model || book.aiModelOverride || profile.ai.model
  );
  return {
    provider: selected.provider,
    model: selected.model,
    providerLabel: selected.catalog.label,
    modelLabel: selected.catalog.models.find(item => item.id === selected.model)?.label || selected.model,
    hasApiKey: selected.provider === "ollama" || Boolean(resolveApiKey(profile, selected.provider, overrides.apiKey))
  };
}

async function testAiConnection({ profile, provider, model, apiKey, dryRun = false }) {
  const selected = validateProviderModel(provider, model);
  if (!selected.valid) {
    return {
      ok: false,
      provider: selected.provider,
      model: selected.model,
      message: `Model is not available for ${selected.catalog.label}.`
    };
  }

  const key = resolveApiKey(profile, selected.provider, apiKey);
  if (selected.provider !== "ollama" && !key) {
    return {
      ok: false,
      provider: selected.provider,
      model: selected.model,
      message: `${selected.catalog.label} API key is required.`
    };
  }

  if (dryRun) {
    return {
      ok: true,
      provider: selected.provider,
      model: selected.model,
      mode: "configuration",
      message: `${selected.catalog.label} ${selected.model} is configured.`
    };
  }

  return providerNetworkProbe(selected.provider, selected.model, key);
}

async function providerNetworkProbe(provider, model, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    let url = "";
    const init = { method: "GET", headers: {}, signal: controller.signal };
    if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/models";
      init.headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
    } else if (provider === "openai") {
      url = `https://api.openai.com/v1/models/${encodeURIComponent(model)}`;
      init.headers = { Authorization: `Bearer ${apiKey}` };
    } else if (provider === "google") {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}?key=${encodeURIComponent(apiKey)}`;
    } else if (provider === "groq") {
      url = "https://api.groq.com/openai/v1/models";
      init.headers = { Authorization: `Bearer ${apiKey}` };
    } else if (provider === "mistral") {
      url = "https://api.mistral.ai/v1/models";
      init.headers = { Authorization: `Bearer ${apiKey}` };
    } else if (provider === "ollama") {
      url = `${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/api/show`;
      init.method = "POST";
      init.body = JSON.stringify({ name: model });
      init.headers = { "Content-Type": "application/json" };
    }
    const res = await fetch(url, init);
    const ok = res.ok;
    return {
      ok,
      provider,
      model,
      status: res.status,
      mode: "network",
      message: ok ? `${AI_PROVIDER_CATALOG[provider].label} connection verified.` : `Provider returned HTTP ${res.status}.`
    };
  } catch (err) {
    return {
      ok: false,
      provider,
      model,
      mode: "network",
      message: err.name === "AbortError" ? "Connection test timed out." : err.message
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  AI_PROVIDER_CATALOG,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  ensureProfileAi,
  publicCatalog,
  resolveEffectiveAiSettings,
  sanitizeProfile,
  testAiConnection,
  updateProfileAiSettings,
  validateProviderModel
};
