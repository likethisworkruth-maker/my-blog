#!/usr/bin/env python3
"""Generate the offline 700-yen value-assessment preview from the source draft."""

from __future__ import annotations

from pathlib import Path

from markdown_it import MarkdownIt


HERE = Path(__file__).resolve().parent
SOURCE = HERE / "02-paid-note-draft.md"
OUTPUT = HERE / "11-paid-note-preview.html"
PAYWALL = "# ここから先は有料部分です"


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    if not source.startswith("preview_only_unapproved / unpublished"):
        raise ValueError("source draft is not marked preview-only/unpublished")
    if source.count(PAYWALL) != 1:
        raise ValueError("expected exactly one paid-content boundary")

    visible_source = source.split("\n", 1)[1].lstrip()
    free_markdown, paid_markdown = visible_source.split(PAYWALL)
    markdown = (
        MarkdownIt("commonmark", {"html": True, "linkify": False})
        .enable("table")
        .enable("strikethrough")
    )
    free_html = markdown.render(free_markdown)
    paid_html = markdown.render(paid_markdown.lstrip("-\n "))
    article_chars = len(visible_source)
    paid_chars = len(paid_markdown)

    template = """<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>700円価値評価プレビュー｜夜の引き継ぎ7日キット</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #162c32;
      --muted: #60757b;
      --paper: #fffefa;
      --canvas: #f1eee7;
      --line: #d9ded9;
      --night: #173841;
      --night-soft: #2b5660;
      --mint: #dceee5;
      --mint-strong: #6ba786;
      --sun: #f2a95e;
      --sun-soft: #fff1df;
      --danger-soft: #fff2ef;
      --shadow: 0 18px 45px rgba(26, 49, 54, 0.12);
      --radius: 18px;
    }

    * { box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      background:
        radial-gradient(circle at 10% 0%, rgba(242, 169, 94, 0.16), transparent 28rem),
        radial-gradient(circle at 90% 10%, rgba(107, 167, 134, 0.14), transparent 32rem),
        var(--canvas);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Yu Gothic UI",
        "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
      line-height: 1.85;
      text-rendering: optimizeLegibility;
    }

    a { color: #17687a; text-underline-offset: 0.18em; }
    a:hover { color: #0f4d5b; }
    button, input { font: inherit; }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.65rem max(1rem, calc((100vw - 1180px) / 2));
      color: white;
      background: rgba(23, 56, 65, 0.96);
      border-bottom: 1px solid rgba(255,255,255,0.15);
      backdrop-filter: blur(12px);
    }

    .topbar strong { font-size: 0.9rem; letter-spacing: 0.04em; }
    .topbar nav { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .topbar a {
      color: white;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 999px;
      padding: 0.25rem 0.65rem;
      font-size: 0.75rem;
      text-decoration: none;
    }

    .hero {
      max-width: 1180px;
      margin: 0 auto;
      padding: 3.2rem 1.25rem 1.8rem;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0 0 0.8rem;
      color: var(--night-soft);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .eyebrow::before {
      content: "";
      width: 2.2rem;
      height: 2px;
      background: var(--sun);
    }

    .hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
      gap: 2rem;
      align-items: end;
    }

    .hero h1 {
      max-width: 16em;
      margin: 0;
      font-size: clamp(2rem, 4.3vw, 4.2rem);
      line-height: 1.13;
      letter-spacing: -0.035em;
    }

    .hero-copy {
      max-width: 52rem;
      margin: 1.2rem 0 0;
      color: #486269;
      font-size: 1rem;
    }

    .price-card {
      position: relative;
      overflow: hidden;
      padding: 1.35rem;
      color: white;
      background: var(--night);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }

    .price-card::after {
      content: "7";
      position: absolute;
      right: -0.15em;
      bottom: -0.48em;
      color: rgba(255,255,255,0.06);
      font: 900 12rem/1 Georgia, serif;
    }

    .price-label {
      display: block;
      color: #bbd9cd;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
    }

    .price {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      margin: 0.3rem 0 0.6rem;
      font-weight: 900;
    }

    .price strong { font-size: 3.4rem; line-height: 1; }
    .price span { font-size: 1.1rem; }
    .price-card p { position: relative; z-index: 1; margin: 0; font-size: 0.82rem; }

    .notice {
      max-width: 1180px;
      margin: 0 auto 1.5rem;
      padding: 0 1.25rem;
    }

    .notice-inner {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.75rem;
      align-items: start;
      padding: 1rem 1.15rem;
      background: var(--sun-soft);
      border: 1px solid #eccb9f;
      border-radius: 14px;
      font-size: 0.86rem;
    }

    .notice-badge {
      display: inline-block;
      padding: 0.18rem 0.5rem;
      color: #6a4218;
      background: #ffd7a4;
      border-radius: 999px;
      font-weight: 800;
      white-space: nowrap;
    }

    .notice p { margin: 0; }

    .product-summary {
      max-width: 1180px;
      margin: 0 auto 1.7rem;
      padding: 0 1.25rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      overflow: hidden;
      background: rgba(255,255,255,0.86);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: 0 10px 28px rgba(26,49,54,0.07);
    }

    .summary-item { padding: 1.05rem; border-right: 1px solid var(--line); }
    .summary-item:last-child { border-right: 0; }
    .summary-item small {
      display: block;
      margin-bottom: 0.2rem;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
    }
    .summary-item strong { display: block; font-size: 0.94rem; line-height: 1.5; }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 800px) 300px;
      gap: 1.6rem;
      align-items: start;
      max-width: 1180px;
      margin: 0 auto;
      padding: 0 1.25rem 5rem;
    }

    .article-card {
      overflow: hidden;
      background: var(--paper);
      border: 1px solid rgba(22,44,50,0.08);
      border-radius: 24px;
      box-shadow: var(--shadow);
    }

    .article-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 1rem 1.3rem;
      color: var(--muted);
      background: #fbfaf5;
      border-bottom: 1px solid var(--line);
      font-size: 0.76rem;
    }

    .article-meta span {
      padding: 0.15rem 0.52rem;
      background: white;
      border: 1px solid var(--line);
      border-radius: 999px;
    }

    .prose { padding: clamp(1.25rem, 4vw, 3.4rem); }

    .prose > :first-child { margin-top: 0; }
    .prose h1 {
      margin: 2.1rem 0 0.9rem;
      font-size: clamp(1.75rem, 4vw, 2.65rem);
      line-height: 1.3;
      letter-spacing: -0.025em;
    }
    .prose h2 {
      margin: 3rem 0 0.9rem;
      padding-top: 0.2rem;
      font-size: clamp(1.35rem, 3vw, 1.75rem);
      line-height: 1.45;
      letter-spacing: -0.015em;
    }
    .prose h3 {
      margin: 2.2rem 0 0.6rem;
      font-size: 1.08rem;
      line-height: 1.55;
    }
    .prose p { margin: 0.9rem 0; }
    .prose ul, .prose ol { padding-left: 1.35rem; }
    .prose li { margin: 0.42rem 0; }
    .prose hr {
      width: 4rem;
      margin: 3rem auto;
      border: 0;
      border-top: 3px solid var(--mint);
    }
    .prose blockquote {
      margin: 1.4rem 0;
      padding: 0.85rem 1.05rem;
      background: #eff7f3;
      border-left: 4px solid var(--mint-strong);
      border-radius: 0 10px 10px 0;
    }
    .prose blockquote p { margin: 0; }
    .prose strong { color: #123b45; }
    .prose img {
      display: block;
      width: 100%;
      height: auto;
      margin: 1.3rem auto;
      border: 1px solid var(--line);
      border-radius: 15px;
      box-shadow: 0 9px 24px rgba(26,49,54,0.09);
    }
    .prose table {
      display: block;
      width: 100%;
      max-width: 100%;
      margin: 1rem 0 1.5rem;
      overflow-x: auto;
      border-spacing: 0;
      border-collapse: collapse;
      font-size: 0.84rem;
    }
    .prose th, .prose td {
      min-width: 8rem;
      padding: 0.65rem 0.72rem;
      text-align: left;
      vertical-align: top;
      border: 1px solid var(--line);
    }
    .prose th { background: #ecf3ef; }
    .prose code {
      padding: 0.12em 0.32em;
      background: #edf1ef;
      border-radius: 4px;
      font-size: 0.87em;
      overflow-wrap: anywhere;
    }
    .prose pre {
      overflow-x: auto;
      padding: 1rem;
      color: #e8f4ee;
      background: #18363e;
      border-radius: 12px;
      line-height: 1.65;
    }
    .prose pre code { padding: 0; color: inherit; background: transparent; }

    .paywall {
      position: relative;
      padding: 2.2rem clamp(1.2rem, 4vw, 3rem);
      text-align: center;
      background:
        linear-gradient(135deg, rgba(220,238,229,0.9), rgba(255,241,223,0.92)),
        white;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .paywall::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image: radial-gradient(rgba(23,56,65,0.08) 1px, transparent 1px);
      background-size: 18px 18px;
      mask-image: linear-gradient(to bottom, black, transparent);
    }

    .paywall-content { position: relative; max-width: 38rem; margin: 0 auto; }
    .paywall-label {
      display: inline-block;
      padding: 0.22rem 0.7rem;
      color: white;
      background: var(--night);
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.06em;
    }
    .paywall h2 { margin: 0.85rem 0 0.4rem; font-size: 1.65rem; }
    .paywall p { margin: 0.5rem 0; color: #425f66; }

    .kit-links {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.55rem;
      margin: 1.1rem 0;
      text-align: left;
    }

    .kit-links a {
      display: block;
      padding: 0.65rem 0.75rem;
      color: var(--ink);
      background: rgba(255,255,255,0.86);
      border: 1px solid rgba(22,44,50,0.14);
      border-radius: 9px;
      font-size: 0.76rem;
      font-weight: 700;
      text-decoration: none;
    }

    .kit-links a:hover { border-color: var(--mint-strong); transform: translateY(-1px); }

    .reveal-button, .collapse-button {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 3.2rem;
      padding: 0.8rem 1.3rem;
      color: white;
      background: var(--night);
      border: 0;
      border-radius: 999px;
      box-shadow: 0 8px 20px rgba(23,56,65,0.22);
      cursor: pointer;
      font-weight: 800;
    }
    .reveal-button:hover, .collapse-button:hover { background: #24535f; }
    .reveal-note { display: block; margin-top: 0.55rem; color: var(--muted); font-size: 0.72rem; }

    .paid-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.8rem 1.2rem;
      color: white;
      background: var(--night);
    }
    .paid-banner strong { font-size: 0.85rem; }
    .collapse-button {
      min-height: 2.2rem;
      padding: 0.35rem 0.8rem;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.38);
      box-shadow: none;
      font-size: 0.72rem;
    }

    [hidden] { display: none !important; }

    .evaluation {
      position: sticky;
      top: 4.5rem;
      padding: 1.1rem;
      background: rgba(255,254,250,0.96);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: 0 12px 28px rgba(26,49,54,0.09);
      backdrop-filter: blur(8px);
    }

    .evaluation h2 { margin: 0; font-size: 1.05rem; }
    .evaluation-intro { margin: 0.3rem 0 0.9rem; color: var(--muted); font-size: 0.74rem; }

    .criterion {
      display: grid;
      grid-template-columns: 1.15rem 1fr;
      gap: 0.55rem;
      align-items: start;
      padding: 0.65rem 0;
      border-top: 1px solid #e7e9e4;
      cursor: pointer;
      font-size: 0.78rem;
      line-height: 1.55;
    }
    .criterion input { width: 1rem; height: 1rem; margin-top: 0.18rem; accent-color: var(--mint-strong); }

    .score-box {
      margin-top: 0.8rem;
      padding: 0.8rem;
      background: #eef5f1;
      border-radius: 10px;
      text-align: center;
    }
    .score-box strong { display: block; font-size: 1rem; }
    .score-box span { display: block; margin-top: 0.2rem; color: var(--muted); font-size: 0.68rem; }

    .verdict-label { margin: 1rem 0 0.45rem; font-size: 0.75rem; font-weight: 800; }
    .verdicts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }
    .verdicts button {
      padding: 0.48rem 0.2rem;
      color: var(--ink);
      background: white;
      border: 1px solid var(--line);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.68rem;
      font-weight: 700;
    }
    .verdicts button[aria-pressed="true"] {
      color: white;
      background: var(--night);
      border-color: var(--night);
    }

    .privacy {
      margin: 0.75rem 0 0;
      color: var(--muted);
      font-size: 0.65rem;
      line-height: 1.5;
    }

    .source-note {
      margin-top: 1rem;
      padding-top: 0.8rem;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.68rem;
    }

    .mobile-eval-link { display: none; }

    footer {
      padding: 2rem 1rem 3rem;
      color: var(--muted);
      text-align: center;
      font-size: 0.72rem;
    }

    @media (max-width: 940px) {
      .hero-grid, .layout { grid-template-columns: 1fr; }
      .hero h1 { max-width: 19em; }
      .price-card { max-width: 32rem; }
      .evaluation { position: static; }
      .summary-grid { grid-template-columns: 1fr 1fr; }
      .summary-item:nth-child(2) { border-right: 0; }
      .summary-item:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
      .mobile-eval-link { display: inline-flex; }
    }

    @media (max-width: 620px) {
      .topbar { align-items: flex-start; }
      .topbar nav a:not(.mobile-eval-link) { display: none; }
      .hero { padding-top: 2.2rem; }
      .summary-grid { grid-template-columns: 1fr; }
      .summary-item {
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }
      .summary-item:last-child { border-bottom: 0; }
      .notice-inner { grid-template-columns: 1fr; }
      .prose { padding: 1.2rem; }
      .prose h2 { margin-top: 2.3rem; }
      .kit-links { grid-template-columns: 1fr; }
      .paid-banner { align-items: flex-start; flex-direction: column; }
      .price strong { font-size: 3rem; }
    }

    @media print {
      body { background: white; }
      .topbar, .evaluation, .reveal-button, .collapse-button, .reveal-note { display: none !important; }
      .hero, .notice, .product-summary, .layout { max-width: none; padding-left: 0; padding-right: 0; }
      .layout { display: block; }
      .article-card { border: 0; box-shadow: none; }
      #paid-content { display: block !important; }
      .paywall { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <strong>非公開・700円価値評価プレビュー</strong>
    <nav aria-label="プレビュー内ナビゲーション">
      <a href="#free-content">無料部分</a>
      <a href="#value-gate">有料境界</a>
      <a href="#evaluation" class="mobile-eval-link">評価</a>
    </nav>
  </header>

  <section class="hero" aria-labelledby="preview-title">
    <p class="eyebrow">LunaMAX final preview</p>
    <div class="hero-grid">
      <div>
        <h1 id="preview-title">この内容に、700円の価値があるか。</h1>
        <p class="hero-copy">
          「夜間育児の記録・引き継ぎ7日キット」の無料範囲、有料境界、
          購入後全文、実ファイル4点を同じ画面で確認するための評価用HTMLです。
        </p>
      </div>
      <aside class="price-card" aria-label="評価用価格">
        <span class="price-label">VALUE ASSESSMENT PRICE</span>
        <div class="price"><strong>700</strong><span>円</span></div>
        <p>決済・販売設定はありません。価格を700円と仮定し、内容だけを評価します。</p>
      </aside>
    </div>
  </section>

  <section class="notice">
    <div class="notice-inner">
      <span class="notice-badge">価格の扱い</span>
      <p>
        本文の現行意思決定は「初期500円」です。このHTMLは、その判断を改ざんせず、
        あなたが700円で買う価値を感じるか比較するための別シナリオです。
        700円を正当化する販売実績はまだなく、ここでの評価も市場検証にはなりません。
      </p>
    </div>
  </section>

  <section class="product-summary" aria-label="商品要約">
    <div class="summary-grid">
      <div class="summary-item">
        <small>主対象</small>
        <strong>生後1〜3か月・2人以上で夜／朝に引き継ぐ家庭</strong>
      </div>
      <div class="summary-item">
        <small>得られるもの</small>
        <strong>7日ログ、翌朝レビュー、引き継ぎ、設定確認の4点</strong>
      </div>
      <div class="summary-item">
        <small>使い方</small>
        <strong>夜は最小記録、翌朝3分、7日目に継続を判断</strong>
      </div>
      <div class="summary-item">
        <small>含まれないもの</small>
        <strong>睡眠改善保証、医療判断、個別相談、専用アプリ</strong>
      </div>
    </div>
  </section>

  <main class="layout">
    <article class="article-card" aria-label="有料note原稿プレビュー">
      <div class="article-meta">
        <span>原稿Markdown __ARTICLE_CHARS__字</span>
        <span>有料部Markdown __PAID_CHARS__字（記号等含む）</span>
        <span>付録4点</span>
        <span>preview only</span>
        <span>unpublished</span>
      </div>
      <section id="free-content" class="prose">
__FREE_HTML__
      </section>

      <section id="value-gate" class="paywall" aria-labelledby="gate-title">
        <div class="paywall-content">
          <span class="paywall-label">ここから有料部分</span>
          <h2 id="gate-title">700円で受け取る内容を確認する</h2>
          <p>7日運用の全手順、条件別の交代設計、会話例、架空の記入例、判定表と実ファイル4点です。</p>
          <div class="kit-links" aria-label="付録ファイル">
            <a href="./kit/01-seven-day-night-log.csv" download>7日夜間ログ CSV・2,431 B</a>
            <a href="./kit/02-seven-day-review.csv" download>翌朝レビュー CSV・612 B</a>
            <a href="./kit/03-handoff-card.md" download>引き継ぎカード MD・756 B</a>
            <a href="./kit/04-setup-privacy-checklist.md" download>設定確認 MD・1,486 B</a>
          </div>
          <small class="reveal-note">評価用のため、付録リンクはこの画面から直接開けます。このHTMLはアクセス制御されたpaywallではなく、公開販売面へは流用できません。</small>
          <button id="reveal-paid" class="reveal-button" type="button" aria-expanded="false" aria-controls="paid-content">
            購入後の全文を表示（評価用）
          </button>
          <small class="reveal-note">決済は発生しません。ローカルHTML内で表示を切り替えるだけです。</small>
        </div>
      </section>

      <section id="paid-content" hidden>
        <div class="paid-banner">
          <strong>購入後プレビューを表示中｜評価用・未販売</strong>
          <button id="collapse-paid" class="collapse-button" type="button">有料境界へ戻る</button>
        </div>
        <div class="prose">
__PAID_HTML__
        </div>
      </section>
    </article>

    <aside id="evaluation" class="evaluation" aria-labelledby="evaluation-title">
      <h2 id="evaluation-title">700円の価値チェック</h2>
      <p class="evaluation-intro">内容を見たあと、満たす項目だけチェックしてください。</p>

      <label class="criterion">
        <input type="checkbox" data-value-check>
        <span>対象・対象外と、解決する問題が無料部分だけで分かる</span>
      </label>
      <label class="criterion">
        <input type="checkbox" data-value-check>
        <span>付録4点を実際に開き、家庭で使える具体性がある</span>
      </label>
      <label class="criterion">
        <input type="checkbox" data-value-check>
        <span>無料アプリの記録機能だけでは足りない「引き継ぎ運用」がある</span>
      </label>
      <label class="criterion">
        <input type="checkbox" data-value-check>
        <span>有料部が無料部の繰り返しではなく、今夜から実行できる</span>
      </label>
      <label class="criterion">
        <input type="checkbox" data-value-check>
        <span>安全境界・非保証・利用条件が明確で、誤解しにくい</span>
      </label>

      <div class="score-box" aria-live="polite">
        <strong id="score-text">0 / 5｜まだ評価前</strong>
        <span>4〜5: 主観的に内容価値あり、3: 改善後に再評価、0〜2: 700円では不足</span>
      </div>

      <p class="verdict-label">あなたの最終判定</p>
      <div class="verdicts" role="group" aria-label="最終判定">
        <button type="button" data-verdict="buy" aria-pressed="false">買う</button>
        <button type="button" data-verdict="maybe" aria-pressed="false">迷う</button>
        <button type="button" data-verdict="no" aria-pressed="false">買わない</button>
      </div>
      <p id="verdict-output" class="privacy" aria-live="polite">未選択</p>
      <p class="privacy">入力はこのページ内だけで変化し、保存・送信されません。</p>
      <p class="source-note">
        価格の市場妥当性は、この主観評価だけでは確定しません。
        実販売前は5家庭の使用性確認、販売後は適格PV・購入率・返金・利用回答で検証します。
      </p>
    </aside>
  </main>

  <footer>
    LunaMAX成果物プレビュー｜生成元: 02-paid-note-draft.md｜非公開・購入不可
  </footer>

  <script>
    (function () {
      var paid = document.getElementById("paid-content");
      var reveal = document.getElementById("reveal-paid");
      var collapse = document.getElementById("collapse-paid");

      reveal.addEventListener("click", function () {
        paid.hidden = false;
        reveal.setAttribute("aria-expanded", "true");
        paid.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      collapse.addEventListener("click", function () {
        paid.hidden = true;
        reveal.setAttribute("aria-expanded", "false");
        document.getElementById("value-gate").scrollIntoView({ behavior: "smooth", block: "center" });
      });

      var checks = Array.from(document.querySelectorAll("[data-value-check]"));
      var score = document.getElementById("score-text");
      function updateScore() {
        var count = checks.filter(function (input) { return input.checked; }).length;
        var label = count >= 4 ? "主観的に700円の内容価値あり" : count === 3 ? "改善後に再評価" : count === 0 ? "まだ評価前" : "700円では内容価値が不足";
        score.textContent = count + " / 5｜" + label;
      }
      checks.forEach(function (input) { input.addEventListener("change", updateScore); });

      var verdicts = Array.from(document.querySelectorAll("[data-verdict]"));
      var verdictOutput = document.getElementById("verdict-output");
      var labels = { buy: "判定: 700円なら買う", maybe: "判定: 700円では迷う", no: "判定: 700円では買わない" };
      verdicts.forEach(function (button) {
        button.addEventListener("click", function () {
          verdicts.forEach(function (item) { item.setAttribute("aria-pressed", "false"); });
          button.setAttribute("aria-pressed", "true");
          verdictOutput.textContent = labels[button.dataset.verdict];
        });
      });
    })();
  </script>
</body>
</html>
"""

    html = (
        template.replace("__ARTICLE_CHARS__", f"{article_chars:,}")
        .replace("__PAID_CHARS__", f"{paid_chars:,}")
        .replace("__FREE_HTML__", free_html.rstrip())
        .replace("__PAID_HTML__", paid_html.rstrip())
    )
    OUTPUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"generated: {OUTPUT}")
    print(f"source chars: {article_chars:,}; paid chars: {paid_chars:,}")


if __name__ == "__main__":
    main()
