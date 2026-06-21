// ─── Mock Data for Politica Platform Admin Panel ───────────────────────────

export const ADMIN_USER = { username: "admin", password: "politica2026" }

// ─── Documents ──────────────────────────────────────────────────────────────
export const documents = [
  { id: "doc_001", title: "PM Modi's Infrastructure Speech at Gujarat Rally", source: "X", platform: "x", language: "Hindi", topics: ["Infrastructure", "Employment"], entities: ["Narendra Modi", "Gujarat", "NITI Aayog"], sentiment: 0.72, status: "processed", date: "2026-06-18T14:30:00Z", wordCount: 1240, confidence: 0.94 },
  { id: "doc_002", title: "Congress Party Manifesto - Education Promises", source: "Instagram", platform: "instagram", language: "English", topics: ["Education", "Youth"], entities: ["Rahul Gandhi", "Congress", "IIT"], sentiment: 0.58, status: "processed", date: "2026-06-17T09:15:00Z", wordCount: 3400, confidence: 0.91 },
  { id: "doc_003", title: "AAP Healthcare Campaign - Delhi Mohalla Clinics", source: "Telegram", platform: "telegram", language: "Hinglish", topics: ["Healthcare"], entities: ["Arvind Kejriwal", "Delhi", "Mohalla Clinic"], sentiment: 0.81, status: "processed", date: "2026-06-17T11:00:00Z", wordCount: 820, confidence: 0.88 },
  { id: "doc_004", title: "BJP Farmers' Relief Package Announcement", source: "News", platform: "news", language: "Hindi", topics: ["Agriculture", "Economy"], entities: ["BJP", "Amit Shah", "Maharashtra", "MSP"], sentiment: 0.65, status: "processing", date: "2026-06-16T16:45:00Z", wordCount: 1980, confidence: 0.79 },
  { id: "doc_005", title: "Opposition Alliance Press Conference on Unemployment", source: "X", platform: "x", language: "English", topics: ["Employment", "Economy"], entities: ["INDIA Alliance", "Mallikarjun Kharge"], sentiment: -0.32, status: "processed", date: "2026-06-16T13:20:00Z", wordCount: 1100, confidence: 0.92 },
  { id: "doc_006", title: "TMC Rally - Mamata on Women's Safety", source: "Instagram", platform: "instagram", language: "Bengali", topics: ["Women Safety", "Social"], entities: ["Mamata Banerjee", "West Bengal", "TMC"], sentiment: 0.44, status: "processed", date: "2026-06-15T18:00:00Z", wordCount: 2100, confidence: 0.85 },
  { id: "doc_007", title: "RJD Campaign - Caste-Based Census Promise", source: "News", platform: "news", language: "Hindi", topics: ["Social", "Politics"], entities: ["Tejashwi Yadav", "Bihar", "RJD"], sentiment: 0.39, status: "processed", date: "2026-06-15T10:30:00Z", wordCount: 1560, confidence: 0.87 },
  { id: "doc_008", title: "JDU - Nitish Kumar's Road Development Plan", source: "Telegram", platform: "telegram", language: "Hindi", topics: ["Infrastructure"], entities: ["Nitish Kumar", "Bihar", "JDU", "NHAI"], sentiment: 0.71, status: "failed", date: "2026-06-14T08:00:00Z", wordCount: 940, confidence: 0.61 },
  { id: "doc_009", title: "SP Manifesto on Free Electricity in UP", source: "X", platform: "x", language: "Hindi", topics: ["Energy", "Economy"], entities: ["Akhilesh Yadav", "UP", "SP"], sentiment: 0.68, status: "processed", date: "2026-06-13T20:10:00Z", wordCount: 780, confidence: 0.9 },
  { id: "doc_010", title: "CPI(M) Statement on Privatization of PSUs", source: "News", platform: "news", language: "English", topics: ["Economy", "Labour"], entities: ["Sitaram Yechury", "CPI(M)", "SAIL", "BHEL"], sentiment: -0.55, status: "processed", date: "2026-06-12T15:00:00Z", wordCount: 2200, confidence: 0.93 },
]

// ─── Promises ────────────────────────────────────────────────────────────────
export const promises = [
  { id: "prm_001", text: "Build 100 new government schools in rural districts by 2028", entity: "Narendra Modi", party: "BJP", topic: "Education", quantity: 100, unit: "schools", timeline: "2 years", confidence: 0.95, source: "doc_001", status: "pending", date: "2026-06-18T14:30:00Z", region: "Gujarat" },
  { id: "prm_002", text: "Provide free laptops to 5 lakh students in Class 10 and 12", entity: "Rahul Gandhi", party: "Congress", topic: "Education", quantity: 500000, unit: "laptops", timeline: "1 year", confidence: 0.91, source: "doc_002", status: "pending", date: "2026-06-17T09:15:00Z", region: "National" },
  { id: "prm_003", text: "Open 500 new Mohalla Clinics across Delhi by March 2027", entity: "Arvind Kejriwal", party: "AAP", topic: "Healthcare", quantity: 500, unit: "clinics", timeline: "9 months", confidence: 0.88, source: "doc_003", status: "in_progress", date: "2026-06-17T11:00:00Z", region: "Delhi" },
  { id: "prm_004", text: "Increase MSP for wheat and rice by 20% from next Kharif season", entity: "Amit Shah", party: "BJP", topic: "Agriculture", quantity: 20, unit: "percent increase", timeline: "6 months", confidence: 0.79, source: "doc_004", status: "pending", date: "2026-06-16T16:45:00Z", region: "National" },
  { id: "prm_005", text: "Create 2 crore new jobs in manufacturing sector by 2028", entity: "Narendra Modi", party: "BJP", topic: "Employment", quantity: 20000000, unit: "jobs", timeline: "2 years", confidence: 0.82, source: "doc_001", status: "pending", date: "2026-06-18T14:30:00Z", region: "National" },
  { id: "prm_006", text: "Free electricity up to 300 units per month for all households in UP", entity: "Akhilesh Yadav", party: "SP", topic: "Energy", quantity: 300, unit: "units/month", timeline: "If elected", confidence: 0.9, source: "doc_009", status: "pending", date: "2026-06-13T20:10:00Z", region: "Uttar Pradesh" },
  { id: "prm_007", text: "Build 10,000 km of new rural roads in Bihar in 3 years", entity: "Nitish Kumar", party: "JDU", topic: "Infrastructure", quantity: 10000, unit: "km", timeline: "3 years", confidence: 0.84, source: "doc_008", status: "in_progress", date: "2026-06-14T08:00:00Z", region: "Bihar" },
  { id: "prm_008", text: "Conduct caste-based census and implement proportional reservations", entity: "Tejashwi Yadav", party: "RJD", topic: "Social", quantity: null, unit: "policy", timeline: "6 months if elected", confidence: 0.87, source: "doc_007", status: "pending", date: "2026-06-15T10:30:00Z", region: "Bihar" },
  { id: "prm_009", text: "Install CCTV cameras in all public transport in West Bengal", entity: "Mamata Banerjee", party: "TMC", topic: "Women Safety", quantity: 50000, unit: "cameras", timeline: "1 year", confidence: 0.78, source: "doc_006", status: "in_progress", date: "2026-06-15T18:00:00Z", region: "West Bengal" },
  { id: "prm_010", text: "Reverse all PSU privatizations done in last 5 years", entity: "Sitaram Yechury", party: "CPI(M)", topic: "Economy", quantity: null, unit: "policy", timeline: "Within 1 year", confidence: 0.93, source: "doc_010", status: "pending", date: "2026-06-12T15:00:00Z", region: "National" },
]

// ─── Entities ─────────────────────────────────────────────────────��──────────
export const entities = [
  { id: "ent_001", name: "Narendra Modi", type: "PERSON", party: "BJP", role: "Prime Minister", mentions: 4821, sentiment: 0.42, documents: 312, state: "National", verified: true },
  { id: "ent_002", name: "Rahul Gandhi", type: "PERSON", party: "Congress", role: "Leader of Opposition", mentions: 3654, sentiment: 0.28, documents: 241, state: "National", verified: true },
  { id: "ent_003", name: "Arvind Kejriwal", type: "PERSON", party: "AAP", role: "Former CM Delhi", mentions: 2190, sentiment: 0.51, documents: 178, state: "Delhi", verified: true },
  { id: "ent_004", name: "Mamata Banerjee", type: "PERSON", party: "TMC", role: "CM West Bengal", mentions: 1987, sentiment: 0.38, documents: 154, state: "West Bengal", verified: true },
  { id: "ent_005", name: "Akhilesh Yadav", type: "PERSON", party: "SP", role: "Former CM UP", mentions: 1742, sentiment: 0.45, documents: 132, state: "Uttar Pradesh", verified: true },
  { id: "ent_006", name: "BJP", type: "ORGANIZATION", party: "BJP", role: "Ruling Party", mentions: 8920, sentiment: 0.35, documents: 543, state: "National", verified: true },
  { id: "ent_007", name: "Congress", type: "ORGANIZATION", party: "Congress", role: "Opposition Party", mentions: 6312, sentiment: 0.22, documents: 398, state: "National", verified: true },
  { id: "ent_008", name: "Gujarat", type: "LOCATION", party: null, role: "State", mentions: 1540, sentiment: 0.6, documents: 98, state: "Gujarat", verified: true },
  { id: "ent_009", name: "Mohalla Clinic", type: "POLICY", party: "AAP", role: "Healthcare Program", mentions: 892, sentiment: 0.78, documents: 67, state: "Delhi", verified: true },
  { id: "ent_010", name: "INDIA Alliance", type: "ORGANIZATION", party: "Alliance", role: "Opposition Alliance", mentions: 2870, sentiment: 0.15, documents: 187, state: "National", verified: true },
]

// ─── Topics ──────────────────────────────────────────────────────────────────
export const topics = [
  { id: "top_001", name: "Education", parent: null, documents: 1240, trend: "+12%", sentiment: 0.62, topEntities: ["Rahul Gandhi", "Narendra Modi", "HRD Ministry"], color: "blue" },
  { id: "top_002", name: "Healthcare", parent: null, documents: 980, trend: "+8%", sentiment: 0.55, topEntities: ["Arvind Kejriwal", "BJP", "AIIMS"], color: "green" },
  { id: "top_003", name: "Infrastructure", parent: null, documents: 1560, trend: "+22%", sentiment: 0.71, topEntities: ["Narendra Modi", "NHAI", "Nitish Kumar"], color: "orange" },
  { id: "top_004", name: "Employment", parent: null, documents: 890, trend: "-5%", sentiment: 0.18, topEntities: ["INDIA Alliance", "Rahul Gandhi", "CII"], color: "red" },
  { id: "top_005", name: "Agriculture", parent: null, documents: 1120, trend: "+15%", sentiment: 0.48, topEntities: ["Amit Shah", "Farmers", "MSP Committee"], color: "yellow" },
  { id: "top_006", name: "Economy", parent: null, documents: 1380, trend: "+3%", sentiment: 0.31, topEntities: ["Sitaram Yechury", "Finance Ministry", "RBI"], color: "purple" },
  { id: "top_007", name: "Women Safety", parent: "Social", documents: 620, trend: "+18%", sentiment: 0.25, topEntities: ["Mamata Banerjee", "NCW", "Delhi Police"], color: "pink" },
  { id: "top_008", name: "Energy", parent: null, documents: 540, trend: "+9%", sentiment: 0.52, topEntities: ["Akhilesh Yadav", "DISCOMS", "MNRE"], color: "cyan" },
]

// ─── Summaries ───────────────────────────────────────────────────────────────
export const summaries = [
  { id: "sum_001", type: "daily", date: "2026-06-18", title: "Daily Intelligence Brief - June 18", topics: ["Infrastructure", "Education"], keyInsights: ["BJP focused on infrastructure messaging in Gujarat", "Congress doubled down on education promises", "Sentiment for infrastructure content peaked at 0.71"], wordCount: 420, status: "ready" },
  { id: "sum_002", type: "daily", date: "2026-06-17", title: "Daily Intelligence Brief - June 17", topics: ["Healthcare", "Agriculture"], keyInsights: ["AAP's healthcare messaging gained significant traction in Delhi", "Farmers issue trending nationally after MSP announcement", "Hinglish content showed 30% higher engagement"], wordCount: 390, status: "ready" },
  { id: "sum_003", type: "weekly", date: "2026-06-15", title: "Weekly Intelligence Report - W24 2026", topics: ["All Topics"], keyInsights: ["Infrastructure emerged as dominant topic (+22% WoW)", "Employment sentiment declined across all parties", "Bihar and UP showing highest political activity", "Social media engagement up 18% overall"], wordCount: 1840, status: "ready" },
  { id: "sum_004", type: "topic", date: "2026-06-16", title: "Healthcare Deep Dive - June 2026", topics: ["Healthcare"], keyInsights: ["Mohalla Clinics coverage 3x higher than national average in Delhi", "BJP and AAP competing directly on healthcare messaging", "Rural healthcare gaps identified as key voter concern"], wordCount: 960, status: "ready" },
]

// ─── Media / Images ──────────────────────────────────────────────────────────
export const mediaItems = [
  { id: "med_001", filename: "modi_gujarat_rally.jpg", source: "Instagram", platform: "instagram", ocrText: "विकास की नई उड़ान - नई दिशा, नया भारत", entities: ["Narendra Modi", "Gujarat"], topics: ["Infrastructure"], type: "banner", date: "2026-06-18T14:30:00Z", size: "2.4 MB" },
  { id: "med_002", filename: "congress_laptop_scheme.jpg", source: "X", platform: "x", ocrText: "Free Laptop for Every Student - Congress Promise 2026", entities: ["Rahul Gandhi", "Congress"], topics: ["Education"], type: "poster", date: "2026-06-17T09:15:00Z", size: "1.8 MB" },
  { id: "med_003", filename: "aap_mohalla_clinic_banner.jpg", source: "Telegram", platform: "telegram", ocrText: "500 नई मोहल्ला क्लिनिक - दिल्ली का स्वास्थ्य क्रांति", entities: ["AAP", "Mohalla Clinic"], topics: ["Healthcare"], type: "banner", date: "2026-06-17T11:00:00Z", size: "3.1 MB" },
  { id: "med_004", filename: "bjp_farmers_meet.jpg", source: "News", platform: "news", ocrText: "Kisan Samman Nidhi - MSP Hike Announcement", entities: ["Amit Shah", "BJP", "Farmers"], topics: ["Agriculture"], type: "event", date: "2026-06-16T16:45:00Z", size: "4.2 MB" },
  { id: "med_005", filename: "india_alliance_presser.jpg", source: "X", platform: "x", ocrText: "INDIA Alliance - Unemployment Crisis Press Conference", entities: ["INDIA Alliance", "Mallikarjun Kharge"], topics: ["Employment"], type: "event", date: "2026-06-16T13:20:00Z", size: "2.9 MB" },
  { id: "med_006", filename: "mamata_rally_kolkata.jpg", source: "Instagram", platform: "instagram", ocrText: "মহিলাদের নিরাপত্তা আমাদের অগ্রাধিকার - TMC 2026", entities: ["Mamata Banerjee", "TMC"], topics: ["Women Safety"], type: "rally", date: "2026-06-15T18:00:00Z", size: "5.1 MB" },
]

// ─── Trends / Analytics ──────────────────────────────────────────────────────
export const weeklyEngagement = [
  { week: "W19", documents: 320, entities: 1840, promises: 28, sentiment: 0.42 },
  { week: "W20", documents: 410, entities: 2310, promises: 34, sentiment: 0.38 },
  { week: "W21", documents: 380, entities: 2100, promises: 29, sentiment: 0.45 },
  { week: "W22", documents: 520, entities: 3020, promises: 41, sentiment: 0.51 },
  { week: "W23", documents: 490, entities: 2870, promises: 38, sentiment: 0.48 },
  { week: "W24", documents: 610, entities: 3450, promises: 52, sentiment: 0.55 },
]

export const topicTrends = [
  { month: "Jan", Education: 320, Healthcare: 280, Infrastructure: 410, Employment: 370, Agriculture: 290 },
  { month: "Feb", Education: 380, Healthcare: 310, Infrastructure: 450, Employment: 340, Agriculture: 320 },
  { month: "Mar", Education: 420, Healthcare: 350, Infrastructure: 520, Employment: 310, Agriculture: 380 },
  { month: "Apr", Education: 390, Healthcare: 420, Infrastructure: 580, Employment: 290, Agriculture: 410 },
  { month: "May", Education: 460, Healthcare: 490, Infrastructure: 640, Employment: 270, Agriculture: 450 },
  { month: "Jun", Education: 510, Healthcare: 540, Infrastructure: 720, Employment: 260, Agriculture: 480 },
]

export const sentimentByPlatform = [
  { platform: "X / Twitter", positive: 38, neutral: 32, negative: 30 },
  { platform: "Instagram", positive: 55, neutral: 28, negative: 17 },
  { platform: "Telegram", positive: 44, neutral: 35, negative: 21 },
  { platform: "News", positive: 30, neutral: 42, negative: 28 },
]

export const geographicData = [
  { state: "Maharashtra", documents: 1240, sentiment: 0.48, topTopic: "Economy", activity: "high" },
  { state: "Uttar Pradesh", documents: 1890, sentiment: 0.35, topTopic: "Employment", activity: "very_high" },
  { state: "Gujarat", documents: 980, sentiment: 0.72, topTopic: "Infrastructure", activity: "high" },
  { state: "West Bengal", documents: 1120, sentiment: 0.38, topTopic: "Women Safety", activity: "high" },
  { state: "Bihar", documents: 1340, sentiment: 0.42, topTopic: "Agriculture", activity: "very_high" },
  { state: "Delhi", documents: 820, sentiment: 0.61, topTopic: "Healthcare", activity: "medium" },
  { state: "Rajasthan", documents: 670, sentiment: 0.44, topTopic: "Agriculture", activity: "medium" },
  { state: "Madhya Pradesh", documents: 590, sentiment: 0.51, topTopic: "Infrastructure", activity: "medium" },
  { state: "Tamil Nadu", documents: 740, sentiment: 0.55, topTopic: "Education", activity: "medium" },
  { state: "Karnataka", documents: 680, sentiment: 0.49, topTopic: "Economy", activity: "medium" },
]

// ─── Audit Logs ──────────────────────────────────────────────────────────────
export const auditLogs = [
  { id: "log_001", action: "DOCUMENT_PROCESSED", user: "system", resource: "doc_001", timestamp: "2026-06-18T14:35:00Z", status: "success", details: "OCR + NLP pipeline completed" },
  { id: "log_002", action: "PROMISE_EXTRACTED", user: "agent_promises", resource: "prm_001", timestamp: "2026-06-18T14:36:00Z", status: "success", details: "3 promises extracted from doc_001" },
  { id: "log_003", action: "ENTITY_LINKED", user: "agent_graph", resource: "ent_001", timestamp: "2026-06-18T14:37:00Z", status: "success", details: "Modi linked to 2 new documents" },
  { id: "log_004", action: "COLLECTION_STARTED", user: "collector", resource: "x_feed", timestamp: "2026-06-18T14:00:00Z", status: "success", details: "Collected 48 new posts from X" },
  { id: "log_005", action: "DOCUMENT_FAILED", user: "processor", resource: "doc_008", timestamp: "2026-06-14T08:05:00Z", status: "error", details: "OCR confidence below threshold (0.61)" },
  { id: "log_006", action: "SUMMARY_GENERATED", user: "agent_summary", resource: "sum_001", timestamp: "2026-06-18T20:00:00Z", status: "success", details: "Daily brief generated for June 18" },
  { id: "log_007", action: "SEARCH_INDEXED", user: "elasticsearch", resource: "doc_002", timestamp: "2026-06-17T09:20:00Z", status: "success", details: "Document indexed in Elasticsearch" },
  { id: "log_008", action: "EMBEDDING_STORED", user: "qdrant", resource: "doc_003", timestamp: "2026-06-17T11:05:00Z", status: "success", details: "BGE-M3 embeddings stored in Qdrant" },
]

// ─── Party Sentiment (In Favor vs Against) ───────────────────────────────────

export const PARTY_COLORS: Record<string, { favor: string; against: string; badge: string }> = {
  BJP:      { favor: "#f97316", against: "#ef4444", badge: "#f97316" },
  Congress: { favor: "#22c55e", against: "#ef4444", badge: "#22c55e" },
  AAP:      { favor: "#3b82f6", against: "#ef4444", badge: "#3b82f6" },
  SP:       { favor: "#a855f7", against: "#ef4444", badge: "#a855f7" },
  TMC:      { favor: "#14b8a6", against: "#ef4444", badge: "#14b8a6" },
  "CPI(M)": { favor: "#ec4899", against: "#ef4444", badge: "#ec4899" },
  RJD:      { favor: "#eab308", against: "#ef4444", badge: "#eab308" },
  JDU:      { favor: "#06b6d4", against: "#ef4444", badge: "#06b6d4" },
}

// Overall party sentiment snapshot (latest period)
export const partySentimentSnapshot = [
  { party: "BJP",      inFavor: 4821, against: 3102, neutral: 1940, net: +1719, favorPct: 52, againstPct: 33, neutralPct: 15, trend: "+3.2%", trendUp: true  },
  { party: "Congress", inFavor: 3210, against: 2870, neutral: 1540, net:  +340, favorPct: 42, againstPct: 37, neutralPct: 21, trend: "+1.1%", trendUp: true  },
  { party: "AAP",      inFavor: 1890, against:  980, neutral:  720, net:  +910, favorPct: 53, againstPct: 27, neutralPct: 20, trend: "+5.4%", trendUp: true  },
  { party: "SP",       inFavor: 1420, against: 1180, neutral:  620, net:  +240, favorPct: 44, againstPct: 37, neutralPct: 19, trend: "-0.8%", trendUp: false },
  { party: "TMC",      inFavor: 1340, against: 1210, neutral:  580, net:  +130, favorPct: 41, againstPct: 37, neutralPct: 22, trend: "-1.2%", trendUp: false },
  { party: "CPI(M)",   inFavor:  820, against:  940, neutral:  430, net:  -120, favorPct: 38, againstPct: 43, neutralPct: 19, trend: "-2.1%", trendUp: false },
  { party: "RJD",      inFavor:  980, against:  860, neutral:  410, net:  +120, favorPct: 43, againstPct: 38, neutralPct: 19, trend: "+0.4%", trendUp: true  },
  { party: "JDU",      inFavor:  760, against:  520, neutral:  340, net:  +240, favorPct: 48, againstPct: 33, neutralPct: 19, trend: "+2.2%", trendUp: true  },
]

// Weekly trend: in-favor % for top 4 parties
export const partySentimentTrend = [
  { week: "W19", BJP: 48, Congress: 39, AAP: 45, SP: 41 },
  { week: "W20", BJP: 50, Congress: 40, AAP: 47, SP: 43 },
  { week: "W21", BJP: 49, Congress: 38, AAP: 48, SP: 42 },
  { week: "W22", BJP: 51, Congress: 41, AAP: 50, SP: 40 },
  { week: "W23", BJP: 53, Congress: 40, AAP: 52, SP: 39 },
  { week: "W24", BJP: 52, Congress: 42, AAP: 53, SP: 44 },
]

// Per-topic: in-favor vs against breakdown for BJP & Congress (the two main parties)
export const topicPartyBreakdown = [
  { topic: "Infrastructure", BJPfavor: 78, BJPageainst: 14, CONGfavor: 38, CONGagainst: 42 },
  { topic: "Education",      BJPfavor: 54, BJPageainst: 28, CONGfavor: 62, CONGagainst: 22 },
  { topic: "Healthcare",     BJPfavor: 46, BJPageainst: 34, CONGfavor: 55, CONGagainst: 28 },
  { topic: "Agriculture",    BJPfavor: 58, BJPageainst: 30, CONGfavor: 44, CONGagainst: 36 },
  { topic: "Employment",     BJPfavor: 32, BJPageainst: 52, CONGfavor: 48, CONGagainst: 34 },
  { topic: "Economy",        BJPfavor: 44, BJPageainst: 38, CONGfavor: 40, CONGagainst: 42 },
]

// Platform-level party sentiment
export const platformPartyFavor = [
  { platform: "X",        BJP: 48, Congress: 35, AAP: 52, SP: 38 },
  { platform: "Instagram",BJP: 55, Congress: 44, AAP: 60, SP: 42 },
  { platform: "Telegram", BJP: 52, Congress: 38, AAP: 55, SP: 41 },
  { platform: "News",     BJP: 45, Congress: 40, AAP: 44, SP: 36 },
]

// State-level: leading party + favor %, against %
export const statePartyLeader = [
  { state: "Uttar Pradesh",   leader: "BJP",    leaderFavor: 51, topOpponent: "SP",      opponentFavor: 44, against: 28, swing: "+2.1%" },
  { state: "Maharashtra",     leader: "BJP",    leaderFavor: 48, topOpponent: "Congress", opponentFavor: 41, against: 31, swing: "+0.8%" },
  { state: "West Bengal",     leader: "TMC",    leaderFavor: 46, topOpponent: "BJP",      opponentFavor: 42, against: 34, swing: "-1.2%" },
  { state: "Bihar",           leader: "JDU",    leaderFavor: 49, topOpponent: "RJD",      opponentFavor: 43, against: 27, swing: "+3.0%" },
  { state: "Delhi",           leader: "AAP",    leaderFavor: 55, topOpponent: "BJP",      opponentFavor: 40, against: 24, swing: "+5.4%" },
  { state: "Gujarat",         leader: "BJP",    leaderFavor: 63, topOpponent: "Congress", opponentFavor: 28, against: 19, swing: "+1.5%" },
  { state: "Tamil Nadu",      leader: "Congress",leaderFavor: 50, topOpponent: "BJP",     opponentFavor: 32, against: 22, swing: "+0.3%" },
  { state: "Rajasthan",       leader: "Congress",leaderFavor: 46, topOpponent: "BJP",     opponentFavor: 44, against: 29, swing: "-0.4%" },
  { state: "Karnataka",       leader: "Congress",leaderFavor: 49, topOpponent: "BJP",     opponentFavor: 43, against: 26, swing: "+1.8%" },
  { state: "Madhya Pradesh",  leader: "BJP",    leaderFavor: 52, topOpponent: "Congress", opponentFavor: 38, against: 25, swing: "+0.7%" },
]

// ─── System Stats ────────────────────────────────────────────────────────────
export const systemStats = {
  totalDocuments: 14821,
  processedToday: 148,
  pendingQueue: 23,
  totalPromises: 2341,
  totalEntities: 8920,
  totalTopics: 47,
  avgSentiment: 0.42,
  collectionSources: 4,
  storageUsed: "284 GB",
  lastCollection: "2026-06-18T14:00:00Z",
  uptime: "99.8%",
  apiRequests24h: 18420,
}

// ─── Workspaces ──────────────────────────────────────────────────────────────
export const workspaces = [
  { id: "ws_001", name: "Bihar Election 2026", description: "Tracking all political activity in Bihar for 2026 state elections", savedQueries: 12, annotations: 34, owner: "analyst_01", lastUpdated: "2026-06-18T10:00:00Z", tags: ["Bihar", "Election", "2026"] },
  { id: "ws_002", name: "Healthcare Policy Analysis", description: "Deep dive into healthcare promises and sentiment across parties", savedQueries: 8, annotations: 21, owner: "analyst_02", lastUpdated: "2026-06-17T15:30:00Z", tags: ["Healthcare", "Policy"] },
  { id: "ws_003", name: "Modi vs Rahul - Messaging Comparison", description: "Comparative messaging analysis between BJP and Congress leaders", savedQueries: 15, annotations: 48, owner: "analyst_01", lastUpdated: "2026-06-16T12:00:00Z", tags: ["BJP", "Congress", "Messaging"] },
  { id: "ws_004", name: "Social Media Sentiment Tracker", description: "Real-time sentiment tracking across Instagram, X, and Telegram", savedQueries: 6, annotations: 15, owner: "analyst_03", lastUpdated: "2026-06-15T09:00:00Z", tags: ["Sentiment", "Social Media"] },
]

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = [
  { id: "usr_001", username: "admin", name: "Admin User", email: "admin@politica.in", role: "admin", status: "active", lastLogin: "2026-06-18T09:00:00Z", avatar: "AU" },
  { id: "usr_002", username: "analyst_01", name: "Priya Sharma", email: "priya@politica.in", role: "analyst", status: "active", lastLogin: "2026-06-18T08:30:00Z", avatar: "PS" },
  { id: "usr_003", username: "analyst_02", name: "Rohan Mehta", email: "rohan@politica.in", role: "analyst", status: "active", lastLogin: "2026-06-17T17:00:00Z", avatar: "RM" },
  { id: "usr_004", username: "analyst_03", name: "Sunita Patel", email: "sunita@politica.in", role: "viewer", status: "inactive", lastLogin: "2026-06-12T11:00:00Z", avatar: "SP" },
]
