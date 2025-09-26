export function enrichPrompt(raw: string): string {
  const guardrails = [
    "• Avoid hardcoded secrets; use environment variables (e.g., process.env).",
    "• Validate inputs (length/type/regex) and sanitize outputs.",
    "• Apply authorization checks on sensitive routes/controllers.",
    "• Prefer parameterized queries; avoid string concatenation for SQL.",
    "• Log security-relevant events (auth failures, privilege escalations).",
    "• Keep dependencies updated; pin versions and audit regularly."
  ];
  const header = "\n\n🔒 Security Addendum:\n" + guardrails.map(g => "- " + g).join("\n");
  return raw + header;
}
