// Turns a step's final output into a list of captions.
export function parseCaptions(output: string, asArray: boolean): string[] {
  const text = output.trim();
  if (!text) return [];
  const clean = (s: string) =>
    s
      .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
      .replace(/^["“]|["”]$/g, "")
      .trim();

  if (asArray || text.startsWith("[")) {
    const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      const parsed: unknown = JSON.parse(unfenced);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => (typeof v === "string" ? v : JSON.stringify(v)).trim())
          .filter(Boolean)
          .slice(0, 20);
      }
    } catch {
      // not valid JSON: fall back to one caption per line
    }
    return text
      .split("\n")
      .map(clean)
      .filter((l) => l && !/^[[\]]$/.test(l))
      .slice(0, 20);
  }

  const single = clean(text);
  return single ? [single] : [];
}
