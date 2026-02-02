import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from .parsers import PARSER_MAP

app = Flask(__name__)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
CORS(app, origins=[frontend_url], supports_credentials=True)


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "service": "file-parser"
    })


@app.route("/parse", methods=["POST"])
def parse_file():
    """Parse uploaded file"""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    parser_id = request.form.get("parserId")

    if not file or not file.filename:
        return jsonify({"error": "No file provided"}), 400

    if not parser_id:
        return jsonify({"error": "No parserId provided"}), 400

    # Get file extension
    filename = secure_filename(file.filename)
    file_extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Read file content
    content = file.read()

    try:
        # Get the parser function from the map
        parser_func = PARSER_MAP.get(parser_id)
        if not parser_func:
            return jsonify({"error": f"Unknown parser: {parser_id}"}), 400

        # All parsers now use the same interface
        transactions = parser_func(content)

        return jsonify({
            "success": True,
            "filename": filename,
            "parserId": parser_id,
            "transactions": transactions,
            "count": len(transactions),
        })
    except Exception as e:
        print(f"Parse error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to parse file: {str(e)}"}), 500


@app.route("/parsers", methods=["GET"])
def get_parsers():
    """Get list of available parsers"""
    return jsonify({
        "parsers": [
            {
                "id": "generic_csv",
                "name": "Generic CSV",
                "fileType": "csv",
                "description": "Generic CSV parser with customizable column mapping",
            },
            {
                "id": "dbs_paylah_statement",
                "name": "DBS PayLah! Statement",
                "fileType": "pdf",
                "description": "Parser for DBS PayLah! wallet statements",
            },
            {
                "id": "dbs_posb_consolidated",
                "name": "DBS/POSB Consolidated Statement",
                "fileType": "pdf",
                "description": "Parser for DBS/POSB monthly statements",
            },
            {
                "id": "ocbc_frank_statement",
                "name": "OCBC FRANK Account Statement",
                "fileType": "pdf",
                "description": "Parser for OCBC FRANK account statements",
            },
        ]
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 4000))
    app.run(host="0.0.0.0", port=port, debug=True)
