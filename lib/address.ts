export type AddressCountryCode = "IN" | "US";

export type AddressValue = {
  addressLine: string;
  city: string;
  state: string;
  country: AddressCountryCode;
  postalCode: string;
};

export const ADDRESS_COUNTRY_OPTIONS: { value: AddressCountryCode; label: string }[] = [
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
];

export const INDIA_STATE_OPTIONS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export const US_STATE_OPTIONS = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
  "District of Columbia",
] as const;

export function normalizeAddressCountry(value: string | null | undefined): AddressCountryCode {
  return value === "US" ? "US" : "IN";
}

export function getStateOptions(country: string | null | undefined) {
  return normalizeAddressCountry(country) === "US" ? [...US_STATE_OPTIONS] : [...INDIA_STATE_OPTIONS];
}

export function createDefaultAddress(country: AddressCountryCode = "IN"): AddressValue {
  return {
    addressLine: "",
    city: "",
    state: "",
    country,
    postalCode: "",
  };
}

export function toAddressSummary(address: Partial<AddressValue> | null | undefined) {
  if (!address) return null;

  const parts = [address.addressLine, address.city, address.state];
  const countryLabel = ADDRESS_COUNTRY_OPTIONS.find((option) => option.value === normalizeAddressCountry(address.country))?.label;
  if (countryLabel) parts.push(countryLabel);
  if (address.postalCode?.trim()) parts.push(address.postalCode.trim());

  const normalized = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");

  return normalized || null;
}
