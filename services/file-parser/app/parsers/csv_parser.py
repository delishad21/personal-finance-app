import csv
import io
from datetime import datetime
from typing import Optional, Any
from dateutil import parser as date_parser


def parse(content: bytes, parser_id: str = "generic_csv", config: Optional[dict] = None) -> list[dict]:
    """Parse CSV file and extract transactions."""
    csv_text = content.decode("utf-8")

    # Default config
    parser_config = config or {
        "delimiter": ",",
        "hasHeader": True,
        "dateFormat": "%m/%d/%Y",
        "columnMapping": {
            "date": "Date",
            "description": "Description",
            "amountIn": "Credit",
            "amountOut": "Debit",
            "balance": "Balance",
        },
    }

    delimiter = parser_config.get("delimiter", ",")
    has_header = parser_config.get("hasHeader", True)
    date_format = parser_config.get("dateFormat", "%m/%d/%Y")
    column_mapping = parser_config.get("columnMapping", {})
    amount_transform = parser_config.get("amountTransform", {})

    transactions = []

    reader = csv.DictReader(io.StringIO(csv_text), delimiter=delimiter)

    for row in reader:
        # Parse date
        date_str = row.get(column_mapping.get("date", "Date"), "")
        try:
            if date_format:
                parsed_date = datetime.strptime(date_str, date_format)
            else:
                parsed_date = date_parser.parse(date_str)
            date_formatted = parsed_date.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            date_formatted = date_str

        # Parse amounts
        amount_in = None
        amount_out = None

        if amount_transform.get("type") == "single_column_signed":
            amount_col = amount_transform.get("column", "Amount")
            amount_str = row.get(amount_col, "")
            if amount_str:
                amount = parse_amount(amount_str)
                if amount > 0:
                    amount_in = amount
                elif amount < 0:
                    amount_out = abs(amount)
        else:
            # Separate columns
            in_col = column_mapping.get("amountIn")
            out_col = column_mapping.get("amountOut")

            if in_col and row.get(in_col):
                amount_in = parse_amount(row.get(in_col, ""))

            if out_col and row.get(out_col):
                amount_out = parse_amount(row.get(out_col, ""))

        # Parse balance
        balance = None
        balance_col = column_mapping.get("balance")
        if balance_col and row.get(balance_col):
            balance = parse_amount(row.get(balance_col, ""))

        # Get description
        description = row.get(column_mapping.get("description", "Description"), "")

        # Build metadata from remaining fields
        metadata = {"source": "csv", "parserId": parser_id}
        for key, value in row.items():
            if key not in [
                column_mapping.get("date"),
                column_mapping.get("description"),
                column_mapping.get("amountIn"),
                column_mapping.get("amountOut"),
                column_mapping.get("balance"),
            ]:
                metadata[key] = value

        if date_formatted and description:
            transaction = {
                "date": date_formatted,
                "description": description,
                "amountIn": amount_in,
                "amountOut": amount_out,
                "balance": balance,
                "metadata": metadata,
            }
            transactions.append(transaction)

    return transactions


def parse_amount(value: str) -> Optional[float]:
    """Parse amount string, handling currency symbols and commas."""
    if not value:
        return None
    try:
        # Remove currency symbols, commas, and whitespace
        cleaned = value.replace("$", "").replace(",", "").strip()
        return float(cleaned)
    except (ValueError, TypeError):
        return None
