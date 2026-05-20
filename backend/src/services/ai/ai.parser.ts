import { AIResponse } from '../../shared/types';

function repairTruncatedJSON(raw: string): string | null {
  let s = raw.trim();

  // Find the last complete key-value pair by scanning for the last
  // unescaped quote that is followed by a comma, closing brace/bracket, or whitespace+} ]
  // Strategy: walk backwards and try progressively shorter prefixes
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i];
    if (ch === '}' || ch === ']') {
      // Try closing from this position
      const candidate = s.substring(0, i + 1);
      // Count open vs close braces/brackets
      let braces = 0;
      let brackets = 0;
      let inStr = false;
      let escaped = false;
      for (const c of candidate) {
        if (escaped) { escaped = false; continue; }
        if (c === '\\') { escaped = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '{') braces++;
        else if (c === '}') braces--;
        else if (c === '[') brackets++;
        else if (c === ']') brackets--;
      }
      // Close any open arrays then objects
      let repaired = candidate;
      while (brackets > 0) { repaired += ']'; brackets--; }
      while (braces > 0) { repaired += '}'; braces--; }
      try {
        JSON.parse(repaired);
        return repaired;
      } catch {
        continue;
      }
    }
  }

  // Fallback: strip trailing incomplete string and close structure
  // Find last unescaped quote that starts an incomplete value
  const lastQuote = s.lastIndexOf('"');
  if (lastQuote > 0) {
    // Check if this quote is a key or value start — remove it and everything after
    const before = s.substring(0, lastQuote).trimEnd();
    // If before ends with : or , this quote starts a value we need to remove
    if (before.endsWith(':') || before.endsWith(',')) {
      let repaired = before.endsWith(',') ? before.substring(0, before.length - 1) : before;
      let braces = 0;
      let brackets = 0;
      let inStr = false;
      let escaped = false;
      for (const c of repaired) {
        if (escaped) { escaped = false; continue; }
        if (c === '\\') { escaped = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '{') braces++;
        else if (c === '}') braces--;
        else if (c === '[') brackets++;
        else if (c === ']') brackets--;
      }
      while (brackets > 0) { repaired += ']'; brackets--; }
      while (braces > 0) { repaired += '}'; braces--; }
      try {
        JSON.parse(repaired);
        return repaired;
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function parseAIResponse(raw: string): AIResponse | null {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(raw);
    // AI explicitly says to ignore this message (greetings, menu, etc.)
    if (parsed.ignore === true) return { intent: 'ignore', message: '', products: [] } as any;
    if (parsed.intent && parsed.message) return parsed as AIResponse;
  } catch {
    // Try repair for truncated responses
    const repaired = repairTruncatedJSON(raw);
    if (repaired) {
      try {
        const parsed = JSON.parse(repaired);
        if (parsed.ignore === true) return { intent: 'ignore', message: '', products: [] } as any;
        if (parsed.intent && parsed.message) return parsed as AIResponse;
      } catch { /* repair failed, fall through */ }
    }
  }

  // Try to extract JSON from markdown code block
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim()) as AIResponse;
    } catch { /* fall through */ }
  }

  // Try to find JSON object in text
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as AIResponse;
    } catch {
      // Try repair on extracted JSON
      const repaired = repairTruncatedJSON(objectMatch[0]);
      if (repaired) {
        try {
          return JSON.parse(repaired) as AIResponse;
        } catch { /* fall through */ }
      }
    }
  }

  return null;
}
