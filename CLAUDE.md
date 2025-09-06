# PageNumGate - Part of NUM Gate Platform

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

### Development Guidelines
1. **Check NUM Gate first** before changing shared configs
2. **Test with gateway** after major changes
3. **Maintain consistent UI** with NUM Gate design system
4. **Follow RLS policies** from main project

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