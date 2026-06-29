import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

function getAddressComponent(
  components: AddressComponent[],
  types: string[],
) {
  return (
    components.find((component) =>
      types.every((type) => component.types.includes(type)),
    )?.long_name ?? null
  );
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

async function reverseGeocodeInEnglish(latitude: number, longitude: number) {
  const apiKey = process.env.GOOGLE_GEOLOCATION_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_GEOLOCATION_API_KEY is missing.");
  }

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    language: "en",
    region: "in",
    key: apiKey,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    { method: "GET", cache: "no-store" },
  );

  const data = await response.json();

  if (data.status !== "OK") {
    return {
      error: data.error_message || data.status || "Google Geocoding failed.",
      city: null,
      district: null,
      town: null,
      village: null,
      state: null,
      formattedAddress: null,
      latitude: null,
      longitude: null,
    };
  }

  const firstResult = data.results?.[0];
  const components: AddressComponent[] = firstResult?.address_components ?? [];
  const location = firstResult?.geometry?.location;

  const city =
    getAddressComponent(components, ["locality"]) ||
    getAddressComponent(components, ["postal_town"]) ||
    getAddressComponent(components, ["administrative_area_level_3"]);

  const district =
    getAddressComponent(components, ["administrative_area_level_3"]) ||
    getAddressComponent(components, ["administrative_area_level_2"]);

  const town =
    getAddressComponent(components, ["sublocality_level_1"]) ||
    getAddressComponent(components, ["sublocality"]) ||
    getAddressComponent(components, ["neighborhood"]);

  const village =
    getAddressComponent(components, ["administrative_area_level_4"]) ||
    getAddressComponent(components, ["administrative_area_level_5"]);

  const state = getAddressComponent(components, [
    "administrative_area_level_1",
  ]);

  return {
    error: null,
    city,
    district,
    town,
    village,
    state,
    formattedAddress: firstResult?.formatted_address ?? null,
    latitude: typeof location?.lat === "number" ? location.lat : null,
    longitude: typeof location?.lng === "number" ? location.lng : null,
  };
}

async function main() {
  const logs = await db.attendanceLog.findMany({
    where: {
      attendanceDate: {
        gte: new Date("2026-06-01T00:00:00.000Z"),
        lte: new Date("2026-06-30T23:59:59.999Z"),
      },
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      googleLatitude: true,
      googleLongitude: true,
      googleCity: true,
      googleDistrict: true,
      googleTown: true,
      googleVillage: true,
      googleState: true,
      googleFormattedAddress: true,
      markedAt: true,
    },
    orderBy: {
      markedAt: "desc",
    },
  });

  console.log(`Found ${logs.length} attendance logs to check.`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const log of logs) {
    const sourceLatitude = log.googleLatitude ?? log.latitude;
    const sourceLongitude = log.googleLongitude ?? log.longitude;

    const hasBrowserCoordinates = log.latitude !== null && log.longitude !== null;
    const hasSourceCoordinates =
      sourceLatitude !== null && sourceLongitude !== null;

    const hasAnyBlankGeocodingNode =
      isBlank(log.googleLatitude) ||
      isBlank(log.googleLongitude) ||
      isBlank(log.googleCity) ||
      isBlank(log.googleDistrict) ||
      isBlank(log.googleTown) ||
      isBlank(log.googleVillage) ||
      isBlank(log.googleState) ||
      isBlank(log.googleFormattedAddress);

    if (!hasSourceCoordinates) {
      skipped += 1;
      console.log(`Skipped ${log.id}: no browser/geocoding coordinates.`);
      continue;
    }

    try {
      const result = await reverseGeocodeInEnglish(
        Number(sourceLatitude),
        Number(sourceLongitude),
      );

      const fallbackLatitude =
        result.latitude ?? log.googleLatitude ?? log.latitude ?? null;

      const fallbackLongitude =
        result.longitude ?? log.googleLongitude ?? log.longitude ?? null;

      await db.attendanceLog.update({
        where: { id: log.id },
        data: {
          // If Google returns normalized coordinates, use them.
          // If not, fill missing google lat/lon from browser coordinates.
          googleLatitude:
            fallbackLatitude == null ? undefined : Number(fallbackLatitude),
          googleLongitude:
            fallbackLongitude == null ? undefined : Number(fallbackLongitude),

          googleCity: result.city,
          googleDistrict: result.district,
          googleTown: result.town,
          googleVillage: result.village,
          googleState: result.state,
          googleFormattedAddress: result.formattedAddress,
          googleError: result.error,
        },
      });

      updated += 1;

      console.log(
        `Updated ${log.id}${
          hasAnyBlankGeocodingNode ? " - blank geocoding fields filled" : ""
        }${hasBrowserCoordinates ? " - browser coordinates available" : ""}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`Failed ${log.id}`, error);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log({
    updated,
    skipped,
    failed,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });