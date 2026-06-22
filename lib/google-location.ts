type GoogleAddressDetails = {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  district: string | null;
  town: string | null;
  village: string | null;
  state: string | null;
  formattedAddress: string | null;
  error: string | null;
  capturedAt: Date | null;
};

type GoogleGeocodingResponse = {
  status?: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    address_components?: Array<{
      long_name?: string;
      types?: string[];
    }>;
  }>;
};

function getGoogleServerApiKey() {
  return (
    process.env.GOOGLE_GEOLOCATION_API_KEY ||
    process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    ""
  ).trim();
}

function getAddressComponent(
  components: Array<{ long_name?: string; types?: string[] }> | undefined,
  types: string[],
) {
  if (!components?.length) return null;
  const match = components.find((component) =>
    types.every((type) => component.types?.includes(type)),
  );
  return match?.long_name || null;
}

export async function getGoogleAddressDetailsForCoordinates(
  latitude: number,
  longitude: number,
): Promise<GoogleAddressDetails> {
  const apiKey = getGoogleServerApiKey();
  const capturedAt = new Date();

  if (!apiKey) {
    return {
      latitude: null,
      longitude: null,
      city: null,
      district: null,
      town: null,
      village: null,
      state: null,
      formattedAddress: null,
      error: "GOOGLE_GEOLOCATION_API_KEY is not configured on the server.",
      capturedAt,
    };
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${latitude},${longitude}`)}&key=${encodeURIComponent(apiKey)}`,
      { method: "GET", cache: "no-store" },
    );

    const payload = (await response.json().catch(() => null)) as
      | GoogleGeocodingResponse
      | null;

    if (!response.ok) {
      return {
        latitude: null,
        longitude: null,
        city: null,
        district: null,
        town: null,
        village: null,
        state: null,
        formattedAddress: null,
        error:
          payload?.error_message ||
          payload?.status ||
          `Google Geocoding failed with status ${response.status}.`,
        capturedAt,
      };
    }

    if (
      payload?.status &&
      payload.status !== "OK" &&
      payload.status !== "ZERO_RESULTS"
    ) {
      return {
        latitude: null,
        longitude: null,
        city: null,
        district: null,
        town: null,
        village: null,
        state: null,
        formattedAddress: null,
        error: payload.error_message || payload.status,
        capturedAt,
      };
    }

    const firstResult = payload?.results?.[0];
    const components = firstResult?.address_components;

    if (!components?.length) {
      const googleLocation = firstResult?.geometry?.location;
      return {
        latitude: typeof googleLocation?.lat === "number" ? googleLocation.lat : null,
        longitude: typeof googleLocation?.lng === "number" ? googleLocation.lng : null,
        city: null,
        district: null,
        town: null,
        village: null,
        state: null,
        formattedAddress: firstResult?.formatted_address || null,
        error: payload?.status === "ZERO_RESULTS" ? "ZERO_RESULTS" : null,
        capturedAt,
      };
    }

    const city =
      getAddressComponent(components, ["locality"]) ||
      getAddressComponent(components, ["administrative_area_level_2"]);
    const district =
      getAddressComponent(components, ["administrative_area_level_3"]) ||
      getAddressComponent(components, ["administrative_area_level_2"]);
    const town =
      getAddressComponent(components, ["postal_town"]) ||
      getAddressComponent(components, ["sublocality_level_1"]) ||
      getAddressComponent(components, ["sublocality"]);
    const village =
      getAddressComponent(components, ["neighborhood"]) ||
      getAddressComponent(components, ["sublocality_level_2"]);
    const state = getAddressComponent(components, [
      "administrative_area_level_1",
    ]);

    const googleLocation = firstResult?.geometry?.location;

    return {
      latitude: typeof googleLocation?.lat === "number" ? googleLocation.lat : null,
      longitude: typeof googleLocation?.lng === "number" ? googleLocation.lng : null,
      city,
      district,
      town,
      village,
      state,
      formattedAddress: firstResult?.formatted_address || null,
      error: null,
      capturedAt,
    };
  } catch (error) {
    return {
      latitude: null,
      longitude: null,
      city: null,
      district: null,
      town: null,
      village: null,
      state: null,
      formattedAddress: null,
      error:
        error instanceof Error
          ? error.message
          : "Google Geocoding request failed.",
      capturedAt,
    };
  }
}
