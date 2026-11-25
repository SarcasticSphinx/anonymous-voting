import "server-only";
import { randomInt } from "node:crypto";
import { CODE_LENGTH } from "./format";

// No 0/O, 1/I/L so codes are easy to read off a paper slip.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode() {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function newPollId() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[randomInt(chars.length)];
  return out;
}
