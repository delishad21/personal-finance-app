import { redirect } from "next/navigation";

interface LegacyTripFundingPageProps {
  params: { tripId: string };
}

export default function LegacyTripFundingPage({ params }: LegacyTripFundingPageProps) {
  redirect(`/trips/${params.tripId}/manage/funding`);
}
