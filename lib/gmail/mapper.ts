import type { gmail_v1 } from "googleapis";

export interface EmailSummary {
  id: string;
  threadId: string;
  from: string;
  fromName: string | null;
  to: string[];
  subject: string;
  snippet: string;
  date: string; // ISO 8601
  isUnread: boolean;
  labelIds: string[];
}

export interface EmailDetailData extends EmailSummary {
  cc: string[];
  bodyText: string | null;
  bodyHtml: string | null;
}

const HTML_NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  hellip: "…",
  mdash: "—",
  ndash: "–",
};

// Gmail's snippet/subject fields sometimes carry raw HTML entities (e.g.
// "&#39;" or "&quot;") when the source content was HTML. Decode them so
// quotes/apostrophes render as actual characters instead of literal markup.
function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const codePoint = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return HTML_NAMED_ENTITIES[entity] ?? match;
  });
}

// Subject/From headers can use RFC 2047 encoded-word syntax
// (=?UTF-8?Q?...?= or =?UTF-8?B?...?=) for non-ASCII text, which otherwise
// shows up as garbled characters — smart quotes included.
function decodeMimeHeader(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_match, charset: string, encoding: string, text: string) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return Buffer.from(text, "base64").toString(charset.toLowerCase() as BufferEncoding);
        }
        const bytes = text
          .replace(/_/g, " ")
          .replace(/=([0-9a-fA-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return Buffer.from(bytes, "binary").toString(charset.toLowerCase() as BufferEncoding);
      } catch {
        return text;
      }
    }
  );
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  const raw = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
  return decodeHtmlEntities(decodeMimeHeader(raw));
}

function splitAddressList(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseFromHeader(value: string): { email: string; name: string | null } {
  const match = value.match(/^(.*?)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { email: match[2].trim(), name: name || null };
  }
  return { email: value.trim(), name: null };
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64").toString("utf8");
}

// Walks a (possibly multipart) message payload and collects the first
// text/plain and text/html bodies, skipping attachment parts.
function extractBodies(part: gmail_v1.Schema$MessagePart | undefined): {
  text: string | null;
  html: string | null;
} {
  let text: string | null = null;
  let html: string | null = null;

  function walk(p: gmail_v1.Schema$MessagePart | undefined) {
    if (!p) return;
    const isAttachment = Boolean(p.filename && p.filename.length > 0);
    if (!isAttachment && p.mimeType === "text/plain" && p.body?.data && text === null) {
      text = decodeBase64Url(p.body.data);
    } else if (!isAttachment && p.mimeType === "text/html" && p.body?.data && html === null) {
      html = decodeBase64Url(p.body.data);
    }
    for (const child of p.parts ?? []) walk(child);
  }

  walk(part);
  return { text, html };
}

export function mapMessageToSummary(message: gmail_v1.Schema$Message): EmailSummary {
  const headers = message.payload?.headers;
  const fromHeader = getHeader(headers, "From");
  const { email: from, name: fromName } = parseFromHeader(fromHeader);
  const labelIds = message.labelIds ?? [];

  return {
    id: message.id!,
    threadId: message.threadId!,
    from,
    fromName,
    to: splitAddressList(getHeader(headers, "To")),
    subject: getHeader(headers, "Subject") || "(no subject)",
    snippet: decodeHtmlEntities(message.snippet ?? ""),
    date: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : new Date().toISOString(),
    isUnread: labelIds.includes("UNREAD"),
    labelIds,
  };
}

export function mapMessageToDetail(message: gmail_v1.Schema$Message): EmailDetailData {
  const summary = mapMessageToSummary(message);
  const headers = message.payload?.headers;
  const { text, html } = extractBodies(message.payload);

  return {
    ...summary,
    cc: splitAddressList(getHeader(headers, "Cc")),
    bodyText: text,
    bodyHtml: html,
  };
}
