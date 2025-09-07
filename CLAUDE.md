# PageNumGate - Part of NUM Gate Platform

## 🎯 FUNDAMENTAL PURPOSE: STATIC HTML PAGE BUILDER
**THIS IS A STATIC HTML PAGE BUILDER, NOT A REACT APP!**

### What We're Building:
- **Output**: Pure static HTML/CSS/JS files (NO React, NO frameworks)
- **Storage**: HTML files in Vercel Blob Storage
- **Serving**: Static HTML at `tenant.domain.com/page.html`
- **Admin Tool**: React (just for editing interface, NOT the output)

### Core Simplicity:
```
User creates HTML → Store in Blob → Serve as static file
```

### What AI Should Focus On:
1. **Creating beautiful HTML pages** with inline CSS
2. **Simple file operations** (create, edit, delete HTML files)
3. **Basic folder structure** for organization
4. **NO complex state**, NO React components in output

### Remember:
- We're building **websites**, not web apps
- Think **Squarespace/Wix**, not Next.js
- Output is **static HTML** that works anywhere
- Keep it SIMPLE - it's just HTML files!

## 🚨🚨🚨 CRITICAL: CLAUDE 4 AND OPUS 4.1 ONLY - NEVER CHANGE THIS! 🚨🚨🚨

### ⚠️ ABSOLUTE REQUIREMENT - NEVER EVER CHANGE THESE MODEL IDS ⚠️

**THE ONLY MODELS TO USE:**
1. **Claude Sonnet 4** - Model ID: `claude-sonnet-4-20250514`
   - Released: May 2025
   - This is the ONLY Sonnet model to use
   - NEVER use claude-3-5-sonnet or any other variant

2. **Claude Opus 4.1** - Model ID: `claude-opus-4-1-20250805`
   - Released: August 5, 2025
   - This is the ONLY Opus model to use
   - NEVER use claude-3-opus or any other variant

### ❌ NEVER USE THESE (THEY WILL CAUSE ERRORS):
- ❌ `claude-3-5-sonnet-20241022` - OLD MODEL, DO NOT USE
- ❌ `claude-3-opus-20240229` - OLD MODEL, DO NOT USE
- ❌ Any Claude 3.x models - USER SPECIFICALLY WANTS CLAUDE 4
- ❌ Any made-up model IDs that don't exist

### ✅ CORRECT MODEL IDS (MEMORIZE THESE):
```typescript
const CORRECT_MODELS = {
  'claude-sonnet-4': 'claude-sonnet-4-20250514',  // ONLY THIS
  'claude-opus-4-1': 'claude-opus-4-1-20250805'   // ONLY THIS
}
```

### 🔴 IF YOU SEE YOURSELF TYPING:
- "claude-3" - STOP! Use Claude 4
- "20241022" - STOP! That's the old model
- "20240229" - STOP! That's the old model

### 🟢 ALWAYS TYPE:
- "claude-sonnet-4-20250514" for Sonnet
- "claude-opus-4-1-20250805" for Opus

**THE USER HAS BEEN EXTREMELY CLEAR: USE CLAUDE 4 AND OPUS 4.1 ONLY!**

## 🚨 AI ASSISTANT IMPLEMENTATION INSTRUCTIONS 🚨

### CURRENT AI IMPLEMENTATION STATUS
The AI assistant uses 5 simple tools for static HTML page building:
1. **create_file** - Creates new HTML/CSS/JS files
2. **edit_file** - Modifies existing files  
3. **read_file** - Reads file contents
4. **delete_file** - Deletes files or folders
5. **list_files** - Lists folder contents

### CRITICAL: ALWAYS USE CLAUDE OPUS 4.1
- Model ID: `claude-opus-4-1-20250805`
- This is the ONLY model that should be used in `/app/api/ai/chat/route.ts`
- The AI knows it's building static HTML pages, NOT React components

## 🚨 CRITICAL: SMART TOOL PARAMETER EXTRACTION - NEVER FORGET THIS! 🚨

### AI MUST BE SMART ABOUT TOOL USAGE
Every tool requires specific parameters. The AI MUST:

1. **EXTRACT PARAMETERS FROM CONVERSATION**
   - User says "create a page for Levan" → Extract: filename="levan.html", generate complete HTML
   - User says "brutal design" → Apply brutalist styling with bold colors, harsh borders
   - User says "add payment form" → Look up products, extract product ID, determine price
   - NEVER call a tool with empty parameters `{}`

2. **SMART DEFAULTS FOR EVERY TOOL**
   - No filename given? Generate logical one (e.g., "new-page.html", "untitled.html")
   - No path given? Use current context path
   - No content specified? Generate appropriate placeholder content
   - Creating a "page"? Always use .html extension

3. **CONTENT GENERATION RULES**
   - HTML files: Always include complete valid structure with DOCTYPE
   - Apply requested styles immediately (brutal, modern, minimal)
   - Include requested messages/text prominently
   - Make content professional and complete, not just placeholders

4. **PARAMETER INFERENCE EXAMPLES**
   ```
   User: "Create a nice brutal design page with hello levan message"
   AI extracts:
   - path: "levan.html" (from name mentioned)
   - content: Complete HTML with brutal design and "Hello Levan" message
   
   User: "Add a webinar registration"
   AI extracts:
   - Must find webinar_id from context or ask
   - Determine fields needed
   - Place in logical location
   ```

5. **FUTURE TOOL DEVELOPMENT RULE**
   **EVERY NEW TOOL MUST FOLLOW THIS PATTERN:**
   - Clear parameter descriptions that guide extraction
   - Smart defaults for missing parameters
   - Context awareness (current folder, tenant, etc.)
   - Business data integration where relevant
   
   When adding new tools, ALWAYS ensure:
   - Tool description explains WHEN to use it
   - Parameter descriptions explain HOW to extract from conversation
   - Required parameters have fallback generation logic
   - Optional parameters have sensible defaults

**REMEMBER: The AI is a smart translator from human conversation to precise tool calls!**

## CRITICAL: Project Context
**This is NOT a standalone project.** PageNumGate is an integral part of the NUM Gate multi-tenant SaaS platform located at `/Users/apple/numgate`.

### Architecture Rules
- **Always maintain compatibility** with the main NUM Gate gateway
- **Never modify** JWT authentication flow - it must match the gateway
- **Tenant isolation is mandatory** - each tenant only sees their own data
- **Use shared Supabase instance** - same database as NUM Gate

## 🚨 CRITICAL: Multi-Tenant Architecture - NEVER FORGET THIS!

### How Multi-Tenancy Works for Published Pages

**EVERY TENANT HAS:**
1. **Their own subdomain**: `tenant-slug.domain.com` (e.g., `acme.numgate.com`)
2. **Optional custom domain**: `theircustomdomain.com` (if verified in database)
3. **Their own blob storage folder**: All files stored under `tenant-id/...`
4. **Complete isolation**: No shared resources between tenants

### Published Pages Access Pattern

When someone visits a published page:
- `tenant-a.numgate.com/products/index.html` → Serves Tenant A's file from their blob folder
- `tenant-b.numgate.com/products/index.html` → Serves Tenant B's file from their blob folder  
- `customdomain.com/about.html` → Serves that specific tenant's file

**THE DOMAIN IDENTIFIES THE TENANT - NOT A HARDCODED ID!**

### How to Identify Tenant for Public Pages

```typescript
// 1. Extract host from request
const host = request.headers.get('host') // e.g., "acme.numgate.com" or "customdomain.com"

// 2. Extract subdomain if it's a platform domain
if (host.includes('.numgate.com')) {
  const subdomain = host.split('.')[0] // "acme"
  // Look up tenant by slug
  const tenant = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', subdomain)
    .single()
} else {
  // It's a custom domain
  const tenant = await supabase
    .from('custom_domains')
    .select('tenant_id')
    .eq('domain', host)
    .eq('verified', true)
    .single()
}

// 3. Use that tenant's ID to fetch files
const tenantId = tenant.id
```

### NEVER DO THIS:
- ❌ Don't hardcode a "default" tenant ID in env files
- ❌ Don't serve one tenant's files for all domains
- ❌ Don't assume single-tenant architecture
- ❌ Don't use NEXT_PUBLIC_DEFAULT_TENANT_ID or similar

### File Storage Structure
```
blob-storage/
├── tenant-id-1/
│   ├── index.html
│   ├── products/
│   │   └── index.html
├── tenant-id-2/
│   ├── index.html
│   └── about.html
```
- **Proxy routing** - Served at `/page-builder` path via nginx/Vercel

### Shared Resources
- **Supabase**: Same instance as NUM Gate (hbopxprpgvrkucztsvnq)
- **JWT Secret**: Must match NUM Gate for cross-app auth
- **User Sessions**: Passed from NUM Gate via JWT tokens

### Blob Storage Architecture (Two Separate Stores)

#### 1. Tenant-Specific Blob (`BLOB_READ_WRITE_TOKEN`)
- **Purpose**: Stores individual tenant pages and files
- **Structure**: `{tenant-id}/pages/`, `{tenant-id}/media/`, `{tenant-id}/unpublished/`
- **Content**: User-created pages, uploaded media, tenant-specific configs
- **Access**: Isolated per tenant - each tenant only accesses their folder

#### 2. Shared Global Blob (`sharedblob_READ_WRITE_TOKEN`)
- **Purpose**: Global assets accessible by all tenants
- **Structure**: 
  ```
  _global/
    ├── components/     # Shadcn-based component library (JS/CSS)
    ├── themes/        # Theme presets (Neo-brutalism, Neomorphic, etc.)
    ├── stock-images/  # Stock photos and illustrations
    └── libraries/     # Shared utilities and scripts
  ```
- **Content**: Components, theme configs, stock media, shared libraries
- **Access**: Read-only for all tenants, managed centrally
- **Usage**: Referenced in tenant pages via CDN URLs

### Deployment Strategy
- **NEVER deploy directly to Vercel** - Always push to GitHub
- GitHub is connected to Vercel for automatic deployments
- Workflow: Make changes → Commit → Push to GitHub → Vercel auto-deploys
- This ensures version control and consistent deployment pipeline

### Development Guidelines
1. **Check NUM Gate first** before changing shared configs
2. **Test with gateway** after major changes
3. **Maintain consistent UI** with NUM Gate design system
4. **Follow RLS policies** from main project
5. **Test locally on http://localhost:3001** before pushing

### File Structure in Blob
```
{tenant_id}/
  ├── homepage/
  │   └── index.html
  ├── pages/
  │   ├── about.html
  │   └── contact.html
  └── assets/
      └── styles.css
```

### Key Dependencies
- Next.js 15.5.2 (must stay aligned with NUM Gate)
- Supabase client (shared configuration)
- Vercel Blob (shared token)
- JWT validation (shared secret)