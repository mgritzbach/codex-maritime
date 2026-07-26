import { isE164 } from "./channel.mjs";

export function diagnoseEnvironment(env = process.env) {
  const provider = (env.CODEX_MARITIME_CHANNEL ?? "console").toLowerCase();
  const errors = [];
  const warnings = [];

  required(errors, env, "CODEX_MARITIME_TOKEN");
  if (provider === "sendblue") {
    requiredValue(errors, env.SENDBLUE_API_KEY_ID ?? env.SENDBLUE_API_API_KEY, "SENDBLUE_API_KEY_ID");
    requiredValue(errors, env.SENDBLUE_API_SECRET_KEY ?? env.SENDBLUE_API_API_SECRET, "SENDBLUE_API_SECRET_KEY");
    for (const name of ["SENDBLUE_FROM_NUMBER", "SENDBLUE_RECIPIENT"]) {
      required(errors, env, name);
      if (env[name] && !isE164(env[name])) errors.push(`${name} must use E.164 format, such as +15551234567`);
    }
    required(errors, env, "SENDBLUE_WEBHOOK_SECRET");
    const allowed = allowedSendersFromEnv(env, provider);
    if (!allowed.length) errors.push("Set CODEX_MARITIME_ALLOWED_SENDERS (or SENDBLUE_ALLOWED_SENDERS) to authorize inbound texts");
    for (const sender of allowed) {
      if (!isE164(sender)) errors.push(`Allowlisted sender must use E.164 format: ${sender}`);
    }
    if (!env.CODEX_MARITIME_PUBLIC_URL) {
      warnings.push("Set CODEX_MARITIME_PUBLIC_URL to show the exact Sendblue webhook URL");
    } else if (!/^https:\/\//i.test(env.CODEX_MARITIME_PUBLIC_URL)) {
      errors.push("CODEX_MARITIME_PUBLIC_URL must be an HTTPS URL");
    }
  } else if (!["console", "inkbox", "webhook"].includes(provider)) {
    errors.push(`Unsupported CODEX_MARITIME_CHANNEL: ${provider}`);
  }

  return {
    ok: errors.length === 0,
    provider,
    webhookUrl: env.CODEX_MARITIME_PUBLIC_URL && provider === "sendblue"
      ? `${env.CODEX_MARITIME_PUBLIC_URL.replace(/\/$/, "")}/webhooks/sendblue`
      : null,
    errors,
    warnings
  };
}

export function allowedSendersFromEnv(env = process.env, provider = (env.CODEX_MARITIME_CHANNEL ?? "console").toLowerCase()) {
  const raw = env.CODEX_MARITIME_ALLOWED_SENDERS
    ?? (provider === "sendblue" ? env.SENDBLUE_ALLOWED_SENDERS : undefined)
    ?? (provider === "inkbox" ? env.INKBOX_ALLOWED_SENDERS : undefined)
    ?? "";
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}

function required(errors, env, name) {
  requiredValue(errors, env[name], name);
}

function requiredValue(errors, value, name) {
  if (!value) errors.push(`${name} is required`);
}
