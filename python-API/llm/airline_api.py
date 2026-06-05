import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
from mock_rag import retrieve_policies

load_dotenv()

app = Flask(__name__)
CORS(app)

_groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

_PROMPT_FILE = os.path.join(os.path.dirname(__file__), "prompt.md")
with open(_PROMPT_FILE, encoding="utf-8") as _f:
    SYSTEM_PROMPT = _f.read().strip()


def _build_user_message(review: str, policy_chunks: list) -> str:
    policy_block = "\n\n".join(
        f"[{chunk['title']}]\n{chunk['text']}" for chunk in policy_chunks
    )
    return (
        f"CUSTOMER REVIEW:\n{review}\n\n"
        f"RELEVANT COMPANY POLICIES:\n{policy_block}\n\n"
        "What should our company do in response to this complaint?"
    )


@app.route("/analyze-review", methods=["POST"])
def analyze_review():
    body = request.get_json(silent=True)
    if not body or not body.get("review", "").strip():
        return jsonify({"error": "Missing 'review' field in request body."}), 400

    review = body["review"].strip()
    matched = retrieve_policies(review, top_k=3)

    if not matched:
        return jsonify({
            "message": "No matching policy found. Please escalate to a supervisor for manual assessment."
        })

    chat = _groq_client.chat.completions.create(
        model=_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": _build_user_message(review, matched)},
        ],
        temperature=0.3,
        max_tokens=120,
    )

    lines = [l for l in chat.choices[0].message.content.strip().splitlines() if l.strip()]
    message = " ".join(lines[:2])

    return jsonify({"message": message})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": _model})


if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5001))
    print("=" * 60)
    print("  SkyLine Airlines Review API")
    print(f"  POST http://localhost:{port}/analyze-review")
    print(f"  GET  http://localhost:{port}/health")
    print("=" * 60)
    app.run(debug=False, host="0.0.0.0", port=port, use_reloader=False)
