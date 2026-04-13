"""Revolut statement parser for trip workflows."""
import csv
import io
import re
from typing import Optional

import pdfplumber
from dateutil import parser as date_parser


def _parse_money(value: str) -> Optional[float]:
    cleaned = re.sub(r"[^0-9.]", "", value or "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _parse_signed_money(value: str) -> Optional[float]:
    cleaned = re.sub(r"[^0-9.\-]", "", value or "")
    if not cleaned or cleaned in {"-", ".", "-."}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _infer_direction(description: str) -> str:
    desc = description.lower()
    incoming_markers = [
        "top-up by",
        "google pay top-up by",
        "transfer from",
        "refund",
        "cashback",
    ]
    outgoing_markers = [
        "transfer to",
        "cash withdrawal",
    ]
    if any(marker in desc for marker in incoming_markers):
        return "in"
    if any(marker in desc for marker in outgoing_markers):
        return "out"
    return "out"


def _transaction_type(description: str) -> str:
    desc = description.lower()
    if "top-up" in desc or "transfer from" in desc:
        return "topup"
    if "exchange" in desc:
        return "conversion"
    if "transfer to" in desc:
        return "transfer"
    if "cash withdrawal" in desc:
        return "cash_withdrawal"
    return "card_payment"


def _transaction_type_from_csv_type(csv_type: str, description: str) -> str:
    value = (csv_type or "").strip().lower()
    if "topup" in value:
        return "topup"
    if "refund" in value:
        return "refund"
    if "exchange" in value or "conversion" in value:
        return "conversion"
    if "transfer" in value:
        return "transfer"
    if "withdraw" in value:
        return "cash_withdrawal"
    if "card payment" in value:
        return "card_payment"
    return _transaction_type(description)


def _try_parse_date(value: str) -> str:
    try:
        return date_parser.parse(value).strftime("%Y-%m-%d")
    except Exception:
        return value


def _normalize_ymd(value: str) -> Optional[str]:
    if not value:
        return None
    try:
        return date_parser.parse(value).strftime("%Y-%m-%d")
    except Exception:
        return None


def _normalize_description(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().lower()


def _statement_direction_amount(transaction: dict) -> Optional[tuple[str, float]]:
    amount_in = _parse_money(str(transaction.get("amountIn") or ""))
    amount_out = _parse_money(str(transaction.get("amountOut") or ""))
    if amount_in and amount_in > 0:
        return ("in", round(amount_in, 2))
    if amount_out and amount_out > 0:
        return ("out", round(amount_out, 2))
    return None


def _apply_embedded_fee_amount(transaction: dict) -> dict:
    metadata_raw = transaction.get("metadata")
    metadata = metadata_raw if isinstance(metadata_raw, dict) else {}
    if metadata.get("feeEmbeddedApplied"):
        return transaction

    fee_amount = _parse_money(str(metadata.get("feeAmount") or ""))
    source_tag = str(metadata.get("source") or "").lower()
    amount_in = _parse_money(str(transaction.get("amountIn") or ""))
    amount_out = _parse_money(str(transaction.get("amountOut") or ""))
    if not (fee_amount and fee_amount > 0):
        return transaction

    # Fee embedding rules requested for Revolut:
    # - PDF rows already have fee applied in displayed amounts: no numeric mutation.
    # - CSV rows do not:
    #   * outgoing rows: fee is additional outflow => add fee to amountOut
    #   * incoming/topup rows: fee reduces credited value => subtract fee from amountIn
    if source_tag == "csv":
        if amount_out and amount_out > 0:
            transaction["amountOut"] = round(amount_out + fee_amount, 4)
        if amount_in and amount_in > 0:
            transaction["amountIn"] = round(max(amount_in - fee_amount, 0), 4)

    metadata["feeEmbeddedApplied"] = True
    transaction["metadata"] = metadata
    return transaction


def _pdf_match_key(transaction: dict) -> Optional[tuple[str, str, float, str]]:
    direction_amount = _statement_direction_amount(transaction)
    if not direction_amount:
        return None
    date_value = _normalize_ymd(str(transaction.get("date") or ""))
    description = _normalize_description(str(transaction.get("description") or ""))
    if not date_value or not description:
        return None
    direction, amount = direction_amount
    return (date_value, direction, amount, description)


def _csv_match_key(transaction: dict) -> Optional[tuple[str, str, float, str]]:
    metadata = (
        transaction.get("metadata")
        if isinstance(transaction.get("metadata"), dict)
        else {}
    )
    completed_date = _normalize_ymd(str(metadata.get("completedDate") or ""))
    direction_amount = _statement_direction_amount(transaction)
    description = _normalize_description(str(transaction.get("description") or ""))
    if not completed_date or not direction_amount or not description:
        return None
    direction, amount = direction_amount
    return (completed_date, direction, amount, description)


def _parse_pdf_transactions(content: bytes) -> list[dict]:
    """Parse Revolut PDF statement into normalized transaction rows."""
    transactions = []
    lines: list[str] = []

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines.extend([line.strip() for line in text.split("\n") if line.strip()])

    all_text = "\n".join(lines)
    account_identifier = None
    currency = "SGD"

    account_match = re.search(r"Account Number\s+(\d{10,})", all_text, re.I)
    if account_match:
        account_identifier = account_match.group(1)

    currency_match = re.search(r"\b([A-Z]{3})\s+Statement\b", all_text)
    if currency_match:
        currency = currency_match.group(1)

    date_prefix_pattern = re.compile(r"^(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+(.+)$")
    amount_token_pattern = re.compile(
        r"(?:[A-Z]{3}\s*)?(?:S\$|US\$|HK\$|\$|¥|€|£)?\s*(\d[\d,]*\.\d{2})"
    )
    footer_pattern = re.compile(
        r"^(Report lost|Get help directly|Scan the QR code|©\s+\d{4}\s+Revolut)",
        re.I,
    )

    current_tx = None

    def finalize_current():
        if current_tx:
            transactions.append(current_tx.copy())

    for line in lines:
        if footer_pattern.match(line):
            continue
        if line in {"Date Description Money out Money in Balance"}:
            continue

        tx_match = date_prefix_pattern.match(line)
        if tx_match:
            remainder = tx_match.group(2).strip()
            amount_tokens = list(amount_token_pattern.finditer(remainder))
            if not amount_tokens:
                continue

            # Revolut rows are "date + description + amount [+ balance]".
            # We parse from the right to stay currency-agnostic (SGD, HKD, CNY, etc).
            amount_token = amount_tokens[-2] if len(amount_tokens) >= 2 else amount_tokens[-1]
            balance_token = amount_tokens[-1] if len(amount_tokens) >= 2 else None
            description = remainder[: amount_token.start()].strip()
            if not description:
                continue

            finalize_current()

            date_text = tx_match.group(1)
            amount = _parse_money(amount_token.group(1)) or 0
            balance = _parse_money(balance_token.group(1) if balance_token else "")

            direction = _infer_direction(description)
            amount_in = amount if direction == "in" else None
            amount_out = amount if direction == "out" else None

            metadata = {
                "source": "pdf",
                "parserId": "revolut_statement",
                "provider": "Revolut",
                "currency": currency,
                "transactionType": _transaction_type(description),
                "statementAmount": amount,
                "completedDate": _try_parse_date(date_text),
            }
            if account_identifier:
                metadata["accountIdentifier"] = account_identifier

            current_tx = {
                "date": _try_parse_date(date_text),
                "description": description,
                "amountIn": amount_in,
                "amountOut": amount_out,
                "balance": balance,
                "currency": currency,
                "metadata": metadata,
            }
            if account_identifier:
                current_tx["accountIdentifier"] = account_identifier
                current_tx["accountNumber"] = account_identifier
            continue

        if not current_tx:
            continue

        fee_match = re.search(
            r"\bfee\b[^0-9A-Z]*(?:S\$|¥|\$)?\s*([\d,]*\.\d{2})(?:\s*([A-Z]{3}))?",
            line,
            re.I,
        )
        if fee_match:
            current_tx["metadata"]["feeAmount"] = _parse_money(fee_match.group(1))
            current_tx["metadata"]["feeCurrency"] = (
                fee_match.group(2).upper() if fee_match.group(2) else currency
            )
            continue

        if line.startswith("Revolut Rate"):
            rate_match = re.search(
                r"Revolut Rate\s+S\$1\.00\s*=\s*([\d,]*\.?\d+)\s*([A-Z]{3})",
                line,
            )
            foreign_match = re.search(r"([\d,]*\.?\d+)\s*([A-Z]{3})\s*$", line)
            if rate_match:
                current_tx["metadata"]["fxRate"] = _parse_money(rate_match.group(1))
                rate_currency = rate_match.group(2)
                if current_tx["metadata"].get("transactionType") == "conversion":
                    current_tx["metadata"]["foreignCurrency"] = rate_currency
                else:
                    current_tx["metadata"]["merchantCurrency"] = rate_currency
            if foreign_match:
                foreign_amount = _parse_money(foreign_match.group(1))
                foreign_currency = foreign_match.group(2)
                current_tx["metadata"]["foreignAmount"] = foreign_amount
                # Keep conversion rows using foreignCurrency for wallet transfer logic.
                # For non-conversion rows, preserve merchant currency separately so
                # statement wallet currency remains authoritative.
                if current_tx["metadata"].get("transactionType") == "conversion":
                    current_tx["metadata"]["foreignCurrency"] = foreign_currency
                else:
                    current_tx["metadata"]["merchantCurrency"] = foreign_currency
            if current_tx["metadata"].get("transactionType") == "conversion":
                statement_amount = _parse_money(
                    str(current_tx["metadata"].get("statementAmount") or "")
                ) or 0
                foreign_amount = _parse_money(
                    str(current_tx["metadata"].get("foreignAmount") or "")
                ) or 0
                statement_currency = current_tx["metadata"].get("currency") or currency
                foreign_currency = current_tx["metadata"].get("foreignCurrency")
                if foreign_amount > 0 and foreign_currency:
                    # Revolut exchange rows are represented as one statement amount and one foreign amount.
                    # We normalize them so the importer can create internal wallet transfer entries.
                    if current_tx.get("amountOut"):
                        current_tx["metadata"]["fromAmount"] = statement_amount
                        current_tx["metadata"]["fromCurrency"] = statement_currency
                        current_tx["metadata"]["toAmount"] = foreign_amount
                        current_tx["metadata"]["toCurrency"] = foreign_currency
                    elif current_tx.get("amountIn"):
                        current_tx["metadata"]["fromAmount"] = foreign_amount
                        current_tx["metadata"]["fromCurrency"] = foreign_currency
                        current_tx["metadata"]["toAmount"] = statement_amount
                        current_tx["metadata"]["toCurrency"] = statement_currency
            continue

        if line.startswith("From:"):
            current_tx["metadata"]["from"] = line.replace("From:", "", 1).strip()
            continue

        if line.startswith("To:"):
            current_tx["metadata"]["to"] = line.replace("To:", "", 1).strip()
            continue

        if line.startswith("Reference:"):
            current_tx["metadata"]["reference"] = line.replace("Reference:", "", 1).strip()
            continue

    finalize_current()
    return [_apply_embedded_fee_amount(transaction) for transaction in transactions]


def _parse_csv_transactions(content: bytes) -> list[dict]:
    """Parse Revolut CSV export into normalized transaction rows."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    transactions: list[dict] = []

    for row in reader:
        description = (row.get("Description") or "").strip() or "Revolut Transaction"
        currency = (row.get("Currency") or "SGD").strip().upper() or "SGD"
        amount_signed = _parse_signed_money(str(row.get("Amount") or ""))
        if amount_signed is None:
            continue

        amount_abs = abs(amount_signed)
        amount_in = amount_abs if amount_signed > 0 else None
        amount_out = amount_abs if amount_signed < 0 else None

        started_date_raw = str(row.get("Started Date") or "").strip()
        completed_date_raw = str(row.get("Completed Date") or "").strip()
        balance = _parse_signed_money(str(row.get("Balance") or ""))
        fee_amount = _parse_signed_money(str(row.get("Fee") or ""))
        csv_type = str(row.get("Type") or "").strip()
        csv_state = str(row.get("State") or "").strip()
        transaction_date = _try_parse_date(started_date_raw or completed_date_raw)

        metadata = {
            "source": "csv",
            "parserId": "revolut_statement",
            "provider": "Revolut",
            "currency": currency,
            "transactionType": _transaction_type_from_csv_type(csv_type, description),
            "csvType": csv_type,
            "csvState": csv_state,
            "startedDate": started_date_raw,
            "completedDate": completed_date_raw,
        }
        if fee_amount is not None:
            metadata["feeAmount"] = abs(fee_amount)
            metadata["feeCurrency"] = currency

        transactions.append(
            {
                "date": transaction_date,
                "description": description,
                "amountIn": amount_in,
                "amountOut": amount_out,
                "balance": balance,
                "currency": currency,
                "metadata": metadata,
            }
        )

    return [_apply_embedded_fee_amount(transaction) for transaction in transactions]


def _merge_pdf_and_csv_transactions(
    pdf_transactions: list[dict], csv_transactions: list[dict]
) -> list[dict]:
    """Merge Revolut PDF + CSV rows by completed date, in/out, and description."""
    csv_by_key: dict[tuple[str, str, float, str], list[int]] = {}
    for index, csv_tx in enumerate(csv_transactions):
        key = _csv_match_key(csv_tx)
        if not key:
            continue
        csv_by_key.setdefault(key, []).append(index)

    unmatched_csv = set(range(len(csv_transactions)))
    merged_transactions: list[dict] = []

    for pdf_tx in pdf_transactions:
        key = _pdf_match_key(pdf_tx)
        csv_match_index = None

        if key:
            candidate_indices = csv_by_key.get(key) or []
            while candidate_indices:
                candidate = candidate_indices.pop(0)
                if candidate in unmatched_csv:
                    csv_match_index = candidate
                    break

        if csv_match_index is None:
            merged_transactions.append(pdf_tx)
            continue

        unmatched_csv.discard(csv_match_index)
        csv_tx = csv_transactions[csv_match_index]
        merged_tx = dict(pdf_tx)

        merged_metadata: dict = {}
        pdf_metadata = pdf_tx.get("metadata")
        if isinstance(pdf_metadata, dict):
            merged_metadata.update(pdf_metadata)
        csv_metadata = csv_tx.get("metadata")
        if isinstance(csv_metadata, dict):
            for field in (
                "csvType",
                "csvState",
                "startedDate",
                "completedDate",
                "feeAmount",
                "feeCurrency",
            ):
                value = csv_metadata.get(field)
                if value not in (None, ""):
                    merged_metadata[field] = value

        merged_metadata["source"] = "pdf+csv"
        started_date = (
            csv_metadata.get("startedDate")
            if isinstance(csv_metadata, dict)
            else None
        )
        if started_date:
            merged_tx["date"] = _try_parse_date(str(started_date))

        if merged_tx.get("balance") is None and csv_tx.get("balance") is not None:
            merged_tx["balance"] = csv_tx.get("balance")
        if merged_tx.get("amountIn") is None:
            merged_tx["amountIn"] = csv_tx.get("amountIn")
        if merged_tx.get("amountOut") is None:
            merged_tx["amountOut"] = csv_tx.get("amountOut")
        if not merged_tx.get("currency") and csv_tx.get("currency"):
            merged_tx["currency"] = csv_tx.get("currency")

        merged_tx["metadata"] = merged_metadata
        merged_transactions.append(merged_tx)

    for index, csv_tx in enumerate(csv_transactions):
        if index in unmatched_csv:
            merged_transactions.append(csv_tx)

    return merged_transactions


def _detect_format(content: bytes) -> str:
    if content.lstrip().startswith(b"%PDF"):
        return "pdf"
    return "csv"


def _sort_transactions_by_date(transactions: list[dict]) -> list[dict]:
    decorated: list[tuple[tuple[int, int, int], int, dict]] = []
    for index, transaction in enumerate(transactions):
        normalized_date = _normalize_ymd(str(transaction.get("date") or ""))
        if normalized_date:
            year, month, day = normalized_date.split("-")
            sort_key = (0, int(year), int(month), int(day))
        else:
            sort_key = (1, 0, 0, 0)
        decorated.append((sort_key, index, transaction))

    decorated.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in decorated]


def parse(content: bytes) -> list[dict]:
    """Parse single Revolut statement file (PDF or CSV)."""
    file_format = _detect_format(content)
    if file_format == "pdf":
        return _parse_pdf_transactions(content)
    return _parse_csv_transactions(content)


def parse_with_supplemental(primary_content: bytes, supplemental_content: bytes) -> list[dict]:
    """Parse Revolut primary + supplemental files and merge PDF + CSV rows when possible."""
    primary_transactions = parse(primary_content)
    supplemental_transactions = parse(supplemental_content)

    pdf_transactions: list[dict] = []
    csv_transactions: list[dict] = []
    passthrough_transactions: list[dict] = []

    for transaction in [*primary_transactions, *supplemental_transactions]:
        metadata = (
            transaction.get("metadata")
            if isinstance(transaction.get("metadata"), dict)
            else {}
        )
        source = str(metadata.get("source") or "").lower()
        if source.startswith("pdf"):
            pdf_transactions.append(transaction)
        elif source == "csv":
            csv_transactions.append(transaction)
        else:
            passthrough_transactions.append(transaction)

    if pdf_transactions and csv_transactions:
        return _sort_transactions_by_date([
            *_merge_pdf_and_csv_transactions(pdf_transactions, csv_transactions),
            *passthrough_transactions,
        ])

    return _sort_transactions_by_date([*primary_transactions, *supplemental_transactions])
