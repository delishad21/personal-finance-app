import { ImportClient } from "../../../components/import/ImportClient";
import { getParserOptions } from "@/lib/parsers";
import { getCategories } from "@/app/actions/categories";
import { getAccountNumbers } from "@/app/actions/accountNumbers";

// Server Component - fetches data from database and services
export default async function ImportPage() {
  // Fetch categories from database (user-specific)
  const [categories, accountNumbers] = await Promise.all([
    getCategories({ scope: "main" }),
    getAccountNumbers(),
  ]);

  // Fetch both bank and trip parsers so users can import Revolut/YouTrip
  // into the main transactions workflow when needed.
  const [bankParsers, tripParsers] = await Promise.all([
    getParserOptions("bank"),
    getParserOptions("trip"),
  ]);
  const parserMap = new Map<string, (typeof bankParsers)[number]>();
  [...bankParsers, ...tripParsers].forEach((parser) => {
    parserMap.set(parser.id, parser);
  });
  const parsers = Array.from(parserMap.values());

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
