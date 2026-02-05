import { ImportClient } from "../../../components/import/ImportClient";
import { getParserOptions } from "@/lib/parsers";
import { getCategories } from "@/app/actions/categories";
import { getAccountNumbers } from "@/app/actions/accountNumbers";

// Server Component - fetches data from database and services
export default async function ImportPage() {
  // Fetch categories from database (user-specific)
  const [categories, accountNumbers] = await Promise.all([
    getCategories(),
    getAccountNumbers(),
  ]);

  // Fetch parser options from parser service
  const parsers = await getParserOptions();

  // Transform parsers to match the expected format
  const parserOptions = parsers.map((parser) => ({
    value: parser.id,
    label: parser.name,
    description: parser.description,
  }));

  return (
    <ImportClient
      initialCategories={categories}
      initialAccountNumbers={accountNumbers}
      parserOptions={parserOptions}
    />
  );
}
