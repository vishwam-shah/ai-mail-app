import MailComposer from "nodemailer/lib/mail-composer";

export interface ComposeInput {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}

// Header values are user/assistant-controlled input; strip CR/LF so nothing
// can inject extra headers (e.g. a hidden Bcc) via a crafted To/Subject value.
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

export async function buildRawMessage(input: ComposeInput): Promise<string> {
  const composer = new MailComposer({
    from: sanitizeHeaderValue(input.from),
    to: sanitizeHeaderValue(input.to),
    subject: sanitizeHeaderValue(input.subject),
    text: input.body,
    inReplyTo: input.inReplyTo ? sanitizeHeaderValue(input.inReplyTo) : undefined,
    references: input.references ? sanitizeHeaderValue(input.references) : undefined,
  });

  const message = await new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((err, msg) => {
      if (err) reject(err);
      else resolve(msg);
    });
  });

  return message.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
