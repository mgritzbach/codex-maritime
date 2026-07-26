const CODE = "[23456789A-HJKMNP-TV-Z]{3,6}";

export function parseInboundCommand(input) {
  const text = String(input ?? "").trim();
  if (!text) return { type: "unknown", raw: text };
  const approval = text.match(new RegExp(`^(Y|YES|N|NO)(?:\\s+(${CODE}(?:-A\\d+)?))?$`, "i"));
  if (approval) return { type: "approval", decision: /^y/i.test(approval[1]) ? "accept" : "decline", reference: approval[2]?.toUpperCase() ?? null };
  const prefixed = text.match(new RegExp(`^(${CODE})\\s+\\/(c|s):\\s*(.+)$`, "i"));
  if (prefixed) return { type: prefixed[2].toLowerCase() === "s" ? "steer" : "command", code: prefixed[1].toUpperCase(), text: prefixed[3].trim() };
  const direct = text.match(new RegExp(`^\\/(c|s)(?:\\s+(${CODE}))?:\\s*(.+)$`, "i"));
  if (direct) return { type: direct[1].toLowerCase() === "s" ? "steer" : "command", code: direct[2]?.toUpperCase() ?? null, text: direct[3].trim() };
  const action = text.match(new RegExp(`^\\/(status|pause|resume|stop)(?:\\s+(${CODE}))?$`, "i"));
  if (action) return { type: action[1].toLowerCase(), code: action[2]?.toUpperCase() ?? null };
  const quiet = text.match(/^\/settings\s+quiet\s+(off|on|(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d)$/i);
  if (quiet) {
    const value = quiet[1].toLowerCase();
    if (value === "off" || value === "on") return { type: "settings", key: "quiet", enabled: value === "on" };
    const [start, end] = value.split("-");
    return { type: "settings", key: "quiet", enabled: true, start, end };
  }
  const cadence = text.match(/^\/settings\s+(cadence|first)\s+(\d+)(m|h)$/i);
  if (cadence) return { type: "settings", key: cadence[1].toLowerCase(), minutes: Number(cadence[2]) * (cadence[3].toLowerCase() === "h" ? 60 : 1) };
  return { type: "unknown", raw: text };
}