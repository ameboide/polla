// Flag emoji for a country name. Most map to an ISO 3166-1 alpha-2 code turned
// into a regional-indicator pair; England/Scotland have no country code and use
// subdivision tag sequences instead. Unknown names return "" (render nothing).

const CODES = {
  Algeria: "DZ", Argentina: "AR", Australia: "AU", Austria: "AT", Belgium: "BE",
  "Bosnia and Herzegovina": "BA", Brazil: "BR", Canada: "CA", "Cape Verde": "CV",
  Colombia: "CO", Croatia: "HR", "Curaçao": "CW", "Czech Republic": "CZ",
  "DR Congo": "CD", Ecuador: "EC", Egypt: "EG", France: "FR", Germany: "DE",
  Ghana: "GH", Haiti: "HT", Iran: "IR", Iraq: "IQ", "Ivory Coast": "CI",
  Japan: "JP", Jordan: "JO", Mexico: "MX", Morocco: "MA", Netherlands: "NL",
  "New Zealand": "NZ", Norway: "NO", Panama: "PA", Paraguay: "PY", Portugal: "PT",
  Qatar: "QA", "Saudi Arabia": "SA", Senegal: "SN", "South Africa": "ZA",
  "South Korea": "KR", Spain: "ES", Sweden: "SE", Switzerland: "CH", Tunisia: "TN",
  Turkey: "TR", "United States": "US", Uruguay: "UY", Uzbekistan: "UZ",
};

// Subdivision flags: U+1F3F4 + tag letters of the subdivision code + cancel tag.
const SUBDIVISIONS = { England: "gbeng", Scotland: "gbsct" };

function regionalIndicator(code) {
  return [...code].map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join("");
}

function subdivisionFlag(tag) {
  const letters = [...tag].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("");
  return String.fromCodePoint(0x1f3f4) + letters + String.fromCodePoint(0xe007f);
}

export function flagFor(country) {
  if (SUBDIVISIONS[country]) return subdivisionFlag(SUBDIVISIONS[country]);
  const code = CODES[country];
  return code ? regionalIndicator(code) : "";
}
