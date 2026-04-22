export async function reverseGeocodeCity(latitude: number, longitude: number) {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "10");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "EMS Internal Platform/1.0",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    const data = await response.json() as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state_district?: string;
        state?: string;
      };
    };

    return data.address?.city
      || data.address?.town
      || data.address?.village
      || data.address?.county
      || data.address?.state_district
      || data.address?.state
      || null;
  } catch {
    return null;
  }
}
