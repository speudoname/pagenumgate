# PageNumGate - Static HTML Page Builder CLAUDE.md

## 🎯 PROJECT CONTEXT
**PageNumGate is a PROXIED APPLICATION within the NumGate multi-tenant SaaS platform.** It provides static HTML page building functionality and is accessed ONLY through the NumGate gateway.

### Architecture Overview
- **Proxy Access Only**: Accessed via NumGate at `/page-builder` route
- **Gateway Dependency**: NumGate handles authentication and tenant management
- **JWT Authentication**: Uses NumGate's JWT tokens (shared secret)
- **Tenant Isolation**: Strict tenant-based data separation
- **Shared Infrastructure**: Same Supabase instance as NumGate

### Integration with NumGate
- **Authentication**: Receives JWT tokens from NumGate gateway
- **Tenant Context**: Gets tenant_id from JWT headers
- **Data Isolation**: All queries filtered by tenant_id
- **Proxy Routing**: Never accessed directly, always through gateway

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

## 🔒 CRITICAL SECURITY RULES

### Authentication Pattern (MUST MATCH NUMGATE)
- **Custom JWT Authentication** (not Supabase Auth)
- **Service Key Pattern**: Use `supabaseAdmin` with STRICT tenant filtering
- **Security Rule**: EVERY query MUST include `.eq('tenant_id', tenantId)`

### Service Key Usage
```typescript
// ✅ CORRECT - Always filter by tenant
const { data } = await supabaseAdmin
  .from('table_name')
  .select('*')
  .eq('tenant_id', tenantId) // MANDATORY
```

### Security Checklist
1. ✅ Use service key with MANDATORY tenant filtering
2. ✅ Validate JWT token from NumGate gateway
3. ✅ Check user belongs to tenant
4. ✅ NEVER trust client-provided tenant_id
5. ✅ Validate ALL inputs with zod schemas

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

### Publishing Mechanism

**IMPORTANT: Publishing is determined by file location, NOT by toggles or flags**

- **Published Files**: Any file in the root directory or regular folders is automatically published and served by NumGate
- **Unpublished Files**: Files inside the `unpublished/` folder are NOT served by NumGate
- **How to Publish**: Move file OUT of the `unpublished/` folder (right-click → Publish in UI)
- **How to Unpublish**: Move file INTO the `unpublished/` folder (right-click → Unpublish in UI)

**There are NO publish/unpublish toggles or database flags** - it's purely based on file location. NumGate automatically filters out any files in `unpublished/` folders when serving pages.

## 🎨 UI/UX STANDARDS
- **USE NEOBRUTALISM.DEV EXCLUSIVELY**: All UI components from NeoBrutalism.dev
- **NO CUSTOM COMPONENTS**: Never create custom UI elements
- **STRICT ADHERENCE**: Copy exact code from neobrutalism.dev
- **NO EXCEPTIONS**: No custom styling allowed

## 🚀 DEPLOYMENT STRATEGY
- **NEVER deploy directly to Vercel**
- **ALWAYS push to GitHub first** → Auto-deployment
- **Workflow**: Changes → Build locally → Commit → Push → Auto-deploy

## 🛠️ DEVELOPMENT RULES
- **NEVER ASSUME**: Always align with user before implementation
- **ASK QUESTIONS**: When unclear, ask for clarification
- **SLOW AND STEADY**: Build incrementally, verify each step
- **CONFIRM APPROACH**: Explain approach and get approval

## 🔧 AVAILABLE TOOLS & ACCESS
- **Vercel CLI**: Full access to Vercel platform
- **Supabase**: Complete access to database (hbopxprpgvrkucztsvnq)
- **Postmark**: Full email system access and configuration
- **Environment Variables**: All necessary keys and secrets available
- **GitHub**: Full repository access for deployment

## 📋 DEVELOPMENT WORKFLOW
1. **Always test with NumGate** - Never access PageNumGate directly
2. **Maintain JWT compatibility** - Must match NumGate gateway
3. **Use service key** - With tenant filtering
4. **Follow security patterns** - From NumGate gateway
5. **Test locally on http://localhost:3002** before pushing