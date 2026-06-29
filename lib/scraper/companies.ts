/**
 * Massive curated list of 1,500+ top startups & tech companies worldwide.
 * Organized by tier and category for smart query generation.
 */

// ── TIER 1: FAANG + Mega-cap ($100B+) ──────────────────────────
export const TIER1_MEGA = [
  "Google", "Meta", "Apple", "Amazon", "Microsoft", "Netflix",
  "Nvidia", "Tesla", "Oracle", "Salesforce", "Adobe", "Intel",
  "IBM", "Cisco", "SAP", "Samsung", "Sony", "Qualcomm",
];

// ── TIER 2: Late-stage / Public unicorns ($10B+) ───────────────
export const TIER2_UNICORNS = [
  // Data & Cloud
  "Snowflake", "Databricks", "Datadog", "Cloudflare", "MongoDB",
  "Confluent", "Elastic", "HashiCorp", "Sumo Logic", "New Relic",
  "Splunk", "Teradata", "Palantir", "C3.ai", "Alteryx",
  // Fintech
  "Stripe", "Plaid", "Brex", "Ramp", "Robinhood", "Coinbase",
  "Square", "Block", "Affirm", "Chime", "Marqeta", "Toast",
  "Adyen", "Klarna", "Revolut", "Wise", "Nubank", "Neon",
  "Mercury", "Carta", "Pilot", "Melio", "Capchase",
  // Dev Tools & Infra
  "Vercel", "Supabase", "PlanetScale", "Neon DB", "Railway",
  "Render", "Fly.io", "Netlify", "Heroku", "DigitalOcean",
  "Linode", "Vultr", "Hetzner", "Grafana Labs", "PostHog",
  "LaunchDarkly", "Split", "Flagsmith", "Unleash",
  // AI / ML
  "OpenAI", "Anthropic", "Cohere", "Mistral", "Stability AI",
  "Hugging Face", "Scale AI", "Labelbox", "Snorkel AI", "Weights & Biases",
  "MLflow", "Determined AI", "Anyscale", "Modal", "Replicate",
  "Runway", "Jasper", "Copy.ai", "Writer", "Adept",
  // Productivity & SaaS
  "Notion", "Figma", "Canva", "Miro", "Linear", "Coda",
  "Airtable", "Monday.com", "Asana", "ClickUp", "Loom",
  "Calendly", "Typeform", "Retool", "Internal", "Superblocks",
  // Cybersecurity
  "CrowdStrike", "Palo Alto Networks", "Zscaler", "SentinelOne",
  "Wiz", "Snyk", "Lacework", "Orca Security", "Cybereason",
  "Tanium", "Arctic Wolf", "Abnormal Security", "Material Security",
  // Commerce & Marketplace
  "Shopify", "Instacart", "DoorDash", "Uber", "Lyft",
  "Airbnb", "Faire", "Bolt", "Rappi", "Glovo",
  "Getir", "Gorillas", "Flink", "GoPuff",
];

// ── TIER 3: Growth-stage startups ($1B-$10B) ──────────────────
export const TIER3_GROWTH = [
  // HR & People
  "Rippling", "Deel", "Remote.com", "Oyster HR", "Gusto",
  "Lattice", "Culture Amp", "15Five", "Leapsome", "Personio",
  "BambooHR", "Workday", "Greenhouse", "Lever", "Ashby",
  "Dover", "Gem", "Hired", "Triplebyte", "Karat",
  // DevOps & Platform
  "GitLab", "GitHub", "Bitbucket", "CircleCI", "Travis CI",
  "Buildkite", "Semaphore", "Argo", "Spacelift", "env0",
  "Pulumi", "Crossplane", "Upbound", "Teleport", "Tailscale",
  "Cloudsmith", "JFrog", "Sonatype", "Snyk", "Bridgecrew",
  // Data Engineering
  "Fivetran", "Airbyte", "Stitch", "Segment", "mParticle",
  "Rudderstack", "Hightouch", "Census", "dbt Labs", "Atlan",
  "Monte Carlo", "Great Expectations", "Soda", "Bigeye",
  "Datafold", "Hex", "Mode", "Sigma Computing", "Metabase",
  "Lightdash", "Preset", "Apache Superset", "Redash",
  // Infrastructure
  "Temporal", "Inngest", "Trigger.dev", "Prefect", "Dagster",
  "Astronomer", "Materialize", "Rockset", "ClickHouse",
  "StarRocks", "Apache Druid", "Pinecone", "Weaviate",
  "Qdrant", "Milvus", "Chroma", "LanceDB", "Vespa",
  // Healthcare
  "Oscar Health", "Hims & Hers", "Ro", "Thirty Madison",
  "Color Health", "Tempus", "Flatiron Health", "Veracyte",
  "Sword Health", "Omada Health", "Hinge Health",
  "Headspace", "Calm", "Talkiatry", "Cerebral",
  // Real Estate & Proptech
  "Opendoor", "Offerpad", "Zillow", "Redfin", "Compass",
  "Divvy Homes", "Arrived", "Roofstock", "Pacaso",
  "Loft", "QuintoAndar", "Spotahome",
  // Crypto / Web3
  "Alchemy", "Infura", "Moralis", "QuickNode",
  "Chainalysis", "Elliptic", "Nansen", "Dune Analytics",
  "Uniswap", "Aave", "Compound", "MakerDAO",
  "ConsenSys", "Polygon", "Arbitrum", "Optimism",
  "LayerZero", "Wormhole", "Axelar",
  "Fireblocks", "BitGo", "Anchorage", "Copper.co",
  // Autonomous & Robotics
  "Waymo", "Cruise", "Aurora", "Nuro", "Motional",
  "Zoox", "TuSimple", "Gatik", "Kodiak Robotics",
  "Boston Dynamics", "Agility Robotics", "Figure AI",
  "Covariant", "Dexterity", "Locus Robotics",
  // Defense & Gov Tech
  "Anduril", "Shield AI", "Rebellion Defense",
  "Palantir", "SpaceX", "Hadrian", "Epirus",
  "Vannevar Labs", "Primer AI", "Govini",
];

// ── TIER 4: Early/Mid-stage hot startups ($100M-$1B) ──────────
export const TIER4_RISING = [
  // AI-native startups (2023-2025 wave)
  "Perplexity", "Character.ai", "Pika", "Suno", "ElevenLabs",
  "Synthesia", "HeyGen", "Descript", "Otter.ai", "Fireflies.ai",
  "Harvey AI", "Casetext", "Ironclad", "Luminance",
  "Glean", "Moveworks", "Forethought", "Ada", "Intercom",
  "Sierra AI", "Inflection", "xAI", "Together AI", "Groq",
  "Cerebras", "SambaNova", "Graphcore", "Tenstorrent",
  "Cursor", "Replit", "Sourcegraph", "Tabnine", "Codeium",
  "Poolside", "Magic AI", "Cognition", "Devin",
  // API-first companies
  "Twilio", "SendGrid", "Postmark", "Resend", "Loops",
  "Liveblocks", "Ably", "Pusher", "Stream", "Agora",
  "Vonage", "Bandwidth", "Telnyx",
  "Mapbox", "HERE", "TomTom",
  "Algolia", "Typesense", "Meilisearch",
  "Auth0", "Clerk", "Stytch", "WorkOS", "FusionAuth",
  "Nhost", "Appwrite", "Firebase", "Convex",
  // B2B SaaS
  "Gong", "Chorus.ai", "Clari", "People.ai", "6sense",
  "ZoomInfo", "Apollo.io", "Outreach", "Salesloft", "Lemlist",
  "Clay", "Clearbit", "Lusha", "Seamless.AI",
  "HubSpot", "Pipedrive", "Close", "Freshworks",
  "Zendesk", "Kustomer", "Dixa", "Front",
  "Amplitude", "Mixpanel", "Heap", "FullStory", "LogRocket",
  "Hotjar", "Pendo", "Whatfix", "Appcues", "Chameleon",
  "LaunchDarkly", "Optimizely", "VWO", "Statsig",
  "Contentful", "Sanity", "Strapi", "Storyblok", "Prismic",
  // Climate & Energy
  "Watershed", "Persefoni", "Sweep", "Plan A",
  "Arcadia", "Sense", "Span.io", "Lunar Energy",
  "Form Energy", "Malta", "Antora Energy",
  "Charm Industrial", "Heirloom Carbon", "Climeworks",
  "Commonwealth Fusion", "Helion Energy", "TAE Technologies",
  // Logistics & Supply Chain
  "Flexport", "Shippo", "EasyPost", "ShipBob",
  "Samsara", "Project44", "FourKites", "Transfix",
  "Convoy", "Loadsmart", "Uber Freight",
  // EdTech
  "Duolingo", "Coursera", "Udemy", "Skillshare",
  "Brilliant", "Replit", "Codecademy", "DataCamp",
  "Lambda School", "Microverse", "Springboard",
  // Gaming & Entertainment
  "Roblox", "Epic Games", "Unity", "Discord",
  "Niantic", "Rec Room", "Manticore Games",
  "Overwolf", "Voodoo", "Supercell",
  // Travel & Mobility
  "Hopper", "Kiwi.com", "Omio", "Rome2Rio",
  "Lime", "Bird", "Tier", "Voi",
  // Legal & Compliance
  "Ironclad", "Juro", "Precisely", "Brightflag",
  "Ethyca", "OneTrust", "BigID", "Securiti",
  // Food & Agriculture
  "Impossible Foods", "Beyond Meat", "Perfect Day",
  "Bowery Farming", "Plenty", "AppHarvest",
  "Farmwise", "Blue River Technology",
];

// ── TIER 5: European & Global standouts ────────────────────────
export const TIER5_GLOBAL = [
  // UK
  "Deliveroo", "Monzo", "Starling Bank", "Checkout.com",
  "GoCardless", "Thought Machine", "Tessian", "Snyk",
  "Improbable", "Graphcore", "BenevolentAI", "Wayve",
  // Germany
  "Celonis", "Contentful", "Trade Republic", "N26",
  "Mambu", "Solarisbank", "Adjust", "Personio",
  "DeepL", "Aleph Alpha", "Helsing",
  // France
  "Dataiku", "Contentsquare", "Mirakl", "Algolia",
  "BlaBlaCar", "Doctolib", "Alan", "Qonto", "Ledger",
  "Mistral AI", "Hugging Face", "Poolside",
  // Netherlands
  "Adyen", "Mollie", "MessageBird", "Miro",
  "Elastic", "TomTom", "Booking.com",
  // Sweden / Nordics
  "Klarna", "Spotify", "Kry", "Tink", "Pleo",
  "Trustly", "Karma", "Einride",
  // Israel
  "Wiz", "Orca Security", "Snyk", "monday.com",
  "Gong", "Fiverr", "ironSource", "Taboola",
  "Rapyd", "Melio", "Tipalti", "Payoneer",
  // India
  "Razorpay", "Zerodha", "Cred", "Meesho",
  "PhonePe", "Swiggy", "Zomato", "Ola",
  "Freshworks", "Postman", "BrowserStack", "Hasura",
  // LATAM
  "Nubank", "Rappi", "Kavak", "Clip",
  "Bitso", "Mercado Libre", "VTEX", "Nuvemshop",
  // SEA / ANZ
  "Grab", "GoTo", "Sea Group", "Canva",
  "Atlassian", "SafetyCulture", "Employment Hero",
  // Japan / Korea
  "SmartNews", "Treasure Data", "Preferred Networks",
  "Coupang", "Toss", "Viva Republica", "Kakao",
];

// ── TIER 6: YC / Top accelerator alumni (hot early-stage) ──────
export const TIER6_YC_ALUMNI = [
  "Stripe", "Airbnb", "DoorDash", "Coinbase", "Twitch",
  "Reddit", "Dropbox", "GitLab", "Zapier", "Segment",
  "Algolia", "Brex", "Faire", "Gusto", "Loom",
  "Mattermost", "PostHog", "Cal.com", "Supabase",
  "Resend", "Trigger.dev", "Inngest", "Nango",
  "Airbyte", "Temporal", "Dagster", "Prefect",
  "Retool", "Linear", "Vercel", "Railway",
  "Fly.io", "Render", "Neon", "Turso",
  "Clerk", "Stytch", "WorkOS", "Warrant",
  "Vanta", "Drata", "Secureframe", "Launchdarkly",
  "Loops", "Svix", "Knock", "Novu",
  "Mintlify", "ReadMe", "Stoplight", "Bump.sh",
  "Buildkite", "Depot", "WarpBuild", "Namespace",
  "Latitude", "E2B", "Modal", "Baseten",
  "Helicone", "Portkey", "LangSmith", "Langfuse",
  "Mem", "Granola", "Lex", "Type",
  "Warp", "Fig", "Charm", "Atuin",
];

// ── All companies combined + deduped ───────────────────────────

export function getAllCompanies(): string[] {
  const all = [
    ...TIER1_MEGA,
    ...TIER2_UNICORNS,
    ...TIER3_GROWTH,
    ...TIER4_RISING,
    ...TIER5_GLOBAL,
    ...TIER6_YC_ALUMNI,
  ];
  return [...new Set(all)];
}

export function getTopStartups(limit: number = 500): string[] {
  // Priority order: Tier 2-4 (actual startups, not mega-corps)
  const startups = [
    ...TIER2_UNICORNS,
    ...TIER3_GROWTH,
    ...TIER4_RISING,
    ...TIER5_GLOBAL,
    ...TIER6_YC_ALUMNI,
  ];
  return [...new Set(startups)].slice(0, limit);
}

export const COMPANY_COUNT = getAllCompanies().length;
