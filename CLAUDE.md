# PageNumGate - Part of NUM Gate Platform

## CRITICAL: Project Context
**This is NOT a standalone project.** PageNumGate is an integral part of the NUM Gate multi-tenant SaaS platform located at `/Users/apple/numgate`.

### Architecture Rules
- **Always maintain compatibility** with the main NUM Gate gateway
- **Never modify** JWT authentication flow - it must match the gateway
- **Tenant isolation is mandatory** - each tenant only sees their own data
- **Use shared Supabase instance** - same database as NUM Gate
- **Proxy routing** - Served at `/page-builder` path via nginx/Vercel

### Shared Resources
- **Supabase**: Same instance as NUM Gate (hbopxprpgvrkucztsvnq)
- **JWT Secret**: Must match NUM Gate for cross-app auth
- **Vercel Blob**: Shared storage, tenant-isolated by folder structure
- **User Sessions**: Passed from NUM Gate via JWT tokens

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