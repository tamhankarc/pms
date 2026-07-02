export type TranslationRequest = {
  englishText: string;
  marketCode: string;
  marketName: string;
  language?: string | null;
  countryCode?: string;
  countryName?: string;
};

export type TranslationResult = {
  text: string;
  provider: string;
  fallback: boolean;
};

export interface CopyDeckTranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
  translateMany?(requests: TranslationRequest[]): Promise<TranslationResult[]>;
}

const MARKET_LANGUAGE_CODES: Record<string, string> = {
  AUSTRALIA: "en",
  INDIA_ENGLISH: "en",
  INDONESIA: "id",
  SINGAPORE_ENGLISH: "en",
  TAIWAN: "zh-TW",
  MEXICO: "es",
  BELGIUM_FRENCH: "fr",
  BELGIUM_FLEMISH: "nl",
  SPAIN: "es",
  UK: "en",
  KOREA: "ko",
  NETHERLANDS: "nl",
  FRANCE: "fr",
  CANADA_ENGLISH: "en",
  CANADA_FRENCH: "fr",
  JAPAN: "ja",
  NEW_ZEALAND: "en",
  GERMANY: "de",
  BRAZIL: "pt",
  ITALY: "it",
  MALAYSIA: "ms",
};

function targetLanguage(request: TranslationRequest) {
  const configuredLanguage = request.language?.trim().toLowerCase();
  if (configuredLanguage && /^[a-z]{2,3}(-[a-z]{2})?$/i.test(configuredLanguage)) {
    return configuredLanguage;
  }
  return MARKET_LANGUAGE_CODES[request.marketCode];
}

function decodeGoogleText(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
  };
  return value.replace(
    /&(#x?[0-9a-f]+|amp|apos|quot|lt|gt);/gi,
    (_match, entity: string) => {
      if (entity.startsWith("#x"))
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#"))
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return named[entity.toLowerCase()] ?? _match;
    },
  );
}

class EnglishFallbackProvider implements CopyDeckTranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      text: request.englishText,
      provider: "English fallback (no translation provider configured)",
      fallback: true,
    };
  }

  async translateMany(requests: TranslationRequest[]) {
    return Promise.all(requests.map((request) => this.translate(request)));
  }
}

class GoogleCloudTranslationProvider
  implements CopyDeckTranslationProvider
{
  constructor(private readonly apiKey: string) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return (await this.translateMany([request]))[0];
  }

  async translateMany(
    requests: TranslationRequest[],
  ): Promise<TranslationResult[]> {
    if (!requests.length) return [];
    const target = targetLanguage(requests[0]);
    if (
      requests.some(
        (request) => targetLanguage(request) !== target,
      )
    ) {
      throw new Error("A Google translation batch must use one target language.");
    }
    if (!target) {
      return requests.map((request) => ({
        text: request.englishText,
        provider: `English fallback (no target language mapping for ${request.marketCode})`,
        fallback: true,
      }));
    }
    if (target === "en") {
      return requests.map((request) => ({
        text: request.englishText,
        provider: "English target market",
        fallback: false,
      }));
    }
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: requests.map((request) => request.englishText),
          source: "en",
          target,
          format: "text",
        }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Google Translation returned HTTP ${response.status}: ${detail.slice(0, 300)}`,
      );
    }
    const payload = (await response.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };
    const translations = payload.data?.translations;
    if (!translations || translations.length !== requests.length)
      throw new Error("Google Translation returned an incomplete translation batch.");
    return translations.map((translation) => {
      if (!translation.translatedText?.trim())
        throw new Error("Google Translation returned an empty translation.");
      return {
        text: decodeGoogleText(translation.translatedText.trim()),
        provider: "Google Cloud Translation Basic",
        fallback: false,
      };
    });
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
  const googleApiKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (googleApiKey) return new GoogleCloudTranslationProvider(googleApiKey);
  const endpoint = process.env.COPY_DECK_TRANSLATION_PROVIDER_URL?.trim();
  if (!endpoint) return new EnglishFallbackProvider();
  return new HttpTranslationProvider(
    endpoint,
    process.env.COPY_DECK_TRANSLATION_PROVIDER_API_KEY?.trim(),
  );
}

export function getCopyDeckTranslationStatus() {
  if (process.env.GOOGLE_TRANSLATE_API_KEY?.trim()) {
    return {
      configured: true,
      label: "Google Cloud Translation Basic is configured.",
    };
  }
  if (process.env.COPY_DECK_TRANSLATION_PROVIDER_URL?.trim()) {
    return {
      configured: true,
      label: "A custom HTTP translation provider is configured.",
    };
  }
  return {
    configured: false,
    label:
      "No translation provider is configured. Missing translations will use English fallback text.",
  };
}

function translationBatches(requests: TranslationRequest[]) {
  const batches: TranslationRequest[][] = [];
  let batch: TranslationRequest[] = [];
  let characters = 0;
  for (const request of requests) {
    if (
      batch.length >= 100 ||
      (batch.length > 0 && characters + request.englishText.length > 25_000)
    ) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(request);
    characters += request.englishText.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export async function translateCopyDeckTexts(
  requests: TranslationRequest[],
): Promise<TranslationResult[]> {
  const provider = getCopyDeckTranslationProvider();
  const results: TranslationResult[] = [];
  for (const batch of translationBatches(requests)) {
    if (provider.translateMany) {
      results.push(...(await provider.translateMany(batch)));
    } else {
      for (const request of batch) {
        results.push(await provider.translate(request));
      }
    }
  }
  return results;
}
