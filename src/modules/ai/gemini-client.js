function requireEnv(env, key) {
  const value = env?.[key];
  if (!value) {
    throw new Error(`${key} belum diset.`);
  }
  return value;
}

export async function callGemini(env, prompt) {
  const apiKey = requireEnv(env, 'GEMINI_API_KEY');
  const model = requireEnv(env, 'GEMINI_MODEL');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request gagal: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') || 'Tidak ada hasil analisa.';
}
