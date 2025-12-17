# DocSanitizer - Sensitive Information Detection Flow

## Overview

DocSanitizer uses a multi-layered detection system to identify and mask sensitive information in documents. The system combines regex-based pattern matching, Natural Language Processing (NLP), and user-defined custom patterns.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT INPUT                                     │
│                    (PDF, DOCX, XLSX, TXT, MD, CSV)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT PARSER                                      │
│                    (electron/services/document-parser.ts)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  PDF Parse  │  │ DOCX Parse  │  │ XLSX Parse  │  │  TXT/MD     │        │
│  │  (pdf-parse)│  │  (mammoth)  │  │   (xlsx)    │  │  (raw)      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   PLAIN TEXT        │
                         │   CONTENT           │
                         └─────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌───────────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐
│   REGEX DETECTOR      │ │  NER ENGINE     │ │   CUSTOM PATTERNS           │
│   (detector.ts)       │ │  (ner.ts)       │ │   (User Config)             │
│   [PRIMARY]           │ │  [SECONDARY]    │ │                             │
│                       │ │                 │ │                             │
│ • Email               │ │ • Person Names  │ │ • Company Name + Aliases    │
│ • Phone Numbers       │ │   (custom only) │ │ • Internal Domains          │
│ • National IDs        │ │ • Organizations │ │ • Custom Keywords           │
│ • Credit Cards        │ │ • Money (with   │ │ • Client Names              │
│ • IBANs               │ │   symbols only) │ │ • Project Names             │
│ • SSN                 │ │ • IP Addresses  │ │                             │
│ • IP Addresses        │ │                 │ │                             │
│ • URLs/Domains        │ │ Uses:           │ │                             │
│ • API Keys            │ │ • compromise.js │ │                             │
│ • Credentials         │ │ • Custom regex  │ │                             │
│ • Financial Data      │ │                 │ │                             │
└───────────────────────┘ └─────────────────┘ └─────────────────────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     DEDUPLICATION             │
                    │  (Remove overlapping matches) │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │     DETECTION RESULTS         │
                    │  (Sorted by position)         │
                    └───────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REVIEW STEP (UI)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  User Reviews & Approves/Rejects Each Detection                     │    │
│  │  • Filter by category                                               │    │
│  │  • Search detections                                                │    │
│  │  • Sort by text/category/replacement                                │    │
│  │  • Bulk select/deselect                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MASKING ENGINE                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Replace approved detections with placeholders                      │    │
│  │  "John Smith" → [PERSON_1]                                          │    │
│  │  "$5,000"     → [AMOUNT_1]                                          │    │
│  │  "john@ex.com"→ [EMAIL_1]                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXPORT                                              │
│                  (Sanitized Document + Mapping File)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detection Flow Sequence

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Upload  │────▶│  Parse   │────▶│  Detect  │────▶│  Review  │────▶│  Export  │
│  Step    │     │  Document│     │  Entities│     │  Step    │     │  Step    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │                │
     │                │                │                │                │
     ▼                ▼                ▼                ▼                ▼
  User drops      Extract text     Run all         User approves    Generate
  file into       from document    detection       or rejects       sanitized
  drop zone       (PDF, DOCX,      engines in      detections       output
                  XLSX, etc.)      parallel
```

---

## Detection Categories

### Category Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DETECTION CATEGORIES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │     PII     │  │   COMPANY   │  │  FINANCIAL  │  │  TECHNICAL  │       │
│  │  (Personal) │  │             │  │             │  │             │       │
│  │             │  │             │  │             │  │             │       │
│  │ • Names     │  │ • Company   │  │ • Currency  │  │ • IPs       │       │
│  │ • Emails    │  │   Names     │  │ • Amounts   │  │ • URLs      │       │
│  │ • Phones    │  │ • Orgs      │  │ • Accounts  │  │ • Domains   │       │
│  │ • IDs       │  │             │  │ • Cards     │  │ • API Keys  │       │
│  │ • Addresses │  │             │  │ • IBANs     │  │ • Creds     │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│                          ┌─────────────┐                                    │
│                          │   CUSTOM    │                                    │
│                          │             │                                    │
│                          │ • Keywords  │                                    │
│                          │ • Clients   │                                    │
│                          │ • Projects  │                                    │
│                          └─────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detection Sources

### 1. Regex-Based Detection (detector.ts)

Primary pattern-matching engine using regular expressions with optional validators.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REGEX DETECTION ENGINE                                    │
│                       (src/lib/detector.ts)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Input Text ──────▶ ┌────────────────────┐                                │
│                      │  For each rule:    │                                │
│                      │  1. Apply regex    │                                │
│                      │  2. Run validator  │                                │
│                      │  3. Check position │                                │
│                      └────────────────────┘                                │
│                               │                                             │
│                               ▼                                             │
│                      ┌────────────────────┐                                │
│                      │  Validators:       │                                │
│                      │  • Luhn (cards)    │                                │
│                      │  • IBAN structure  │                                │
│                      │  • Email format    │                                │
│                      │  • IPv4 validity   │                                │
│                      └────────────────────┘                                │
│                               │                                             │
│                               ▼                                             │
│                      ┌────────────────────┐                                │
│                      │  Detection Object  │                                │
│                      │  • id              │                                │
│                      │  • text            │                                │
│                      │  • category        │                                │
│                      │  • confidence      │                                │
│                      │  • position        │                                │
│                      │  • placeholder     │                                │
│                      └────────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. NER-Based Detection (ner.ts) - Secondary Engine

Natural Language Processing engine using compromise.js and custom patterns. This engine runs after the Regex engine and provides additional NLP-based detection.

**Precedence Note:** The Regex engine (detector.ts) runs first as the primary detection source. NER results are merged and deduplicated based on position - if the regex engine already detected something at a position, NER won't add a duplicate.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NER DETECTION ENGINE                                    │
│                    (electron/services/ner.ts)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Input Text ──────▶ ┌────────────────────┐                                │
│                      │   compromise.js    │                                │
│                      │   NLP Library      │                                │
│                      └────────────────────┘                                │
│                               │                                             │
│              ┌────────────────┴────────────────┐                           │
│              │                                 │                           │
│              ▼                                 ▼                           │
│     ┌──────────────┐                  ┌──────────────┐                    │
│     │ Organizations│                  │ Custom Names │                    │
│     │ doc.orgs()   │                  │ (User List)  │                    │
│     └──────────────┘                  └──────────────┘                    │
│                                                                             │
│   Custom Regex ────▶ ┌────────────────────┐                                │
│                      │  Money Patterns    │                                │
│                      │  (with symbols)    │                                │
│                      └────────────────────┘                                │
│                               │                                             │
│   Custom Regex ────▶ ┌────────────────────┐                                │
│                      │  IP Address        │                                │
│                      │  (IPv4 & IPv6)     │                                │
│                      └────────────────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. User-Configured Detection

Custom patterns defined by the user in the configuration.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    USER-CONFIGURED DETECTION                                 │
│                         (Config Object)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   config.companyInfo                                                        │
│   ├── primaryName ──────────▶ "Acme Corporation"                           │
│   ├── aliases ──────────────▶ ["Acme", "Acme Corp", "ACME Inc"]            │
│   └── internalDomains ──────▶ ["acme.internal", "acme.local"]              │
│                                                                             │
│   config.customEntities                                                     │
│   ├── names ────────────────▶ ["John Smith", "Jane Doe"]                   │
│   ├── keywords ─────────────▶ ["Project X", "Classified"]                  │
│   ├── clients ──────────────▶ [{name: "BigCorp", aliases: ["BC"]}]         │
│   └── projects ─────────────▶ [{name: "Alpha", aliases: ["Proj-A"]}]       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Detection Reference

### PII (Personal Information)

| ID | Subcategory | Detection Name | Pattern | Confidence | Validator |
|----|-------------|----------------|---------|------------|-----------|
| `pii-email` | email | Email Address | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | 95% | isValidEmail |
| `pii-phone-intl` | phone | Phone (International) | `(?:\+?[1-9]\d{0,2}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}` | 80% | - |
| `pii-saudi-phone` | phone | Saudi Phone | `(?:\+?966\|00966\|0)?5[0-9]{8}` | 90% | - |
| `pii-saudi-id` | national_id | Saudi National ID | `\b[12]\d{9}\b` | 85% | - |
| `pii-iqama` | national_id | Iqama Number | `\b2\d{9}\b` | 80% | - |
| `pii-ssn` | ssn | US Social Security | `\b\d{3}-\d{2}-\d{4}\b` | 95% | - |
| `pii-iban` | iban | IBAN (General) | `\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b` | 90% | isValidIBAN |
| `pii-saudi-iban` | iban | Saudi IBAN | `\bSA\d{2}[A-Z0-9]{20}\b` | 95% | isValidIBAN |
| `pii-credit-card` | credit_card | Credit Card | `\b(?:\d{4}[-\s]?){3}\d{4}\b` | 85% | isValidLuhn |
| `pii-passport` | passport | Passport Number | `\b[A-Z]{1,2}\d{6,9}\b` | 70% | - |
| `pii-address` | address | Street Address | `\b\d{1,5}\s+[\w\s]{1,30}(?:street\|st\|avenue\|...)` | 75% | - |
| `pii-zip-us` | address | US ZIP Code | `\b\d{5}(?:-\d{4})?\b` | 60% | - |
| `pii-driver-license` | license | Driver License | `\b(?:DL\|driver'?s?\s*license)[#:\s]*[A-Z0-9]{6,15}\b` | 80% | - |
| `ner-person` | person_name | Person Name | Custom names list only | 75-100% | - |

### Company

| ID | Subcategory | Detection Name | Pattern | Confidence |
|----|-------------|----------------|---------|------------|
| `company-name` | company_name | Company Name | User-configured | 100% |
| `ner-org` | organization | Organization | NLP extraction | 70% |

### Financial

| ID | Subcategory | Detection Name | Pattern | Confidence |
|----|-------------|----------------|---------|------------|
| `fin-currency` | amount | Currency Amount | Symbols + numbers | 80% |
| `fin-large-number` | amount | Large Number | `\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b` | 60% |
| `fin-account` | account | Account Number | `\b(?:account\|acct\|a\/c)[#:\s]*\d{6,20}\b` | 85% |
| `fin-percentage` | percentage | Percentage | `\b\d+(?:\.\d+)?%\b` | 50% |

### Technical

| ID | Subcategory | Detection Name | Pattern | Confidence |
|----|-------------|----------------|---------|------------|
| `tech-ipv4` | ip_address | IPv4 Address | `\b(?:(?:25[0-5]\|2[0-4][0-9]\|...)\.){3}...\b` | 95% |
| `tech-ipv6` | ip_address | IPv6 Address | `\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b` | 95% |
| `tech-domain` | domain | Domain Name | Common TLDs pattern | 80% |
| `tech-url` | url | Full URL | `\bhttps?:\/\/[^\s<>"{}|\\^`[\]]+` | 85% |
| `tech-api-key` | api_key | Generic API Key | `(?:api[_-]?key\|...)=["']?([a-zA-Z0-9_-]{20,})` | 90% |
| `tech-aws-key` | api_key | AWS Access Key | `\b(?:AKIA\|ABIA\|ACCA\|ASIA)[A-Z0-9]{16}\b` | 95% |
| `tech-aws-secret` | api_key | AWS Secret Key | `\b[A-Za-z0-9/+=]{40}\b` | 60% |
| `tech-github-token` | api_key | GitHub Token | `\b(?:ghp\|gho\|ghu\|ghs\|ghr)_[a-zA-Z0-9]{36,}\b` | 98% |
| `tech-slack-token` | api_key | Slack Token | `\bxox[pbar]-[0-9]{10,}-...` | 98% |
| `tech-google-api` | api_key | Google API Key | `\bAIza[0-9A-Za-z_-]{35}\b` | 95% |
| `tech-stripe-key` | api_key | Stripe API Key | `\b(?:sk\|pk)_(?:test\|live)_[0-9a-zA-Z]{24,}\b` | 98% |
| `tech-url-creds` | credentials | URL with Credentials | `https?:\/\/[^:]+:[^@]+@[^\s]+` | 95% |
| `tech-private-key` | credentials | Private Key | `-----BEGIN (?:RSA\|...)? PRIVATE KEY-----` | 100% |
| `tech-jwt` | credentials | JWT Token | `\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\....` | 95% |
| `tech-db-connection` | credentials | Database Connection | `(?:mongodb\|mysql\|postgresql\|...):\/\/...` | 95% |
| `tech-mac-address` | device_id | MAC Address | `\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b` | 90% |
| `tech-uuid` | identifier | UUID | `\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-...\b` | 85% |

### Custom

| ID | Subcategory | Detection Name | Source | Confidence |
|----|-------------|----------------|--------|------------|
| `custom-keyword` | keyword | Custom Keyword | User config | 100% |
| `custom-client` | client | Client Name | User config | 100% |
| `custom-project` | project | Project Name | User config | 100% |

---

## Currency Detection (NER)

The NER engine detects money **only** with explicit currency indicators:

### Supported Currency Symbols

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CURRENCY SYMBOLS & CODES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SYMBOLS                          CODES                                     │
│  ────────                         ─────                                     │
│  $  - US Dollar                   USD - US Dollar                          │
│  €  - Euro                        EUR - Euro                               │
│  £  - British Pound               GBP - British Pound                      │
│  ¥  - Japanese Yen                JPY - Japanese Yen                       │
│  ₹  - Indian Rupee                INR - Indian Rupee                       │
│                                   SAR - Saudi Riyal                        │
│                                   SR  - Saudi Riyal (short)                │
│                                   AED - UAE Dirham                         │
│                                   CHF - Swiss Franc                        │
│                                                                             │
│  WORDS                                                                      │
│  ─────                                                                      │
│  dollars, euros, pounds, riyals, dirhams, yen, rupees                      │
│                                                                             │
│  EXAMPLES (Detected)              EXAMPLES (NOT Detected)                   │
│  ───────────────────              ───────────────────────                   │
│  $100                             100                                       │
│  €1,500.00                        1,500                                     │
│  SAR 10,000                       10000                                     │
│  500 dollars                      500 items                                 │
│  £75K                             75K views                                 │
│  $2.5 million                     2.5 million users                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Name Detection (NER)

### Important: Custom Names Only

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NAME DETECTION BEHAVIOR                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║  NAMES ARE ONLY DETECTED IF EXPLICITLY ADDED TO CUSTOM NAMES LIST     ║ │
│  ╚═══════════════════════════════════════════════════════════════════════╝ │
│                                                                             │
│  This prevents false positives from common words that look like names.     │
│                                                                             │
│  DETECTED (if in custom list):        NOT DETECTED (unless in list):       │
│  ─────────────────────────────        ──────────────────────────────       │
│  "John Smith" ✓ (if configured)       "John Smith" ✗ (auto-detection)      │
│  "Mohammed Al-Faisal" ✓               "Dear Mr. Anderson" ✗                │
│                                       "CEO: Elizabeth Warren" ✗            │
│                                                                             │
│  TO DETECT A NAME:                                                          │
│  1. Add it to config.customEntities.names                                  │
│  2. Or add it to the Custom Names field in the UI                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Masking Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MASKING PROCESS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ORIGINAL TEXT:                                                             │
│  ─────────────                                                              │
│  "Please contact John Smith at john@acme.com. The project budget           │
│   is $50,000 and the server IP is 192.168.1.100."                          │
│                                                                             │
│                              │                                              │
│                              ▼                                              │
│                                                                             │
│  DETECTIONS (if approved):                                                  │
│  ─────────────────────────                                                  │
│  ┌──────────────────┬─────────────┬─────────────────────┐                  │
│  │ Text             │ Category    │ Placeholder         │                  │
│  ├──────────────────┼─────────────┼─────────────────────┤                  │
│  │ John Smith       │ pii         │ [PERSON_1]          │                  │
│  │ john@acme.com    │ pii         │ [EMAIL_1]           │                  │
│  │ $50,000          │ financial   │ [AMOUNT_1]          │                  │
│  │ 192.168.1.100    │ technical   │ [IP_ADDRESS_1]      │                  │
│  └──────────────────┴─────────────┴─────────────────────┘                  │
│                                                                             │
│                              │                                              │
│                              ▼                                              │
│                                                                             │
│  SANITIZED OUTPUT:                                                          │
│  ────────────────                                                           │
│  "Please contact [PERSON_1] at [EMAIL_1]. The project budget               │
│   is [AMOUNT_1] and the server IP is [IP_ADDRESS_1]."                      │
│                                                                             │
│                              │                                              │
│                              ▼                                              │
│                                                                             │
│  MAPPING FILE (optional):                                                   │
│  ────────────────────────                                                   │
│  {                                                                          │
│    "[PERSON_1]": ["John Smith"],                                           │
│    "[EMAIL_1]": ["john@acme.com"],                                         │
│    "[AMOUNT_1]": ["$50,000"],                                              │
│    "[IP_ADDRESS_1]": ["192.168.1.100"]                                     │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Confidence Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONFIDENCE LEVELS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HIGH (90-100%)                                                             │
│  ──────────────                                                             │
│  • User-configured names, keywords, clients, projects (100%)               │
│  • Private keys (100%)                                                      │
│  • GitHub/Slack/Stripe tokens (98%)                                        │
│  • IP addresses, SSN, Saudi IBAN (95%)                                     │
│  • AWS keys, Google API keys, JWT tokens (95%)                             │
│  • Email addresses (95%)                                                    │
│  • Saudi phone numbers (90%)                                                │
│  • MAC addresses, general IBAN (90%)                                       │
│                                                                             │
│  MEDIUM (70-89%)                                                            │
│  ───────────────                                                            │
│  • Credit cards (85% + Luhn validation)                                    │
│  • Account numbers, Saudi National ID (85%)                                │
│  • URLs, UUIDs (85%)                                                        │
│  • International phone, driver license, Iqama (80%)                        │
│  • Domain names, currency amounts (80%)                                    │
│  • Street addresses (75%)                                                   │
│  • NER person names (75%)                                                   │
│  • Passport numbers (70%)                                                   │
│  • NER organizations (70%)                                                  │
│                                                                             │
│  LOW (Below 70%)                                                            │
│  ───────────────                                                            │
│  • Large numbers (60%)                                                      │
│  • US ZIP codes (60%)                                                       │
│  • AWS secret keys (60%)                                                    │
│  • Percentages (50%)                                                        │
│                                                                             │
│  Auto-mask threshold: 90% (configurable)                                   │
│  Minimum confidence: User-configurable filter                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Support

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPPORTED FILE FORMATS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FORMAT          EXTENSION       PARSER                                     │
│  ──────          ─────────       ──────                                     │
│  PDF             .pdf            pdf-parse                                  │
│  Word            .docx, .doc     mammoth                                    │
│  Excel           .xlsx, .xls     xlsx                                       │
│  CSV             .csv            raw text                                   │
│  Plain Text      .txt            raw text                                   │
│  Markdown        .md             raw text                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Schema

```typescript
interface Config {
  companyInfo: {
    primaryName: string       // Main company name
    aliases: string[]         // Alternative names
    domain: string            // Primary domain
    internalDomains: string[] // Internal domains to detect
  }
  customEntities: {
    clients: NamedEntity[]    // Client names + aliases
    projects: NamedEntity[]   // Project names + aliases
    products: NamedEntity[]   // Product names + aliases
    keywords: string[]        // Custom keywords
    names: string[]           // Person names to detect
  }
  detectionSettings: {
    minConfidence: number           // Minimum confidence threshold
    autoMaskHighConfidence: boolean // Auto-approve high confidence
    categoriesEnabled: DetectionCategory[] // Enabled categories
  }
  exportPreferences: {
    includeMappingFile: boolean     // Include mapping in export
    defaultFormat: 'same' | 'txt' | 'md'
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial release with regex + NER detection, pure shadcn UI |
| 1.1 | 2024 | Removed location/place detection, removed date detection, added IP address detection to NER, clarified detection engine precedence |

---

## Testing

The detection system has been validated with:
- **73 detection tests** (100% pass rate)
- **225 false positive tests** (100% pass rate)

Test categories include:
- Money with/without currency symbols
- Names (custom only - no automatic detection)
- Organizations (NLP-based)
- IP addresses (IPv4 and IPv6)
- Plain numbers, measurements, percentages
- Technical terms, code snippets
- Common words that look like names

## Detection Engine Precedence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETECTION ENGINE PRECEDENCE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. REGEX ENGINE (detector.ts) - PRIMARY                                    │
│     ─────────────────────────────────────                                   │
│     • Runs first                                                            │
│     • 40+ pattern rules with validators                                     │
│     • High precision, low false positives                                   │
│     • Handles: PII, financial, technical, credentials                       │
│                                                                             │
│  2. NER ENGINE (ner.ts) - SECONDARY                                         │
│     ────────────────────────────────────                                    │
│     • Runs after regex engine                                               │
│     • Uses compromise.js NLP library                                        │
│     • Handles: Organizations, custom names, money, IP addresses             │
│     • Results merged and deduplicated by position                           │
│                                                                             │
│  3. CUSTOM PATTERNS (User Config) - HIGHEST PRIORITY                        │
│     ─────────────────────────────────────────────────                       │
│     • User-defined names, keywords, clients, projects                       │
│     • Always 100% confidence                                                │
│     • Cannot be overridden by other detectors                               │
│                                                                             │
│  DEDUPLICATION RULE:                                                        │
│  ───────────────────                                                        │
│  If multiple engines detect at the same position, the first detection       │
│  (by processing order) wins. Regex results take precedence over NER.        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
