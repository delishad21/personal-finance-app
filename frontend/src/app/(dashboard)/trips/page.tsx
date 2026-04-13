import { getTrips } from "@/app/actions/trips";
import { getCurrentUser } from "@/app/actions/user";
import { TripsClient } from "@/components/trips/TripsClient";

export default async function TripsPage() {
  const [trips, user] = await Promise.all([getTrips(), getCurrentUser()]);
  const baseCurrency = user?.baseCurrency || "SGD";

  return <TripsClient trips={trips} baseCurrency={baseCurrency} />;
}
