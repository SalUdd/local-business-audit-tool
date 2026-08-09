import axios from "axios";

const PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
].join(",");

export interface GooglePlaceBusiness {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
}

interface PlacesSearchResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
  }>;
}

export async function fetchGooglePlaces(
  industry: string,
  location: string
): Promise<GooglePlaceBusiness[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured.");
  }

  const textQuery = `${industry.trim()} in ${location.trim()}`;

  const { data } = await axios.post<PlacesSearchResponse>(
    PLACES_SEARCH_URL,
    {
      textQuery,
      pageSize: 20,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
    }
  );

  return (data.places ?? [])
    .slice(0, 20)
    .map((place) => ({
      placeId: place.id ?? "",
      name: place.displayName?.text?.trim() || "Unknown business",
      address: place.formattedAddress ?? null,
      phone: place.nationalPhoneNumber ?? null,
      website: place.websiteUri ?? null,
      rating: typeof place.rating === "number" ? place.rating : null,
      userRatingsTotal:
        typeof place.userRatingCount === "number"
          ? place.userRatingCount
          : null,
    }))
    .filter((place) => place.placeId.length > 0);
}
