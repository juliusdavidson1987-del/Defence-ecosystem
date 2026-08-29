import fs from "fs";

function fail(msg) {
  console.error("❌ Validation failed:", msg);
  process.exit(1);
}

function ok(msg) {
  console.log("✅", msg);
}

// --- Read file ---
const file = process.argv[2];
if (!file) fail("No HTML file provided");

let html;
try {
  html = fs.readFileSync(file, "utf8");
} catch (e) {
  fail("Cannot read file: " + file);
}

// --- Basic HTML checks ---
if (!html.includes("<html")) {
  fail("Missing <html> tag");
}

if (!html.includes("</html>")) {
  fail("Missing </html> closing tag");
}

if (!html.includes("<body")) {
  fail("Missing <body> tag");
}

if (!html.includes("</body>")) {
  fail("Missing </body> closing tag");
}

// --- Tag balance check ---
const openTags = [];
const tagRegex = /<\/?([a-zA-Z0-9\-]+)[^>]*>/g;

let match;
while ((match = tagRegex.exec(html)) !== null) {
  const tag = match[1];

  if (match[0].startsWith("</")) {
    // closing tag
    if (openTags[openTags.length - 1] === tag) {
      openTags.pop();
    } else {
      fail(`Unbalanced closing tag: </${tag}>`);
    }
  } else {
    // opening tag
    if (!match[0].endsWith("/>")) {
      openTags.push(tag);
    }
  }
}

if (openTags.length > 0) {
  fail("Unclosed tags: " + openTags.join(", "));
}

// --- Inline JS syntax check ---
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
let scriptMatch;

while ((scriptMatch = scriptRegex.exec(html)) !== null) {
  const js = scriptMatch[1];

  try {
    new Function(js);
  } catch (e) {
    fail("JavaScript syntax error: " + e.message);
  }
}

ok("HTML + JS validation passed");
