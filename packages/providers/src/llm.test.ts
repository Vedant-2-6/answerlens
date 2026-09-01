import { describe, it, expect } from "vitest";
import { sanitizeEnvValue } from "./llm";

describe("sanitizeEnvValue", () => {
  it("removes BOM and whitespace", () => {
    expect(sanitizeEnvValue("\uFEFFhttps://example.com")).toBe("https://example.com");
    expect(sanitizeEnvValue("  \uFEFFsecret-key  ")).toBe("secret-key");
    expect(sanitizeEnvValue(undefined)).toBeUndefined();
  });
});
