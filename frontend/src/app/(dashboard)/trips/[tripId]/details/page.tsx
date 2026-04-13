import { getTrip } from "@/app/actions/trips";
import { TripDetailsClient } from "@/components/trips/TripDetailsClient";

interface TripDetailsPageProps {
  params: { tripId: string };
}

export default async function TripDetailsPage({ params }: TripDetailsPageProps) {
  const trip = await getTrip(params.tripId);
  return <TripDetailsClient trip={trip} />;
}

