#!/usr/bin/env python3
"""LunaMAX有料note成果物の読み取り専用・再現可能な完了監査。"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
import struct
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


HERE = Path(__file__).resolve().parent
ARTICLE = HERE / "02-paid-note-draft.md"
LEDGER = HERE / "01-decision-ledger.md"
LAYOUT = HERE / "03-layout-and-cover-brief.md"
COVER_RECORD = HERE / "04-cover-image-record.md"
PREVIEW_GENERATOR = HERE / "generate_preview.py"
PREVIEW_HTML = HERE / "11-paid-note-preview.html"
KIT = HERE / "kit"
DB = Path(r"D:\mycode\childcare-data-aggregator-data\note-research.sqlite3")
REFERENCE = Path(
    r"D:\mycode\childcare-data-aggregator-data\note-reference-sources\note.jp"
    r"\n8522197d1ced\2026-08-23.reference.json"
)
REFERENCE_URL = "https://note.jp/n/n8522197d1ced"
REFERENCE_SHA256 = "aa72870b67d8a9ecec64f00dffc899b8d87e957dfcf3222034ff0de04f2ddc36"


checks: list[dict[str, object]] = []


class PreviewParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: set[str] = set()
        self.images: list[str] = []
        self.links: list[str] = []
        self.external_scripts: list[str] = []
        self.meta_robots = ""
        self.paid_hidden = False
        self.value_checks = 0
        self.verdicts = 0
        self.text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.ids.add(element_id)
        if tag == "img" and values.get("src"):
            self.images.append(values["src"] or "")
        if tag == "a" and values.get("href"):
            self.links.append(values["href"] or "")
        if tag == "script" and values.get("src"):
            self.external_scripts.append(values["src"] or "")
        if tag == "meta" and values.get("name") == "robots":
            self.meta_robots = values.get("content") or ""
        if element_id == "paid-content" and "hidden" in values:
            self.paid_hidden = True
        if tag == "input" and "data-value-check" in values:
            self.value_checks += 1
        if tag == "button" and "data-verdict" in values:
            self.verdicts += 1

    def handle_data(self, data: str) -> None:
        self.text.append(data)


def record(name: str, ok: bool, detail: str = "") -> None:
    checks.append({"name": name, "ok": bool(ok), "detail": detail})


def read_utf8(path: Path) -> str:
    try:
        value = path.read_text(encoding="utf-8")
    except Exception as exc:  # pragma: no cover - diagnostic branch
        record(f"utf8:{path.name}", False, repr(exc))
        return ""
    record(f"utf8:{path.name}", True, f"{len(value)} chars")
    return value


def png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        signature = handle.read(24)
    if len(signature) != 24 or signature[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")
    return struct.unpack(">II", signature[16:24])


def verify_markdown() -> None:
    article = read_utf8(ARTICLE)
    ledger = read_utf8(LEDGER)
    layout = read_utf8(LAYOUT)
    cover = read_utf8(COVER_RECORD)
    kit_readme = read_utf8(KIT / "README.md")

    current_docs = {
        "article": article,
        "ledger": ledger,
        "layout": layout,
        "cover_record": cover,
    }
    for label, body in current_docs.items():
        record(
            f"{label}:500円",
            "500円" in body,
            "current decision artifact contains 500円",
        )

    record(
        "article:current-price",
        "検証開始価格：**500円**" in article,
        "500円 is explicitly labeled as the test-start price",
    )
    record(
        "article:no-current-780",
        not re.search(r"(?:検証開始価格|現在価格|販売価格)[^\n]{0,20}780円", article),
        "780円 must appear only as a gated future-cohort candidate",
    )
    record(
        "article:no-980",
        "980円" not in article,
        "old future price is absent",
    )
    record(
        "article:gated-780",
        all(
            token in article
            for token in (
                "780円は",
                "1,000適格PV",
                "20購入以上",
                "CVR 2%以上",
                "返金申請率5%以下",
                "10件以上の利用回答",
                "ファイルを開けた割合90%以上",
                "満足80%以上",
                "安全問題0件",
                "5家庭での使用性確認",
                "すべて満たした場合",
                "次の独立したコホート",
            )
        ),
        "780円 is gated by all predefined criteria",
    )
    record(
        "article:conditional-300",
        all(
            token in article
            for token in (
                "300円は",
                "購入5件未満",
                "10件以上集めた非購入理由",
                "30%以上が価格を主因",
                "別コホート",
            )
        ),
        "300円 is only a conditional counter-test",
    )
    record(
        "article:audience-not-both-on-leave",
        "2人とも育休中である必要はない" in article
        and "片方が就労中" in article,
        "employment/leave status does not over-restrict the audience",
    )
    record(
        "article:three-minutes-not-price",
        "時間を価格へ換算して500円としたわけではありません" in article
        and "3分は利用負荷を抑えるための設計" in article,
        "usage friction and price hypothesis are separated",
    )
    record(
        "article:unpublished",
        article.startswith("preview_only_unapproved / unpublished"),
        "draft is visibly marked preview-only and unpublished",
    )

    paywall_marker = "# ここから先は有料部分です"
    record(
        "article:one-paywall",
        article.count(paywall_marker) == 1,
        f"count={article.count(paywall_marker)}",
    )
    paywall = article.find(paywall_marker)
    safety_terms = ("必ず無料で読んでほしい安全情報", "#8000", "119")
    record(
        "article:safety-before-paywall",
        paywall >= 0 and all(0 <= article.find(term) < paywall for term in safety_terms),
        "safety, #8000 and 119 are accessible in the free section",
    )

    for filename in (
        "01-seven-day-night-log.csv",
        "02-seven-day-review.csv",
        "03-handoff-card.md",
        "04-setup-privacy-checklist.md",
    ):
        path = KIT / filename
        expected = (
            f"`{filename}`（{path.stat().st_size:,}バイト）" if path.exists() else ""
        )
        record(
            f"article:kit-size:{filename}",
            path.exists() and expected in article,
            expected or "file missing",
        )

    for rel in (
        "./assets/note-cover-night-handoff-7day.png",
        "./assets/article-flow-night-handoff-3steps.png",
    ):
        record(
            f"article:image-ref:{rel}",
            rel in article and (HERE / rel).resolve().exists(),
            str((HERE / rel).resolve()),
        )

    record(
        "kit-readme:audience",
        "2人が同時に育休中である必要はなく" in kit_readme
        and "片方が就労中" in kit_readme,
        "kit instructions match the article audience",
    )
    record(
        "ledger:official-reference-flags",
        "favorite=1" in ledger and "importance=5" in ledger,
        "decision ledger records local favorite/importance flags",
    )


def verify_kit() -> None:
    for path in sorted(KIT.iterdir()):
        if path.is_file():
            read_utf8(path)

    csv_specs = {
        "01-seven-day-night-log.csv": (8, 28, 4),
        "02-seven-day-review.csv": (7, 7, 1),
    }
    for filename, (columns, rows, per_day) in csv_specs.items():
        path = KIT / filename
        with path.open("r", encoding="utf-8", newline="") as handle:
            table = list(csv.reader(handle))
        shape_ok = bool(table) and len(table[0]) == columns and len(table) - 1 == rows
        record(
            f"csv:shape:{filename}",
            shape_ok and all(len(row) == columns for row in table[1:]),
            f"columns={len(table[0]) if table else 0}, data_rows={max(len(table)-1, 0)}",
        )
        days = Counter(row[0] for row in table[1:] if row)
        expected_days = {f"Day {day}": per_day for day in range(1, 8)}
        record(
            f"csv:days:{filename}",
            dict(days) == expected_days,
            json.dumps(dict(days), ensure_ascii=False, sort_keys=True),
        )

    expected_pngs = {
        "note-cover-night-handoff-7day.png": (1733, 907),
        "article-flow-night-handoff-3steps.png": (1560, 1008),
    }
    for filename, expected in expected_pngs.items():
        path = HERE / "assets" / filename
        try:
            actual = png_dimensions(path)
        except Exception as exc:  # pragma: no cover - diagnostic branch
            actual = None
            detail = repr(exc)
        else:
            detail = f"actual={actual[0]}x{actual[1]}"
        record(f"png:{filename}", actual == expected, detail)


def verify_preview() -> None:
    record("preview:generator-exists", PREVIEW_GENERATOR.is_file(), str(PREVIEW_GENERATOR))
    record("preview:html-exists", PREVIEW_HTML.is_file(), str(PREVIEW_HTML))
    if not PREVIEW_HTML.is_file():
        return

    body = read_utf8(PREVIEW_HTML)
    parser = PreviewParser()
    parser.feed(body)
    visible_text = " ".join(" ".join(parser.text).split())

    record(
        "preview:document-shell",
        body.lstrip().lower().startswith("<!doctype html>")
        and '<html lang="ja">' in body
        and not re.search(r"__[A-Z_]+__", body),
        "doctype, Japanese language and resolved template tokens",
    )
    record(
        "preview:noindex",
        parser.meta_robots == "noindex,nofollow,noarchive",
        parser.meta_robots,
    )
    record(
        "preview:price-separation",
        "700円価値評価プレビュー" in visible_text
        and "本文の現行意思決定は「初期500円」です" in visible_text
        and "販売実績はまだなく" in visible_text,
        "700 yen is an assessment scenario; 500 yen remains the source decision",
    )
    expected_ids = {
        "free-content",
        "value-gate",
        "reveal-paid",
        "paid-content",
        "collapse-paid",
        "evaluation",
        "score-text",
        "verdict-output",
    }
    record(
        "preview:interactive-sections",
        expected_ids.issubset(parser.ids) and parser.paid_hidden,
        f"ids={len(parser.ids)}, paid_hidden={parser.paid_hidden}",
    )
    record(
        "preview:evaluation-controls",
        parser.value_checks == 5 and parser.verdicts == 3,
        f"checks={parser.value_checks}, verdicts={parser.verdicts}",
    )
    record(
        "preview:valuation-wording",
        "700円候補" not in visible_text
        and "主観的に内容価値あり" in visible_text
        and "order: -1" not in body,
        "subjective value is not presented as a validated market price",
    )
    record(
        "preview:not-a-real-paywall",
        "アクセス制御されたpaywallではなく" in visible_text
        and "公開販売面へは流用できません" in visible_text,
        "local kit links are explicitly evaluation-only",
    )
    record(
        "preview:no-external-script",
        not parser.external_scripts and "fetch(" not in body and "<form" not in body.lower(),
        f"external_scripts={parser.external_scripts}",
    )

    expected_images = {
        "./assets/note-cover-night-handoff-7day.png",
        "./assets/article-flow-night-handoff-3steps.png",
    }
    image_set = set(parser.images)
    images_exist = all((HERE / src).resolve().is_file() for src in expected_images)
    record(
        "preview:images",
        expected_images.issubset(image_set) and images_exist,
        json.dumps(sorted(image_set), ensure_ascii=False),
    )

    expected_kit_links = {
        "./kit/01-seven-day-night-log.csv",
        "./kit/02-seven-day-review.csv",
        "./kit/03-handoff-card.md",
        "./kit/04-setup-privacy-checklist.md",
    }
    link_set = set(parser.links)
    kit_links_exist = all((HERE / href).resolve().is_file() for href in expected_kit_links)
    record(
        "preview:kit-links",
        expected_kit_links.issubset(link_set) and kit_links_exist,
        json.dumps(sorted(expected_kit_links & link_set), ensure_ascii=False),
    )

    source_signals = (
        "Mamariの0〜4か月に関する8,755件",
        "検証開始価格を500円",
        "2人とも育休中である必要はない",
        "必ず無料で読んでほしい安全情報",
        "最初に：4点の付録をコピーする",
        "更新履歴",
    )
    missing = [signal for signal in source_signals if signal not in visible_text]
    record(
        "preview:source-content",
        not missing,
        "missing=" + json.dumps(missing, ensure_ascii=False),
    )


def verify_reference_db() -> None:
    record("db:exists", DB.is_file(), str(DB))
    record("reference-json:exists", REFERENCE.is_file(), str(REFERENCE))
    if not DB.is_file() or not REFERENCE.is_file():
        return

    uri = f"file:{DB.as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
        article_count = connection.execute("SELECT COUNT(*) FROM note_articles").fetchone()[0]
        rows = connection.execute(
            """
            SELECT favorite, importance, canonical_url, source_type,
                   verification_status, local_snapshot_path, snapshot_sha256
              FROM note_research_references
             WHERE canonical_url = ?
            """,
            (REFERENCE_URL,),
        ).fetchall()
    finally:
        connection.close()

    record("db:integrity", integrity == "ok", str(integrity))
    record("db:foreign-keys", not foreign_keys, f"errors={len(foreign_keys)}")
    record("db:article-count-unchanged", article_count == 100, f"count={article_count}")
    record("db:one-official-reference", len(rows) == 1, f"count={len(rows)}")
    if len(rows) != 1:
        return

    favorite, importance, url, source_type, verification, snapshot_path, snapshot_sha = rows[0]
    record("db:favorite", favorite == 1, f"favorite={favorite}")
    record("db:importance", importance == 5, f"importance={importance}")
    record("db:url", url == REFERENCE_URL, str(url))
    record("db:source-type", source_type == "official_platform_analysis", str(source_type))
    record("db:verification", verification == "verified_primary", str(verification))
    record("db:snapshot-path", Path(snapshot_path).resolve() == REFERENCE.resolve(), str(snapshot_path))

    actual_sha = hashlib.sha256(REFERENCE.read_bytes()).hexdigest()
    record(
        "reference-json:sha256",
        actual_sha == snapshot_sha == REFERENCE_SHA256,
        f"actual={actual_sha}, db={snapshot_sha}",
    )
    payload = json.loads(REFERENCE.read_text(encoding="utf-8"))
    record("reference-json:favorite", payload.get("favorite") is True, repr(payload.get("favorite")))
    record("reference-json:importance", payload.get("importance") == 5, repr(payload.get("importance")))
    record("reference-json:url", payload.get("url") == REFERENCE_URL, repr(payload.get("url")))
    record(
        "reference-json:classification",
        payload.get("source_type") == "official_platform_analysis"
        and payload.get("verification_status") == "verified_primary",
        f"{payload.get('source_type')}/{payload.get('verification_status')}",
    )


def main() -> int:
    verify_markdown()
    verify_kit()
    verify_preview()
    verify_reference_db()
    failed = [item for item in checks if not item["ok"]]
    report = {
        "status": "pass" if not failed else "fail",
        "checks": len(checks),
        "passed": len(checks) - len(failed),
        "failed": len(failed),
        "failures": failed,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
