# Bot Detection

Shield can spot and block automated traffic by looking at User-Agent strings and browser header patterns.

## Enable it

```ts
shield({
  botDetection: true,
  blockBots: ['scrapy', 'my-bad-scraper'],  // extra patterns to block
})
```

## What gets flagged

**Known bot user-agents:** scrapy, crawler, spider, curl, wget, httpie, python-requests, headlesschrome, phantomjs, ahrefsbot, semrushbot, dotbot.

**Suspicious signals:**
- No User-Agent header at all
- Missing standard browser headers (Accept, Accept-Language, Accept-Encoding)

## Using it standalone

You can also use the detection functions directly without the middleware:

```ts
import { detectBot, isKnownBot } from '@tumull/shield'

const result = detectBot(request, {
  blockPatterns: ['my-bad-bot'],
  allowPatterns: ['googlebot'],
  flagEmptyUA: true,
  checkHeaders: true,
})

if (result.isBot) {
  console.log(`Caught: ${result.reason} (confidence: ${result.confidence})`)
}

// or just a quick check
if (isKnownBot(userAgentString)) { /* block */ }
```

## Confidence scores

| Score | What it means |
|-------|--------------|
| 0.9 | Known bot UA match |
| 0.7 | Empty/missing UA |
| 0.6 | Missing all expected browser headers |
| 0.0 | Looks fine |
