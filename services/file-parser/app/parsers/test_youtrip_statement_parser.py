from app.parsers import youtrip_statement_parser as parser


class _FakePage:
    def __init__(self, text):
        self._text = text

    def extract_text(self):
        return self._text


class _FakePdf:
    def __init__(self, text):
        self.pages = [_FakePage(text)]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False


def _parse_text(monkeypatch, text):
    monkeypatch.setattr(parser.pdfplumber, "open", lambda _: _FakePdf(text))
    return parser.parse(b"fake pdf bytes")


def test_parse_money_preserves_leading_negative_sign():
    assert parser._parse_money("-$12.34") == -12.34


def test_parse_money_preserves_parenthetical_negative_notation():
    assert parser._parse_money("($12.34)") == -12.34


def test_known_incoming_markers_are_inflow(monkeypatch):
    rows = _parse_text(
        monkeypatch,
        "\n".join(
            [
                "My SGD Statement",
                "Transactions",
                "1 Jan 2024 Refund from merchant $12.34 $100.00",
                "2 Jan 2024 Top up $20.00 $120.00",
                "3 Jan 2024 Transfer in from Jane $30.00 $150.00",
            ]
        ),
    )

    assert [row["amountIn"] for row in rows] == [12.34, 20.00, 30.00]
    assert [row["amountOut"] for row in rows] == [None, None, None]


def test_normal_card_payment_is_outflow(monkeypatch):
    rows = _parse_text(
        monkeypatch,
        "\n".join(
            [
                "My SGD Statement",
                "Transactions",
                "1 Jan 2024 Grocery store $12.34 $100.00",
            ]
        ),
    )

    assert rows[0]["amountIn"] is None
    assert rows[0]["amountOut"] == 12.34


def test_signed_negative_amount_is_outflow_for_ambiguous_description(monkeypatch):
    rows = _parse_text(
        monkeypatch,
        "\n".join(
            [
                "My SGD Statement",
                "Transactions",
                "1 Jan 2024 Account adjustment -$12.34 $100.00",
            ]
        ),
    )

    assert rows[0]["amountIn"] is None
    assert rows[0]["amountOut"] == 12.34


def test_signed_positive_amount_with_plus_marker_is_inflow(monkeypatch):
    rows = _parse_text(
        monkeypatch,
        "\n".join(
            [
                "My SGD Statement",
                "Transactions",
                "1 Jan 2024 Account adjustment +$12.34 $100.00",
            ]
        ),
    )

    assert rows[0]["amountIn"] == 12.34
    assert rows[0]["amountOut"] is None


def test_conversion_metadata_parsing_is_preserved(monkeypatch):
    rows = _parse_text(
        monkeypatch,
        "\n".join(
            [
                "My SGD Statement",
                "Transactions",
                "1 Jan 2024 SmartExchange $12.34 $100.00",
                "$12.34 SGD to $9.10 USD",
                "FX rate: $1 SGD = $0.737 USD",
            ]
        ),
    )

    metadata = rows[0]["metadata"]
    assert metadata["fromAmount"] == 12.34
    assert metadata["fromCurrency"] == "SGD"
    assert metadata["toAmount"] == 9.10
    assert metadata["toCurrency"] == "USD"
    assert metadata["fxBaseCurrency"] == "SGD"
    assert metadata["fxRate"] == 0.737
    assert metadata["fxQuoteCurrency"] == "USD"
