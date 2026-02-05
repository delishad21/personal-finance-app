import { getCategories } from "@/app/actions/categories";
import { getAccountNumbers } from "@/app/actions/accountNumbers";
import { getCurrentUser } from "@/app/actions/user";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const [user, categories, accounts] = await Promise.all([
    getCurrentUser(),
    getCategories(),
    getAccountNumbers(),
  ]);

  return (
    <SettingsClient
      user={user}
      initialCategories={categories}
      initialAccountIdentifiers={accounts}
    />
  );
}
