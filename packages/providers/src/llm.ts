export async function callLLMJSON(
  payloadBase: any,
  credentials: { key: string; model: string; baseUrl: string }[]
): Promise<{ parsed: any; raw: string }> {
  let credIdx = 0;
  let attempt = 0;
  
  while (credIdx < credentials.length) {
    const cred = credentials[credIdx]!;
    const payload = {
      ...payloadBase,
      model: cred.model
    };
    
    try {
      const response = await fetch(`${cred.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cred.key}`
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        let parsed = null;
        if (payloadBase.response_format?.type === "json_object") {
          const cleaned = content.replace(/^```json\n?/i, "").replace(/```$/i, "").trim();
          parsed = JSON.parse(cleaned);
        }
        return { parsed, raw: content };
      }
      
      if (response.status === 429) {
        attempt++;
        if (attempt <= 3) {
          let waitTimeMs = Math.min(attempt * 10000, 60000);
          const errText = await response.clone().text().catch(() => "");
          const match = errText.match(/retry in ([\d\.]+)s/i);
          if (match && match[1]) {
            waitTimeMs = (parseFloat(match[1]) * 1000) + 2000;
          }
          console.log(`[Rate Limit] Waiting ${Math.round(waitTimeMs/1000)}s before attempt ${attempt}...`);
          await new Promise(r => setTimeout(r, waitTimeMs));
          continue;
        } else {
          console.log(`[Rate Limit] 429 ceiling reached for model ${cred.model}. Falling back to next credential.`);
          credIdx++;
          attempt = 0;
          continue;
        }
      }
      
      throw new Error(`LLM call error ${response.status}: ${await response.text()}`);
    } catch (err: any) {
      if (credIdx >= credentials.length - 1) {
        throw err;
      }
      console.log(`[LLM Error] Error: ${err.message}. Falling back to next credential.`);
      credIdx++;
      attempt = 0;
    }
  }
  
  throw new Error("All credentials exhausted without success.");
}

export function sanitizeEnvValue(v: string | undefined): string | undefined {
  if (v == null) return v;
  return v.replace(/^\uFEFF/, "").trim();
}

export function getLLMCredentials() {
  const baseUrl = sanitizeEnvValue(process.env.AI_BASE_URL);
  const key = sanitizeEnvValue(process.env.AI_API_KEY);
  const model = sanitizeEnvValue(process.env.AI_MODEL);

  if (!baseUrl || !key || !model) {
    throw new Error("Missing primary OmniRoute credentials (AI_BASE_URL, AI_API_KEY, AI_MODEL)");
  }

  const key2 = sanitizeEnvValue(process.env.AI_API_KEY_2) || key;
  const model2 = sanitizeEnvValue(process.env.AI_MODEL_FALLBACK) || model;

  return [
    { key, model, baseUrl },
    { key: key2, model: model2, baseUrl }
  ];
}
