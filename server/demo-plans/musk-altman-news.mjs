// Seeded public demo plan used when a run brief asks for the Musk/Altman news sample.
// Keeping it outside server/index.mjs prevents one demo topic from looking like core product logic.
const seededNewsDemoPattern = /马斯克|Musk|Elon|奥特曼|Altman|OpenAI/i

export function seededNewsDemoPlanForBrief(brief = "") {
  if (!seededNewsDemoPattern.test(String(brief))) return null
  return muskAltmanNewsPlan()
}

function muskAltmanNewsPlan() {
  const sharedEvidenceAssets = [
    {
      title: "Elon Musk public portrait evidence",
      url: "https://upload.wikimedia.org/wikipedia/commons/3/34/Elon_Musk_Royal_Society_%28crop2%29.jpg",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Elon_Musk_Royal_Society_(crop2).jpg",
      license: "CC BY-SA 3.0, Debbie Rowe via Wikimedia Commons",
      purpose: "人物识别与新闻解释素材。",
    },
    {
      title: "Sam Altman public portrait evidence",
      url: "https://upload.wikimedia.org/wikipedia/commons/8/83/Sam_Altman%2C_June_2023_%28GPOABG244%29_%28cropped%29.jpeg",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Sam_Altman,_June_2023_(GPOABG244)_(cropped).jpeg",
      license: "CC BY-SA 3.0, Amos Ben Gershom / GPO via Wikimedia Commons",
      purpose: "人物识别与新闻解释素材。",
    },
    {
      title: "Ronald V. Dellums Federal Building evidence",
      url: "https://upload.wikimedia.org/wikipedia/commons/7/74/Ronald_Dellums_Federal_Building.jpg",
      sourcePage: "https://commons.wikimedia.org/wiki/File:Ronald_Dellums_Federal_Building.jpg",
      license: "CC BY-SA 3.0 via Wikimedia Commons",
      purpose: "Oakland federal court context visual.",
    },
    {
      title: "Reuters / Al Jazeera Musk Altman trial combination photo",
      url: "https://www.aljazeera.com/wp-content/uploads/2026/04/reuters_69f261b5-1777492405.jpg?resize=1920%2C1280&quality=80",
      sourcePage: "https://www.aljazeera.com/economy/2026/4/29/musk-accuses-altman-of-betraying-openais-nonprofit-founding-mission",
      license: "Reuters news photo via Al Jazeera; license requires review for public redistribution",
      purpose: "直接新闻素材主图，展示 Sam Altman 与 Elon Musk 在庭审期间的组合照片。",
    },
    {
      title: "AP News OpenAI trial courthouse photo",
      url: "https://dims.apnews.com/dims4/default/911658a/2147483647/strip/true/crop/5449x3631+0+1/resize/980x653!/quality/90/?url=https%3A%2F%2Fassets.apnews.com%2F08%2Fb0%2Fd5385e1b8bf692e6bebc68ca390c%2Ff1b963ca2ccb4d09a5383c551921c702",
      sourcePage: "https://apnews.com/article/musk-altman-openai-nonprofit-trial-bdbe85d62c2b678458fe68148eb6fba5",
      license: "AP news photo; license requires review for public redistribution",
      purpose: "直接新闻素材主图，展示庭审现场/法院语境。",
    },
  ]
  return {
    kind: "seeded_news_demo",
    title: "Musk vs Altman / OpenAI conflict",
    researchPack: {
      topic: "Elon Musk 与 Sam Altman / OpenAI 的公开冲突",
      verificationStatus: "seeded_with_public_sources; Research Agent should refresh before public submission",
      sources: [
        {
          id: "src_ap_2026_05_01",
          title: "Elon Musk spars with OpenAI attorney in trial over company's evolution from a nonprofit",
          publisher: "Associated Press",
          url: "https://apnews.com/article/bdbe85d62c2b678458fe68148eb6fba5",
          accessed_at: "2026-05-01",
          type: "news",
          relevance: "Current trial framing and both sides' positions.",
        },
        {
          id: "src_reuters_2026_04_28",
          title: "OpenAI trial pitting Elon Musk against Sam Altman kicks off",
          publisher: "Reuters",
          url: "https://www.investing.com/news/stock-market-news/openai-trial-pitting-elon-musk-against-sam-altman-kicks-off-4640752",
          accessed_at: "2026-05-01",
          type: "news",
          relevance: "Trial start, venue, and central nonprofit-to-for-profit dispute.",
        },
        {
          id: "src_justia_2026_04_30",
          title: "Musk v. Altman et al court filing",
          publisher: "Justia / U.S. District Court",
          url: "https://cases.justia.com/federal/district-courts/california/candce/4%3A2024cv04722/433688/203/0.pdf",
          accessed_at: "2026-05-01",
          type: "court_filing",
          relevance: "Recent docket material for the live case.",
        },
      ],
      requiredVerification: [
        "Research Agent must verify current timeline with web/browser tools in a live run.",
        "If web verification is unavailable, mark the run as demo research and Quality Gate should expose that limitation.",
      ],
      keyFacts: [
        {
          id: "fact_01",
          claim: "2026 年 4 月底，Musk 与 OpenAI / Altman 的案件进入庭审阶段，核心围绕 OpenAI 从非营利使命到商业化结构的演变。",
          source_ids: ["src_ap_2026_05_01", "src_reuters_2026_04_28"],
          risk: "medium; requires current legal/news verification",
        },
        {
          id: "fact_02",
          claim: "Musk 一方长期指责 OpenAI 偏离早期非营利/开放使命。",
          source_ids: ["src_ap_2026_05_01", "src_reuters_2026_04_28"],
          risk: "medium; summarize allegation, do not present as court finding",
        },
        {
          id: "fact_03",
          claim: "Altman/OpenAI 一方主张商业合作和算力融资是扩展 AI 能力所需。",
          source_ids: ["src_ap_2026_05_01"],
          risk: "medium; summarize position, do not infer motive",
        },
      ],
      sourceTasks: [
        "Search recent court/news coverage before final public submission.",
        "Use official court filings, OpenAI statements/blog posts, Musk/XAI statements, Reuters/AP/Bloomberg/NYT style news sources when available.",
      ],
    },
    scenes: [
      {
        eyebrow: "马斯克 vs 奥特曼终极审判！",
        hook: "不要 1870 亿",
        title: "把 OpenAI 还给我",
        body: "2026 年 4 月底，Musk 与 OpenAI / Altman 的案件在 Oakland 开庭，核心是：OpenAI 是否背离早期非营利使命。",
        caption: "这不是口水战，是 AI 公司治理、资本与使命的正面对撞。",
        kind: "news_context",
        accent: "#f8de4a",
        assetTitle: "Conflict opener",
        assetPurpose: "建立 Musk / Altman / OpenAI 冲突语境。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
      {
        eyebrow: "Musk 一方",
        hook: "“偷走慈善”",
        title: "他的核心指控",
        body: "Musk 在庭审中把诉讼讲成对慈善与公共使命的防守，称 OpenAI 的商业化方向背离最初承诺。",
        caption: "这里只呈现庭审主张，不把任何一方说法当成判决结论。",
        kind: "news_position_a",
        accent: "#f8de4a",
        assetTitle: "Musk position map",
        assetPurpose: "用导图解释 Musk 一方的主张，不用大头照占满画面。",
        assetRisk: "中；真实新闻与人物素材必须标注来源。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
      {
        eyebrow: "Altman / OpenAI",
        hook: "另一套叙事",
        title: "算力、融资、扩张",
        body: "OpenAI 一方反驳称，商业结构与合作是购买算力、吸引人才、继续推进模型能力的现实条件。",
        caption: "争议焦点从“初心”转向“谁有资格解释初心”。",
        kind: "news_position_b",
        accent: "#62eadc",
        assetTitle: "Altman OpenAI position map",
        assetPurpose: "用导图解释 Altman / OpenAI 一方的商业化与算力叙事。",
        assetRisk: "中；真实新闻与人物素材必须标注来源。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
      {
        eyebrow: "争议焦点",
        hook: "真正抢的",
        title: "不是钱，是解释权",
        body: "同一段历史，可以被讲成背离初心，也可以被讲成商业化自救。法庭要听的是协议、治理与利益边界。",
        caption: "所以这场冲突会影响的不只是 OpenAI，而是 AI 公司的公共使命叙事。",
        kind: "news_stakes",
        accent: "#f8de4a",
        assetTitle: "Governance conflict diagram",
        assetPurpose: "用图解呈现非营利使命、营利结构、投资和控制权的拉扯。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
      {
        eyebrow: "下一步",
        hook: "三个信号",
        title: "法庭、监管、资本",
        body: "接下来要看判决如何界定非营利控制、OpenAI 的结构调整，以及 AI 融资是否被重新审视。",
        caption: "这场官司的结论，可能会重写大模型公司的治理边界。",
        kind: "news_outlook",
        accent: "#f8de4a",
        assetTitle: "Next signals board",
        assetPurpose: "收束为后续观察点。",
        durationSeconds: 2.4,
        evidenceAssets: sharedEvidenceAssets,
      },
    ],
  }
}
