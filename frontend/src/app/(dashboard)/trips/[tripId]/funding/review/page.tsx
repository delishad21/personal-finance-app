import { getFundingCandidates, getTrip, getTripFundings } from "@/app/actions/trips";
import { TripFundingMatchReviewClient } from "@/components/trips/TripFundingMatchReviewClient";

interface TripFundingReviewPageProps {
  params: { tripId: string };
}

export default async function TripFundingReviewPage({
  params,
}: TripFundingReviewPageProps) {
  const tripId = params.tripId;
  const [trip, fundings, fundingCandidates] = await Promise.all([
    getTrip(tripId),
    getTripFundings(tripId),
    getFundingCandidates(tripId, { limit: 20, offset: 0 }),
  ]);

  return (
    <TripFundingMatchReviewClient
      trip={trip}
      fundings={fundings}
      initialFundingCandidates={fundingCandidates}
    />
  );
}
