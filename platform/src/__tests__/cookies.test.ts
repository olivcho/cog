import { describe, expect, it } from "vitest";
import { readCookie } from "../http/cookies";

describe("readCookie", () => {
  it("reads and decodes a named cookie", () => {
    expect(readCookie("a=1; session=x%20y", "session")).toBe("x y");
  });

  it("treats malformed percent-encoding as absent", () => {
    expect(readCookie("session=%E0%A4%A", "session")).toBeUndefined();
  });
});
