"""OCBC FRANK Account Statement Parser"""
import re
from datetime import datetime
from dateutil import parser as date_parser
import pdfplumber
import io


def parse(content: bytes) -> list[dict]:
    """Parse OCBC FRANK statement using pdfplumber."""
    print("\n=== OCBC Statement Parser ===")

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        all_text = ""
        all_words = []

        for page in pdf.pages:
            all_text += page.extract_text() or ""
            all_text += "\n"
            # Get words with position info
            words = page.extract_words()
            all_words.extend(words)

        # Extract metadata
        account_metadata = {}
        account_number = None

        match = re.search(r"Account No[.\s]+(\d+)", all_text, re.I)
        if match:
            # accountNumber extracted for import flow but not stored in metadata
            account_number = match.group(1)
            print(f"Account Number: {account_number}")

        period_match = re.search(
            r"(\d{1,2}\s+\w+\s+(\d{4}))\s+TO\s+(\d{1,2}\s+\w+\s+\d{4})", all_text, re.I
        )
        if period_match:
            account_metadata["statementPeriodStart"] = period_match.group(1)
            account_metadata["statementPeriodEnd"] = period_match.group(3)
            account_metadata["statementYear"] = int(period_match.group(2))
            print(f"Period: {period_match.group(1)} TO {period_match.group(3)}")

        current_year = account_metadata.get("statementYear", datetime.now().year)

        # Find column positions from the header
        withdrawal_x = None
        deposit_x = None
        balance_x = None

        for page in pdf.pages:
            page_words = page.extract_words()
            for word in page_words:
                text_lower = word["text"].lower()
                if "withdrawal" in text_lower:
                    withdrawal_x = word["x0"]
                elif "deposit" in text_lower:
                    deposit_x = word["x0"]
                elif "balance" in text_lower and balance_x is None:
                    balance_x = word["x0"]
            if withdrawal_x and deposit_x:
                break

        print(f"Column positions - Withdrawal: {withdrawal_x}, Deposit: {deposit_x}, Balance: {balance_x}")

        # Parse using column positions
        return _parse_with_columns(
            pdf,
            account_metadata,
            current_year,
            {
                "withdrawal_x": withdrawal_x,
                "deposit_x": deposit_x,
                "balance_x": balance_x,
            },
            account_number,
        )


def _parse_with_columns(
    pdf,
    account_metadata: dict,
    current_year: int,
    header_positions: dict,
    account_number: str = None,
) -> list[dict]:
    """Parse OCBC statement using word positions to map amounts to columns."""
    transactions = []
    withdrawal_x = header_positions["withdrawal_x"]
    deposit_x = header_positions["deposit_x"]
    balance_x = header_positions["balance_x"]

    in_section = False
    pending_tx = None
    pre_description = []

    for page in pdf.pages:
        words = page.extract_words()
        # Cluster words into lines using a small top tolerance to merge OCR splits
        sorted_words = sorted(words, key=lambda w: w["top"])
        clustered_lines = []
        for word in sorted_words:
            if not clustered_lines or abs(word["top"] - clustered_lines[-1]["top"]) > 1.0:
                clustered_lines.append({"top": word["top"], "words": [word]})
            else:
                clustered_lines[-1]["words"].append(word)

        for line in clustered_lines:
            line_words = sorted(line["words"], key=lambda w: w["x0"])
            line_text = " ".join(w["text"] for w in line_words).strip()

            if not line_text:
                continue

            if "BALANCE B/F" in line_text:
                in_section = True
                pending_tx = None
                pre_description = []
                continue

            if in_section and "BALANCE C/F" in line_text:
                if pending_tx:
                    transactions.append(
                        _finalize_transaction(pending_tx, account_metadata, current_year, account_number)
                    )
                    pending_tx = None
                in_section = False
                pre_description = []
                continue

            if not in_section:
                continue

            # Detect transaction line by two date tokens (trans date + value date)
            date_tokens = []
            date_token_indices = set()
            for idx, w in enumerate(line_words[:-1]):
                if re.match(r"^\d{1,2}$", w["text"]):
                    next_word = line_words[idx + 1]["text"]
                    if re.match(r"^[A-Z]{3}$", next_word, re.I):
                        date_tokens.append(f"{w['text']} {next_word}")
                        date_token_indices.update({idx, idx + 1})
            if len(date_tokens) >= 2:
                if pending_tx:
                    transactions.append(
                        _finalize_transaction(pending_tx, account_metadata, current_year, account_number)
                    )
                    pending_tx = None

                trans_date = date_tokens[0]
                value_date = date_tokens[1]

                pending_tx = {
                    "trans_date": trans_date,
                    "value_date": value_date,
                    "description": "",
                    "amountOut": None,
                    "amountIn": None,
                    "balance": None,
                }

                # Description from words between value date and withdrawal column
                desc_words = []
                for idx, w in enumerate(line_words):
                    if idx in date_token_indices:
                        continue
                    if w["x0"] < withdrawal_x - 5 and not re.match(r"^[\d,]+\.\d{2}$", w["text"]):
                        desc_words.append(w["text"])
                if pre_description:
                    pending_tx["description"] = " ".join(pre_description).strip()
                    pre_description = []
                if desc_words:
                    pending_tx["description"] = (
                        (pending_tx["description"] + " " + " ".join(desc_words)).strip()
                    )

                # Map numeric words to columns
                for w in line_words:
                    if not re.match(r"^[\d,]+\.\d{2}$", w["text"]):
                        continue
                    amount = float(w["text"].replace(",", ""))
                    if withdrawal_x - 5 <= w["x0"] < deposit_x - 5:
                        pending_tx["amountOut"] = amount
                    elif deposit_x - 5 <= w["x0"] < balance_x - 5:
                        pending_tx["amountIn"] = amount
                    elif w["x0"] >= balance_x - 5:
                        pending_tx["balance"] = amount

                continue

            # Description continuation lines
            if pending_tx:
                has_amount = any(re.match(r"^[\d,]+\.\d{2}$", w["text"]) for w in line_words)
                if not has_amount:
                    extra_desc = [
                        w["text"] for w in line_words if w["x0"] < withdrawal_x - 5
                    ]
                    if extra_desc:
                        pending_tx["description"] = (
                            (pending_tx["description"] + " " + " ".join(extra_desc)).strip()
                        )
            else:
                # Capture description lines that appear before the transaction line
                has_amount = any(re.match(r"^[\d,]+\.\d{2}$", w["text"]) for w in line_words)
                has_date = any(
                    re.match(r"^\d{1,2}$", w["text"]) for w in line_words
                ) and any(re.match(r"^[A-Z]{3}$", w["text"], re.I) for w in line_words)
                if not has_amount and not has_date:
                    pre_description.extend([w["text"] for w in line_words])

        if in_section and pending_tx:
            transactions.append(
                _finalize_transaction(pending_tx, account_metadata, current_year, account_number)
            )
            pending_tx = None

    print(f"\nTotal transactions found: {len(transactions)}")
    return transactions


def _finalize_transaction(
    pending_tx: dict,
    account_metadata: dict,
    current_year: int,
    account_number: str = None,
) -> dict:
    """Convert pending OCBC transaction to final format without balance inference."""
    trans_date = pending_tx["trans_date"]

    try:
        parsed_date = date_parser.parse(f"{trans_date} {current_year}")
        date_formatted = parsed_date.strftime("%Y-%m-%d")
    except:
        date_formatted = trans_date

    transaction = {
        "date": date_formatted,
        "description": pending_tx["description"].strip(),
        "amountOut": pending_tx.get("amountOut"),
        "amountIn": pending_tx.get("amountIn"),
        "balance": pending_tx.get("balance"),
        "metadata": {
            "source": "pdf",
            "parserId": "ocbc_frank_statement",
            "bank": "OCBC",
            **account_metadata,
        },
    }
    if account_number:
        transaction["accountNumber"] = account_number
        transaction["accountIdentifier"] = account_number
    return transaction
