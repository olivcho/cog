import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const PREFIX = "scrypt";

// Precomputed dummy hash used when a user is not found to reduce timing differences.
const DUMMY_SALT = "00000000000000000000000000000000";

export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error("Password must not be empty");
  }
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${PREFIX}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex || expectedHex.length !== KEY_LENGTH * 2) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== KEY_LENGTH) {
    return false;
  }
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(derived, expected);
}

export async function consumeDummyPasswordWork(password: string): Promise<void> {
  await scrypt(password || "dummy", DUMMY_SALT, KEY_LENGTH);
}
