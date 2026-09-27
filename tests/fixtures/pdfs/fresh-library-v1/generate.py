"""Generate only the separate fresh-library holdout PDFs; --check is read-only."""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path


DIRECTORY = Path(__file__).resolve().parent
SOURCE = DIRECTORY / "source.json"
MANIFEST = DIRECTORY / "manifest.json"
PARENT_GENERATOR = DIRECTORY.parent / "generate.py"
EXPECTED = {
    "equipment-maintenance-3p.pdf": 3,
    "data-processing-5p.pdf": 5,
    "research-services-7p.pdf": 7,
}


def source_specification() -> dict:
    specification = json.loads(SOURCE.read_text(encoding="utf-8"))
    fixtures = specification["fixtures"]
    if (
        specification.get("schema_version") != 1
        or {item["filename"]: len(item["pages"]) for item in fixtures} != EXPECTED
        or len(fixtures) != len(EXPECTED)
        or any(item.get("kind") != "text" for item in fixtures)
    ):
        raise ValueError("Fresh fixture inventory or page counts changed")
    return specification


def rendered_documents() -> dict[str, bytes]:
    module_spec = importlib.util.spec_from_file_location("clauseiq_fixture_renderer", PARENT_GENERATOR)
    if module_spec is None or module_spec.loader is None:
        raise RuntimeError("The shared fixture renderer could not be loaded")
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    specification = source_specification()
    return {
        fixture["filename"]: module.render_fixture(fixture, specification["notice"])
        for fixture in specification["fixtures"]
    }


def check() -> None:
    expected = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if expected.get("schema_version") != 1 or set(expected.get("pdf_sha256", {})) != set(EXPECTED):
        raise ValueError("Fresh fixture manifest inventory changed")
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != expected.get("source_sha256"):
        raise ValueError("Authored fixture source changed; review and version the holdout")
    for filename, content in rendered_documents().items():
        target = DIRECTORY / filename
        if (
            not target.is_file()
            or target.read_bytes() != content
            or hashlib.sha256(content).hexdigest() != expected["pdf_sha256"][filename]
        ):
            raise ValueError(f"Frozen fresh fixture differs: {filename}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify frozen bytes without writing")
    options = parser.parse_args()
    if options.check:
        check()
        print(f"Verified {len(EXPECTED)} fresh synthetic PDFs")
        return 0
    for filename, content in rendered_documents().items():
        (DIRECTORY / filename).write_bytes(content)
        print(f"Generated {filename}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
