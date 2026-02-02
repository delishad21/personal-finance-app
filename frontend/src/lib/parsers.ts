export interface ParserOption {
  id: string;
  name: string;
  fileType: string;
  description: string;
}

export async function getParserOptions(): Promise<ParserOption[]> {
  try {
    const parserServiceUrl =
      process.env.PARSER_SERVICE_URL || "http://localhost:4000";
    const response = await fetch(`${parserServiceUrl}/parsers`, {
      cache: "no-store", // Always fetch fresh parser list
    });

    if (!response.ok) {
      console.error(
        "Failed to fetch parsers from service:",
        response.statusText,
      );
      // Return fallback parsers if service is down
      return getFallbackParsers();
    }

    const data = await response.json();
    return data.parsers || [];
  } catch (error) {
    console.error("Error fetching parser options:", error);
    // Return fallback parsers if service is unreachable
    return getFallbackParsers();
  }
}

function getFallbackParsers(): ParserOption[] {
  return [
    {
      id: "generic_csv",
      name: "Generic CSV",
      fileType: "csv",
      description: "Standard CSV file format",
    },
    {
      id: "dbs_paylah_statement",
      name: "DBS PayLah! Statement",
      fileType: "pdf",
      description: "Parser for DBS PayLah! wallet statements",
    },
    {
      id: "dbs_posb_consolidated",
      name: "DBS/POSB Consolidated Statement",
      fileType: "pdf",
      description: "Parser for DBS/POSB monthly statements",
    },
    {
      id: "ocbc_frank_statement",
      name: "OCBC FRANK Account Statement",
      fileType: "pdf",
      description: "Parser for OCBC FRANK account statements",
    },
  ];
}
