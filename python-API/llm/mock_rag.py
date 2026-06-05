import re
import os
from typing import List, Dict

_POLICIES_FILE = os.path.join(os.path.dirname(__file__), "policies.md")


def _load_policies(path: str) -> List[Dict]:
    chunks = []
    category = ""
    title = ""
    keywords: List[str] = []
    text_lines: List[str] = []

    def _flush():
        if title and text_lines:
            chunks.append({
                "category": category,
                "title": title,
                "keywords": keywords,
                "text": " ".join(text_lines).strip(),
            })

    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip()
            if line.startswith("## "):
                _flush()
                category = line[3:].strip()
                title, keywords, text_lines = "", [], []
            elif line.startswith("### "):
                _flush()
                title = line[4:].strip()
                keywords, text_lines = [], []
            elif line.lower().startswith("keywords:"):
                keywords = [k.strip() for k in line.split(":", 1)[1].split(",")]
            elif line and not line.startswith("#"):
                text_lines.append(line)

    _flush()
    return chunks


POLICY_CHUNKS: List[Dict] = _load_policies(_POLICIES_FILE)


def _tokenize(text: str) -> set:
    return set(re.findall(r"[a-z]+", text.lower()))


def retrieve_policies(review_text: str, top_k: int = 3) -> List[Dict]:
    review_tokens = _tokenize(review_text)
    scored = []
    for chunk in POLICY_CHUNKS:
        hits = sum(
            1 for kw in chunk["keywords"]
            if any(token.startswith(kw.lower()) or kw.lower() in token for token in review_tokens)
        )
        if hits > 0:
            scored.append((hits, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored[:top_k]]
