import { describe, it, expect } from "vitest";
import { checkNumericEquivalence, checkSymbolicEquivalence, mathEquivalenceCheck } from "./math-verify";

describe("math-verify", () => {
  it("numeric equivalence check", () => {
    expect(checkNumericEquivalence("3/4", "0.75")).toBe(true);
    expect(checkNumericEquivalence("1/2 + 1/4", "0.75")).toBe(true);
    expect(checkNumericEquivalence("3/4", "0.8")).toBe(false);
    expect(checkNumericEquivalence("hello", "0.75")).toBe("not-comparable");
  });

  it("symbolic equivalence check", () => {
    expect(checkSymbolicEquivalence("x^2 + 2*x + 1", "(x+1)^2", ["x"])).toBe(true);
    expect(checkSymbolicEquivalence("x^2 + 2*x", "(x+1)^2", ["x"])).toBe(false);
    expect(checkSymbolicEquivalence("hello", "x", ["x"])).toBe("not-comparable");
  });

  it("unified math equivalence check", () => {
    expect(mathEquivalenceCheck("3/4", "0.75")).toBe(true);
    expect(mathEquivalenceCheck("x^2 + 2*x + 1", "(x+1)^2")).toBe(true);
    expect(mathEquivalenceCheck("some sentence description", "0.75")).toBe("not-comparable");
    expect(mathEquivalenceCheck("3/4", "another description")).toBe("not-comparable");
  });
});
