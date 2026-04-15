export const DATA_URLS = {
  timeline: "/data/data.json",
  constitution: "/data/current-constitution.json"
};

export const ROUTES = {
  home: "/",
  constitution: "/constitution",
  explore: "/explore",
  article: "/article",
  amendment: "/amendment",
  diff: "/diff",
  timeline: "/timeline",
  search: "/search"
};

export const GITHUB_PROXY_ENDPOINT = "/.netlify/functions/github-proxy";

export const REPO = {
  owner: "UmerTariq1",
  name: "legalize-pk"
};

export const NON_ENACTED_AMENDMENTS = new Set([9, 11, 15]);

export const PARTY_BY_AMENDMENT = {
  1: "ppp",
  2: "ppp",
  3: "ppp",
  4: "ppp",
  5: "ppp",
  6: "ppp",
  7: "ppp",
  8: "military",
  10: "military",
  12: "pmln",
  13: "pmln",
  14: "pmln",
  16: "pmln",
  17: "military",
  18: "ppp",
  19: "ppp",
  20: "ppp",
  21: "pmln",
  22: "pmln",
  23: "pmln",
  24: "pmln",
  25: "pmln",
  26: "coalition",
  27: "coalition"
};

export const PARTY_LABELS = {
  ppp: "PPP",
  military: "Military",
  pmln: "PML-N",
  coalition: "Coalition",
  neutral: "Federal"
};

export const LANDMARK_CALLOUTS = {
  1: {
    title: "Did you know?",
    subtitle: "1st Amendment",
    body: "The 1st Amendment quietly rewrote Pakistan's map — erasing all references to East Pakistan just months after Bangladesh's independence in 1971. The constitution had to be amended before it was even a year old."
  },
  2: {
    title: "Did you know?",
    subtitle: "2nd Amendment",
    body: "The 2nd Amendment made Pakistan the first country in the world to constitutionally define who is — and isn't — a Muslim, declaring the Ahmadiyya community non-Muslim. A theological question became constitutional law."
  },
  7: {
    title: "Did you know?",
    subtitle: "7th Amendment",
    body: "The 7th Amendment let the Prime Minister call a referendum to seek a personal vote of confidence from the electorate — bypassing Parliament entirely. It was passed in May 1977; two months later, the army took over."
  },
  8: {
    title: "Did you know?",
    subtitle: "8th Amendment",
    body: "The 8th Amendment shifted Pakistan from a parliamentary balance toward a stronger presidency, reshaping executive power for years. It also gave retroactive constitutional cover to all of Zia's martial law orders — meaning the courts couldn't touch them."
  },
  13: {
    title: "Did you know?",
    subtitle: "13th Amendment",
    body: "Before the 13th Amendment, Pakistani Prime Ministers could be dismissed by the President at will — and four were, between 1988 and 1996. This amendment abolished that power. It was repealed just six years later by the 17th Amendment."
  },
  17: {
    title: "Did you know?",
    subtitle: "17th Amendment",
    body: "The 17th Amendment, passed under General Musharraf, restored the President's power to dissolve Parliament — reversing what the 13th Amendment had achieved. It also validated all of Musharraf's extraconstitutional acts, a pattern Pakistan had seen before with the 8th Amendment under Zia."
  },
  18: {
    title: "Did you know?",
    subtitle: "18th Amendment",
    body: "The 18th Amendment altered roughly a third of the entire constitution in one go — the largest single overhaul in Pakistan's history. It devolved over 40 legislative subjects to the provinces, inserted new fundamental rights including the right to education and fair trial, and declared that any future abrogation of the constitution would be high treason."
  },
  21: {
    title: "Did you know?",
    subtitle: "21st Amendment",
    body: "The 21st Amendment was passed in a single day — January 6, 2015 — just weeks after the APS Peshawar school massacre killed 132 children. It created military courts for terrorism cases, a constitutional first for Pakistan in the democratic era."
  },
  25: {
    title: "Did you know?",
    subtitle: "25th Amendment",
    body: "The 25th Amendment ended over a century of special administrative status for the tribal belt. FATA — governed since British colonial times under a separate legal regime — was merged into Khyber Pakhtunkhwa, finally extending the constitution's fundamental rights to over 5 million people."
  },
  26: {
    title: "Did you know?",
    subtitle: "26th Amendment",
    body: "The 26th Amendment was passed in an overnight parliamentary session in October 2024. Critics called it the biggest attack on judicial independence in Pakistan's history — it restructured how judges are appointed and curtailed the Supreme Court's powers in a single legislative package."
  },
  27: {
    title: "Did you know?",
    subtitle: "27th Amendment",
    body: "The 27th Amendment created an entirely new apex court — the Federal Constitutional Court — stripping the Supreme Court of constitutional jurisdiction it had held since 1973. It also granted the President lifetime immunity from prosecution, a protection that previously ended with the presidential term."
  }
};

export const LANDMARK_SET = new Set(Object.keys(LANDMARK_CALLOUTS).map(Number));

export const DATE_FORMAT_OPTIONS = {
  day: "2-digit",
  month: "short",
  year: "numeric"
};

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
