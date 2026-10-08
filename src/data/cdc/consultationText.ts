export interface PreviousCategoryReview {
  ageKey: string;
  age: string;
  checked: string[];
  notYet: string[];
  unknown: string[];
}

export interface ConsultationCategory {
  title: string;
  checked: string[];
  notYet: string[];
  unknown: string[];
  previous?: PreviousCategoryReview;
}

const bullets = (items: string[]) => items.map(item => "・" + item).join("\n");

const cdcPageSlugs: Record<string, string> = {
  "2 mo": "2-months",
  "4 mo": "4-months",
  "6 mo": "6-months",
  "9 mo": "9-months",
  "1 year": "1-year",
  "15 mo": "15-months",
  "18 mo": "18-months",
  "2 years": "2-years",
  "30 mo": "30-months",
  "3 years": "3-years",
  "4 years": "4-years",
  "5 years": "5-years",
};

function cdcSources(ageKey: string, age: string, categories: ConsultationCategory[], ja: boolean): string {
  const ages = [{ key: ageKey, label: age }];
  categories.forEach(({ previous }) => {
    if (previous && !ages.some(item => item.key === previous.ageKey)) ages.push({ key: previous.ageKey, label: previous.age });
  });
  const links = ages.map(({ key, label }) => {
    const slug = cdcPageSlugs[key];
    if (!slug) throw new Error(`CDC milestone page is not defined for ${key}`);
    return `・${label}：https://www.cdc.gov/act-early/milestones/${slug}.html`;
  });
  return [ja ? "参照したCDC公式ページ（英語原文）" : "CDC source pages (English originals)", ...links].join("\n");
}

function doctorCategory(age: string, category: ConsultationCategory, ja: boolean): string {
  const { title, notYet, unknown, previous } = category;
  if (notYet.length === 0 && unknown.length === 0) return "";
  const lines = [ja ? `【${title}】` : `${title}:`];

  if (ja) {
    if (notYet.length) lines.push(`現時点でまだできない：${notYet.join("、")}`);
    if (unknown.length) lines.push(`未回答：${unknown.length}項目`);
    if (previous) {
      if (previous.notYet.length) lines.push(`${previous.age}時点の同分野の確認項目で、現在まだできない：${previous.notYet.join("、")}`);
      if (previous.unknown.length) lines.push(`${previous.age}時点の同分野の確認項目で未回答：${previous.unknown.length}項目`);
    }
  } else {
    if (notYet.length) lines.push(`Not yet able to do at ${age}: ${notYet.join("; ")}`);
    if (unknown.length) lines.push(`Not answered: ${unknown.length} items`);
    if (previous) {
      if (previous.notYet.length) lines.push(`Not yet able to do in the ${previous.age} checklist for this area: ${previous.notYet.join("; ")}`);
      if (previous.unknown.length) lines.push(`Not answered in the ${previous.age} checklist: ${previous.unknown.length} items`);
    }
  }
  return lines.join("\n");
}

function aiCategory(category: ConsultationCategory, ja: boolean): string {
  const { title, checked, notYet, unknown, previous } = category;
  const total = checked.length + notYet.length + unknown.length;
  const lines = ja
    ? [`【${title}】`, `${total}項目中、「できる」${checked.length}項目、「まだできない」${notYet.length}項目、未確認${unknown.length}項目です。`]
    : [`${title}:`, `${checked.length} of ${total} checked as able, ${notYet.length} marked not yet, ${unknown.length} not checked.`];
  if (checked.length) lines.push(ja ? "できると確認したこと：" : "Items marked as able:", bullets(checked));
  if (notYet.length) lines.push(ja ? "まだできないと確認したこと：" : "Items marked not yet:", bullets(notYet));
  if (unknown.length) lines.push(ja ? "未確認のこと：" : "Items not checked:", bullets(unknown));
  if (previous) {
    lines.push(ja ? `同分野の${previous.age}時点の確認項目（現在の様子を確認）：` : `Same area in the ${previous.age} checklist (reviewed using current observations):`);
    if (previous.checked.length) lines.push(ja ? "できる：" : "Able:", bullets(previous.checked));
    if (previous.notYet.length) lines.push(ja ? "まだできない：" : "Not yet:", bullets(previous.notYet));
    if (previous.unknown.length) lines.push(ja ? "未確認：" : "Not checked:", bullets(previous.unknown));
  }
  return lines.join("\n");
}

export function consultationText(ageKey: string, age: string, categories: ConsultationCategory[], language: "ja" | "en", audience: "doctor" | "ai"): string {
  const ja = language === "ja";
  const hasPrevious = categories.some(category => category.previous);
  const hasNotYet = categories.some(category => category.notYet.length > 0);
  const hasUnknown = categories.some(category => category.unknown.length > 0);
  const previousAge = categories.find(category => category.previous)?.previous?.age;
  const previousReviewContext = previousAge
    ? (ja
      ? `また、同じ分野の前の年齢（${previousAge}時点）の確認項目も、現在の様子について追加で確認しました。`
      : `I also reviewed the same areas in the earlier ${previousAge} checklist using my child's current observations.`)
    : "";
  const sources = cdcSources(ageKey, age, categories, ja);
  if (audience === "doctor") {
    const subject = ja ? `件名：子どもの発達についてのご相談（${age}）` : `Subject: Question about my child's development (${age})`;
    const salutation = ja ? "ご担当の先生へ" : "Dear clinician,";
    const intro = ja
      ? `子どもの発達についてご相談したく、ご連絡しました。子どもは現在${age}です。CDC（米国疾病予防管理センター）が公開する発達マイルストーンについて、このサイトの非公式な日本語訳を参考に、${age}の確認項目を家庭で確認しました。${previousReviewContext}`
      : `I would like to discuss my child's development. My child is currently ${age} old. I used an unofficial Japanese translation of the developmental milestones published by the CDC (U.S. Centers for Disease Control and Prevention) as a reference to review the ${age} checklist at home.${previousReviewContext ? " " + previousReviewContext : ""}`;
    const requests = ja
      ? [
          hasNotYet ? `${hasPrevious ? "前の年齢の同分野の確認結果も踏まえ、" : ""}「まだできない」と確認した項目について、家庭で見るとよい具体的な場面や様子、追加の評価や支援が必要か教えてください。` : "",
          hasUnknown ? "未回答の項目について、家庭でどのような機会や方法で確かめるとよいか教えてください。未回答は「まだできない」とは扱わないでください。" : "",
        ].filter(Boolean)
      : [
          hasNotYet ? `${hasPrevious ? "Taking the previous-age checklist into account, " : ""}for items marked not yet, what specific situations or behaviors should we observe at home, and might further assessment or support be useful?` : "",
          hasUnknown ? "For unanswered items, what opportunities or methods could we use to check them at home? Please do not treat unanswered items as skills the child cannot do." : "",
        ].filter(Boolean);
    const request = requests.join("\n\n");
    const closing = ja ? "お忙しいところ恐れ入りますが、よろしくお願いいたします。" : "Thank you for your guidance.";
    return [subject, salutation, intro, ...categories.map(category => doctorCategory(age, category, ja)).filter(Boolean), request, sources, closing].join("\n\n");
  }

  const intro = ja
    ? `子どもの発達について教えてください。子どもは現在${age}です。以下は、CDC（米国疾病予防管理センター）が公開する${age}の発達マイルストーンについて、このサイトの非公式な日本語訳を参考に、家庭で確認した結果です。${previousReviewContext}日本語訳とCDC英語原文に違いがあれば、原文を優先してください。`
    : `Please help me understand my child's development. My child is currently ${age} old. The observations below use an unofficial checklist based on developmental milestones published by the CDC (U.S. Centers for Disease Control and Prevention) for ${age}.${previousReviewContext ? " " + previousReviewContext : ""}`;
  const context = ja
    ? "「まだできない」は今回そう確認した項目で、未確認は試す機会がなかったり、判断できなかったりした項目です。未確認を「できない」と扱わないでください。"
    : "'Not yet' means I marked that the skill has not been observed. Unchecked items may not have been tried or may be uncertain; do not treat them as skills my child cannot do.";
  const aiQuestions = ja
    ? [
        hasNotYet ? "「まだできない」と回答した項目について、家庭で観察するとよい具体的な場面や様子、追加の評価や支援が必要か。" : "",
        hasUnknown ? "未回答の項目を「まだできない」と区別したうえで、家庭で確かめる機会や方法。" : "",
        hasPrevious ? "同じ分野の前の年齢の項目との違いを踏まえ、確認したいこと。" : "",
        "家庭で観察するときの具体的な場面と、保護者に確認したい質問。",
        "子どもの様子に合わせて、日々の遊びや関わりの中でできること。",
      ].filter(Boolean)
    : [
        hasNotYet ? "For items marked not yet, what specific situations or behaviors should we observe at home, and might further assessment or support be useful?" : "",
        hasUnknown ? "How can we check unanswered items at home, keeping them distinct from items marked not yet?" : "",
        hasPrevious ? "Questions informed by differences from the same area in the previous-age checklist." : "",
        "Specific everyday situations to observe and questions to ask the caregiver.",
        "Everyday play and interaction ideas suited to these observations.",
      ].filter(Boolean);
  const numberedQuestions = aiQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n");
  const request = ja
    ? `CDC公式ページの英語原文にある該当年齢・カテゴリを確認したうえで、次の点を整理してください。\n${numberedQuestions}\n\nCDCのページを閲覧できない場合は、その旨を明記して原文を推測しないでください。チェック数だけで発達の遅れ、病名、正常・異常を判定したり、カテゴリ間の優劣をつけたりしないでください。書かれていない子どもの様子を補わず、不明な点は質問してください。一般的な情報を示す場合は根拠となる公的な情報源を添え、確認できない情報源は作らないでください。`
    : `Review the relevant ages and categories in the English original on the CDC pages, then organize:\n${numberedQuestions}\n\nIf you cannot access the CDC pages, say so and do not guess their wording. Do not diagnose, label development as normal or abnormal, infer delays from counts, or rank categories. Do not invent observations. Ask about missing information. Cite verifiable public sources for general guidance and do not invent references.`;
  return [intro, (ja ? "子どもの現在の年齢：" : "Child's current age: ") + age, sources, context, ...categories.map(category => aiCategory(category, ja)), request].join("\n\n");
}
