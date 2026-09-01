import * as math from "mathjs";

export function checkNumericEquivalence(a: string, b: string): boolean | "not-comparable" {
  try {
    const valA = math.evaluate(a);
    const valB = math.evaluate(b);
    if (typeof valA === "number" && typeof valB === "number") {
      return Math.abs(valA - valB) < 1e-9;
    }
    if (math.equal(valA, valB)) {
      return true;
    }
    return false;
  } catch {
    return "not-comparable";
  }
}

export function checkSymbolicEquivalence(
  exprA: string,
  exprB: string,
  variables: string[] = ["x", "y", "z"]
): boolean | "not-comparable" {
  try {
    const nodeA = math.parse(exprA);
    const nodeB = math.parse(exprB);
    
    for (let trial = 0; trial < 5; trial++) {
      const scope: any = {};
      for (const v of variables) {
        scope[v] = Math.random() * 10 + 1;
      }
      
      const resA = nodeA.evaluate(scope);
      const resB = nodeB.evaluate(scope);
      
      if (typeof resA !== "number" || typeof resB !== "number" || isNaN(resA) || isNaN(resB)) {
        return "not-comparable";
      }
      
      if (Math.abs(resA - resB) > 1e-9) {
        return false;
      }
    }
    return true;
  } catch {
    return "not-comparable";
  }
}

export function mathEquivalenceCheck(expected: string, student: string): boolean | "not-comparable" {
  const cleanExp = expected.trim().replace(/^=/, "").trim();
  const cleanStud = student.trim().replace(/^=/, "").trim();
  
  if (!cleanExp || !cleanStud) return "not-comparable";

  const numResult = checkNumericEquivalence(cleanExp, cleanStud);
  if (numResult !== "not-comparable") {
    return numResult;
  }

  const variables = Array.from(new Set([...cleanExp.matchAll(/[a-zA-Z]/g), ...cleanStud.matchAll(/[a-zA-Z]/g)].map(m => m[0])));
  const mathFunctions = ["sin", "cos", "tan", "log", "exp", "sqrt", "abs", "pi", "e"];
  const cleanVars = variables.filter(v => !mathFunctions.includes(v.toLowerCase()));

  const symResult = checkSymbolicEquivalence(cleanExp, cleanStud, cleanVars);
  return symResult;
}

export function extractExpectedAnswer(text: string): string | null {
  const quoted = text.match(/[`"']([^`"']+)[`"']/);
  if (quoted && quoted[1]) return quoted[1];

  const eq = text.match(/([a-zA-Z]\s*=\s*[a-zA-Z0-9\+\-\*\/\^\(\)\s]+)/);
  if (eq && eq[1]) return eq[1];

  const num = text.match(/(-?\d+(?:\.\d+)?(?:\/\d+)?)/);
  if (num && num[0]) return num[0];

  return null;
}
