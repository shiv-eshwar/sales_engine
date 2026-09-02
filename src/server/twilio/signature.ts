import { createHmac, timingSafeEqual } from "node:crypto";

export function expectedTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
}

export function verifyTwilioSignature(
  authToken: string,
  signature: string | undefined,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature || !authToken) {
    return false;
  }
  const expected = expectedTwilioSignature(authToken, url, params);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function formParams(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") {
    return {};
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === "string") {
      params[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      params[key] = String(value);
    }
  }
  return params;
}
