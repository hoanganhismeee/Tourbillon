import json

from flask import jsonify, request

from core.llm import call_llm, parse_llm_json
from core.runtime import Runtime
from prompts.editorial import (
    DISCOVERY_STRICT_PROMPT,
    DISCOVERY_SYSTEM_PROMPT,
    EDITORIAL_STRICT_PROMPT,
    EDITORIAL_SYSTEM_PROMPT,
)


def register_routes(app, runtime: Runtime) -> None:
    def call_editorial_llm(system_prompt: str, user_content: str, temperature: float, max_tokens: int) -> str:
        return call_llm(runtime, system_prompt, user_content, temperature=temperature, max_tokens=max_tokens)

    @app.route("/generate-editorial", methods=["POST"])
    def generate_editorial():
        """Generate editorial story sections for a watch archetype."""
        body = request.get_json(silent=True) or {}

        brand = body.get("brand", "")
        collection = body.get("collection", "")
        name = body.get("name", "")
        description = body.get("description", "")
        case_material = body.get("case_material", "")
        diameter_mm = body.get("diameter_mm")
        dial_color = body.get("dial_color", "")
        movement_type = body.get("movement_type", "")
        power_reserve = body.get("power_reserve_h")
        price_tier = body.get("price_tier", "luxury")

        if not brand or not name:
            return jsonify({"error": "brand and name are required"}), 400

        specs_parts = []
        if case_material:
            specs_parts.append(f"{case_material} case")
        if diameter_mm:
            specs_parts.append(f"{diameter_mm}mm diameter")
        if dial_color:
            specs_parts.append(f"{dial_color} dial")
        if movement_type:
            specs_parts.append(f"{movement_type} movement")
        if power_reserve:
            specs_parts.append(f"{power_reserve}h power reserve")
        specs_str = ", ".join(specs_parts) if specs_parts else "specs unavailable"

        user_content = (
            f"Brand: {brand}\n"
            f"Collection: {collection}\n"
            f"Reference: {name}\n"
            f"Description: {description}\n"
            f"Specifications: {specs_str}\n"
            f"Price tier: {price_tier}"
        )

        try:
            raw = call_editorial_llm(EDITORIAL_SYSTEM_PROMPT, user_content, temperature=0.35, max_tokens=1200)
            result = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError):
            try:
                raw = call_editorial_llm(EDITORIAL_STRICT_PROMPT, user_content, temperature=0.35, max_tokens=1200)
                result = parse_llm_json(raw)
            except (ValueError, json.JSONDecodeError) as exc:
                return jsonify({"error": f"Failed to parse LLM response: {str(exc)}"}), 502

        required_keys = {"why_it_matters", "collector_appeal", "design_language", "best_for"}
        if not required_keys.issubset(result.keys()):
            return jsonify({"error": f"LLM response missing required keys: {result}"}), 502

        return jsonify(result)

    @app.route("/generate-discovery-intro", methods=["POST"])
    def generate_discovery_intro():
        """Generate editorial intro and SEO description for a discovery theme page."""
        body = request.get_json(silent=True) or {}

        theme_title = body.get("theme_title", "")
        filter_description = body.get("filter_description", "")
        watch_count = body.get("watch_count", 0)
        sample_watches = body.get("sample_watches", [])

        if not theme_title:
            return jsonify({"error": "theme_title is required"}), 400

        samples_str = ", ".join(sample_watches) if sample_watches else "various luxury watches"
        user_content = (
            f"Theme: {theme_title}\n"
            f"Description: {filter_description}\n"
            f"Number of watches in this theme: {watch_count}\n"
            f"Notable examples: {samples_str}"
        )

        try:
            raw = call_editorial_llm(DISCOVERY_SYSTEM_PROMPT, user_content, temperature=0.4, max_tokens=400)
            result = parse_llm_json(raw)
        except (ValueError, json.JSONDecodeError):
            try:
                raw = call_editorial_llm(DISCOVERY_STRICT_PROMPT, user_content, temperature=0.4, max_tokens=400)
                result = parse_llm_json(raw)
            except (ValueError, json.JSONDecodeError) as exc:
                return jsonify({"error": f"Failed to parse LLM response: {str(exc)}"}), 502

        required_keys = {"intro", "seo_description"}
        if not required_keys.issubset(result.keys()):
            return jsonify({"error": f"LLM response missing required keys: {result}"}), 502

        if len(result.get("seo_description", "")) > 155:
            result["seo_description"] = result["seo_description"][:152] + "..."

        return jsonify(result)
