# 見出し画像 制作・検証記録

作成日: 2026-08-23（JST）  
状態: `preview_only_unapproved / unpublished`

## 成果物

- ファイル: `assets/note-cover-night-handoff-7day.png`
- 実寸: 1733×907px
- 比率: 約1.911:1（note推奨1280×670pxとほぼ同じ比率）
- 用途: 有料noteの見出し画像候補
- ALT: 「夜の引き継ぎ7日キット。2人の養育者が記録を受け渡し、7日分のカードを確認する抽象図。」

note推奨値より大きい同等比率のPNGであり、アップロード先で縮小される前提。公開・アップロードは実施していない。

## 採用理由

- 商品価値の「2人の養育者」「記録の受け渡し」「7日運用」を一枚で表す。
- 赤ちゃんの寝顔・寝具を使わず、睡眠改善商品との誤認と安全でない寝床表現を避ける。
- 「睡眠改善」「夜泣き解決」等ではなく、機能主張の「記録・共有・朝3分」だけを表示する。
- 深いネイビー、白、ミント、暖色の月に限定し、警告・医療・恐怖訴求を避ける。
- 主要情報を中央に置き、サムネイル縮小時にも商品名を先に読めるようにする。

## 生成プロンプト

```text
Create a finished Japanese note.com paid-article cover image as a wide 1280×670 px banner (approximately 1.91:1), crisp professional editorial flat-vector design, not a mockup. Deep navy-to-indigo subtle gradient background with warm ivory-white typography, a small warm-gold crescent moon, a mint arrow showing handoff between two simple gender-neutral caregiver icons, and seven small vertical calendar/log cards. The visual concept is night-time information handoff and a practical toolkit, not baby sleep improvement. Keep every important element inside the central 80% safe area with generous negative space and excellent thumbnail readability.

Render ONLY these exact Japanese text lines, spelled exactly, with no other text:
Top small label: 「生後1〜3か月／2人以上の養育者へ」
Large main title on two lines: 「夜の引き継ぎ」 then 「7日キット」
Bottom small label: 「記録・共有・朝3分」

Use a clean bold Japanese gothic sans-serif typeface, very high contrast, precise kerning, no decorative script. Main title must dominate. Use a calm, trustworthy, practical tone; sophisticated but friendly. Avoid gender stereotypes. Do NOT show a baby, crib, bed, pillow, blanket, sleeping person, feeding bottle, medical monitor, heart-rate line, red cross, doctor, stethoscope, warning badge, sales badge, coins, money, or claims such as sleep improvement. No logos, no watermark, no extra captions, no tiny illegible text.
```

## 目視QA

- [x] 上部「生後1〜3か月／2人以上の養育者へ」が読める
- [x] 主見出し「夜の引き継ぎ」「7日キット」が正確
- [x] 下部「記録・共有・朝3分」が正確
- [x] 2人の人物は性別役割を固定しない抽象表現
- [x] 7日分のカードが視覚的に分かる
- [x] 寝床、添い寝、睡眠状態、医療UI、収益表示がない。カード内の小アイコンは人物が何かを抱く図にも見えるため、「乳児を一切描いていない」とは断定しない
- [x] 睡眠・医療・安全・収益の効果保証がない
- [x] ロゴ、透かし、余計な文言がない
- [ ] note実画面のサムネイル／記事上部／SNS切り抜きで確認（公開操作を行わないため未実施）

## 限界

- この画像がクリック率・購入率を高める直接データはない。
- note上の表示面による切り抜きは、実際の下書きプレビューで将来確認が必要。
- 7枚カードの3枚目にある小アイコンは、養育者が乳児を抱く図にも見える。ただし寝床、添い寝、睡眠状態や安全な抱き方を示す図ではなく、効果・安全の根拠には使わない。
- 画像の採用は記事の正確性、安全性、有料価値を保証しない。

## 価格・対象再評価後の再確認

再確認日: 2026-08-23（JST）

- [x] 画像内に旧価格780円、次価格980円その他の価格表示がなく、初期500円への変更と矛盾しない
- [x] 「2人以上の養育者」は勤務・育休状態を描写しておらず、両方育休を条件とする表現ではない
- [x] 生後1〜3か月は著者の一次経験範囲および現行の主対象と一致する
- [x] 3分は利用手順の負荷としてのみ表示され、価格や効果の根拠として表現されていない

したがって再生成は行わない。片方が就労中でも対象になり得ることは、画像へ文字を増やさず無料部本文で明記する。

## 本文用3ステップ図

- ファイル: `assets/article-flow-night-handoff-3steps.png`
- 実寸: 1560×1008px
- 用途: 無料部で商品フローを購入前に示す
- ALT: 「夜間の対応を記録し、次の養育者へ渡し、翌朝3分で見直す3ステップ。記録できた範囲だけを確認する。」

表示文言は「夜間の3ステップ」「1 記録する」「2 次の人へ渡す」「3 翌朝3分で見直す」「記録できた範囲で確認」の5つだけ。赤ちゃん、寝床、医療UI、効果保証を使わず、商品機能だけを図示した。

### 目視QA

- [x] 5つの日本語が正確で、余計な疑似文字がない
- [x] 3ステップが左から右へ追える
- [x] 2人の人物は性別役割を固定しない抽象表現
- [x] 記録できなかった部分を推測で埋める表現がない
- [x] 睡眠改善、医療判断、安全保証の表現がない
- [ ] note幅620px相当の実機表示確認（公開操作を行わないため未実施）
