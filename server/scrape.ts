import * as cheerio from "cheerio";

interface ScrapeResult {
  name: string;
  price: number;
  imageUrl: string;
}

const JSONLINK_API_KEY = process.env.JSONLINK_API_KEY || "";

/**
 * Scrape product details from a URL.
 * Strategy: run jsonlink.io API (for name/image on JS-rendered pages) and
 * direct fetch (for price) in parallel, then merge. Amazon URLs additionally
 * fall back to extracting the product name from the URL path when both
 * approaches return boilerplate (Amazon's bot-detection page).
 */
export async function scrapeProductLink(url: string): Promise<ScrapeResult> {
  const [apiResult, directResult] = await Promise.all([
    tryJsonLinkApi(url),
    tryDirectFetch(url),
  ]);

  // Merge: prefer API for name/image (better for JS-rendered pages),
  // prefer direct fetch for price (the API doesn't return prices reliably).
  let name = apiResult?.name || directResult.name;
  const imageUrl = apiResult?.imageUrl || directResult.imageUrl;
  const price = directResult.price || apiResult?.price || 0;

  // Amazon-specific fallback: extract name from URL path structure when
  // both API and direct fetch returned a boilerplate / bot-detection title.
  // e.g. /Graco-SnugRide-35-Infant-Car-Seat/dp/B01MT5ST6M → "Graco SnugRide 35 Infant Car Seat"
  if (isAmazonUrl(url) && isAmazonBoilerplate(name)) {
    name = extractAmazonNameFromUrl(url) || name;
  }

  return { name, price, imageUrl };
}

function isAmazonBoilerplate(name: string): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  return (
    /^amazon/i.test(trimmed) ||
    /^(robot check|sorry!|page not found|access denied|service unavailable)/i.test(
      trimmed
    )
  );
}

async function tryJsonLinkApi(url: string): Promise<ScrapeResult | null> {
  if (!JSONLINK_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const apiUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}&api_key=${JSONLINK_API_KEY}`;
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return null;

    const data = (await res.json()) as Record<string, unknown>;
    // jsonlink.io returns { success: false, error: ... } when the account is blocked/limited
    if (data.success === false) return null;

    let name = typeof data.title === "string" ? data.title.trim() : "";
    name = name.replace(
      /\s*[:\-|–—]\s*(Target|Amazon\.com|Walmart|Etsy|IKEA|Babylist|buybuy BABY)\s*$/i,
      ""
    ).trim();

    const imageUrl = extractImageFromApiResponse(data);
    return { name, price: 0, imageUrl };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractImageFromApiResponse(data: Record<string, unknown>): string {
  if (Array.isArray(data.images) && data.images.length > 0) {
    const img = data.images[0];
    if (typeof img === "string" && img.startsWith("http")) return img;
  }
  if (typeof data.image === "string" && data.image.startsWith("http")) return data.image;
  return "";
}

function isAmazonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("amazon.");
  } catch {
    return false;
  }
}

/**
 * Extract product name from Amazon URL path.
 * Amazon embeds the product title in the URL before /dp/:
 *   /Some-Product-Name/dp/ASIN  →  "Some Product Name"
 */
function extractAmazonNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    // Match /slug/dp/ASIN — the slug is the URL-encoded product title
    const match = pathname.match(/^\/(.+?)\/dp\//i);
    if (match) {
      const slug = match[1];
      // Avoid returning "dp" itself (bare /dp/ASIN URLs have no slug)
      if (!slug || slug.toLowerCase() === "dp") return "";
      return decodeURIComponent(slug).replace(/-/g, " ").replace(/\s+/g, " ").trim();
    }
  } catch {
    // ignore
  }
  return "";
}

async function tryDirectFetch(url: string): Promise<ScrapeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Realistic Chrome 122 on macOS headers
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    if (!res.ok) return { name: "", price: 0, imageUrl: "" };
    html = await res.text();
  } catch {
    return { name: "", price: 0, imageUrl: "" };
  } finally {
    clearTimeout(timeout);
  }

  const $ = cheerio.load(html);

  // Parse JSON-LD structured data first — most reliable source
  let jsonLdProduct: Record<string, unknown> | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text()) as Record<string, unknown>;
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data["@graph"])
        ? (data["@graph"] as unknown[])
        : [data];
      for (const item of items) {
        const obj = item as Record<string, unknown>;
        const type = obj["@type"];
        if (
          type === "Product" ||
          (Array.isArray(type) && (type as string[]).includes("Product"))
        ) {
          jsonLdProduct = obj;
          return false; // break .each
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  const name = extractName($, jsonLdProduct);
  const price = extractPrice($, jsonLdProduct);
  const imageUrl = extractImage($, jsonLdProduct, url);

  return { name, price, imageUrl };
}

function extractName(
  $: cheerio.CheerioAPI,
  jsonLd: Record<string, unknown> | null
): string {
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) {
    // Strip trailing site name suffixes: "Some Product - Amazon.com" → "Some Product"
    return ogTitle.replace(/\s*[:\-|–—]\s*(Amazon\.com|Target|Walmart|Babylist|buybuy BABY|IKEA|Etsy)\s*$/i, "").trim();
  }

  if (jsonLd?.name && typeof jsonLd.name === "string") return jsonLd.name.trim();

  const title = $("title").text().trim();
  if (title) {
    const stripped = title.split(/\s*[|\-–—]\s*/).slice(0, -1).join(" - ");
    return stripped || title;
  }

  return "";
}

function extractPrice(
  $: cheerio.CheerioAPI,
  jsonLd: Record<string, unknown> | null
): number {
  if (jsonLd?.offers) {
    const offerList = Array.isArray(jsonLd.offers)
      ? (jsonLd.offers as Record<string, unknown>[])
      : [jsonLd.offers as Record<string, unknown>];
    for (const offer of offerList) {
      const p = offer.price ?? offer.lowPrice;
      if (p !== undefined) {
        const val = parseFloat(String(p));
        if (!isNaN(val)) return val;
      }
    }
  }

  for (const prop of ["product:price:amount", "og:price:amount"]) {
    const content = $(`meta[property="${prop}"]`).attr("content");
    if (content) {
      const val = parseFloat(content);
      if (!isNaN(val)) return val;
    }
  }

  const pricePattern = /\$\s?(\d{1,6}(?:[,.]\d{1,2})?)/;
  const priceSelectors = [
    '[class*="price" i]',
    '[id*="price" i]',
    "[data-price]",
    '[class*="Price"]',
  ];
  for (const selector of priceSelectors) {
    const text = $(selector).first().text();
    const match = text.match(pricePattern);
    if (match) {
      const val = parseFloat(match[1].replace(",", ""));
      if (!isNaN(val)) return val;
    }
  }

  return 0;
}

function extractImage(
  $: cheerio.CheerioAPI,
  jsonLd: Record<string, unknown> | null,
  baseUrl: string
): string {
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  if (ogImage) return resolveUrl(ogImage, baseUrl);

  if (jsonLd?.image) {
    const img = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
    const imgStr =
      typeof img === "string"
        ? img
        : (img as Record<string, unknown>)?.url;
    if (typeof imgStr === "string") return resolveUrl(imgStr.trim(), baseUrl);
  }

  const twitterImage = $('meta[name="twitter:image"]').attr("content")?.trim();
  if (twitterImage) return resolveUrl(twitterImage, baseUrl);

  return "";
}

function resolveUrl(url: string, base: string): string {
  try {
    const resolved = new URL(url, base).href;
    return resolved.startsWith("http") ? resolved : "";
  } catch {
    return "";
  }
}
