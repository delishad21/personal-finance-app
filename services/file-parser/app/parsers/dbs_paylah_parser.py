"""DBS PayLah! Statement Parser"""
import re
from datetime import datetime
from dateutil import parser as date_parser
import pdfplumber
import io


def parse(content: bytes) -> list[dict]:
    """Parse DBS PayLah! statement using pdfplumber text."""
    print("\n=== PayLah Statement Parser ===")
    transactions = []

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        all_text = ""
        for page in pdf.pages:
            all_text += page.extract_text() or ""
            all_text += "\n"

        lines = all_text.split("\n")

        # Extract metadata
        account_metadata = {}

        # Statement date - format: "22 Dec 2025 6596317826 8888880012044058"
        match = re.search(r"(\d{1,2}\s+\w+\s+(\d{4}))\s+\d{10}\s+(\d{16})", all_text)
        if match:
            account_metadata["statementDate"] = match.group(1)
            account_metadata["statementYear"] = int(match.group(2))
            account_metadata["accountNumber"] = match.group(3)
            print(f"Statement Date: {match.group(1)}")
            print(f"Wallet Account: {match.group(3)}")

        current_year = account_metadata.get("statementYear", datetime.now().year)
        in_section = False

        for i, line in enumerate(lines):
            line = line.strip()

            if "NEW TRANSACTIONS" in line:
                in_section = True
                print(f"Found NEW TRANSACTIONS at line {i}")
                continue

            if in_section and "Total :" in line:
                print(f"End of transactions at line {i}")
                break

            if not in_section:
                continue

            # Skip REF NO lines and empty lines
            if not line or "REF NO" in line:
                continue

            # pdfplumber format: "26 Nov MIRANA SIGN 4.40 DB"
            # Pattern: date + description + amount + CR/DB
            tx_match = re.match(r"^(\d{1,2}\s+\w+)\s+(.+?)\s+(\d+\.\d{2})\s+(CR|DB)$", line)

            if tx_match:
                date_str = tx_match.group(1)
                description = tx_match.group(2).strip()
                amount = float(tx_match.group(3))
                tx_type = tx_match.group(4)

                try:
                    parsed_date = date_parser.parse(f"{date_str} {current_year}")
                    date_formatted = parsed_date.strftime("%Y-%m-%d")
                except:
                    date_formatted = date_str

                transaction = {
                    "date": date_formatted,
                    "description": description,
                    "amountIn": amount if tx_type == "CR" else None,
                    "amountOut": amount if tx_type == "DB" else None,
                    "metadata": {
                        "source": "pdf",
                        "parserId": "dbs_paylah_statement",
                        "bank": "DBS",
                        "transactionType": "credit" if tx_type == "CR" else "debit",
                        **account_metadata,
                    },
                }
                print(f"Found: {date_str} | {description} | {amount} {tx_type}")
                transactions.append(transaction)

        print(f"\nTotal transactions found: {len(transactions)}")
        return transactions
