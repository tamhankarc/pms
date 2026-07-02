export type TranslationRequest = {
  englishText: string;
  countryCode: string;
  countryName: string;
};

export type TranslationResult = {
  text: string;
  provider: string;
  fallback: boolean;
};

export interface CopyDeckTranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

class EnglishFallbackProvider implements CopyDeckTranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      text: request.englishText,
      provider: "English fallback (no translation provider configured)",
      fallback: true,
    };
  }
}

class HttpTranslationProvider implements CopyDeckTranslationProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey?: string,
  ) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(request),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Translation provider returned HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as { translation?: unknown };
    if (typeof payload.translation !== "string" || !payload.translation.trim()) {
      throw new Error("Translation provider returned an empty translation.");
    }
    return {
      text: payload.translation.trim(),
      provider: "Configured HTTP provider",
      fallback: false,
    };
  }
}

export function getCopyDeckTranslationProvider(): CopyDeckTranslationProvider {
  const endpoint = process.env.COPY_DECK_TRANSLATION_PROVIDER_URL?.trim();
  if (!endpoint) return new EnglishFallbackProvider();
  return new HttpTranslationProvider(
    endpoint,
    process.env.COPY_DECK_TRANSLATION_PROVIDER_API_KEY?.trim(),
  );
}
