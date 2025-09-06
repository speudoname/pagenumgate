# AI Page Builder Tools - Implementation Plan

## Vision
Create a business-aware AI page builder that can intelligently edit pages without starting over, with deep integration into the business ecosystem (webinars, LMS, payments, etc.).

## Current State
- ✅ Basic file operations (create, read, edit, delete)
- ✅ Chat interface with Claude Sonnet 4 and Opus 4.1
- ✅ Per-context conversation history
- ✅ Real-time status feedback
- ❌ Partial editing (currently replaces entire file)
- ❌ Preview awareness
- ❌ DOM manipulation
- ❌ Business integrations

## Implementation Phases

### Phase 1: Partial Editing Capability ⚡ CURRENT
**Goal**: Enable AI to edit specific parts of pages without regenerating everything

#### Tools to Implement:
1. **`update_section`**
   - Finds specific section in HTML
   - Updates only that section
   - Preserves rest of file
   - Uses cheerio or jsdom for parsing

2. **`get_preview_state`**
   - Returns current page structure
   - Lists all sections with IDs/classes
   - Shows current content
   - Provides context for edits

3. **`find_element`**
   - Searches for elements by text content
   - Returns selector path
   - Helps bot locate elements to edit

#### Technical Approach:
```typescript
// Example: update_section tool
{
  name: 'update_section',
  description: 'Update a specific section of the page',
  input_schema: {
    file_path: string,
    selector: string,  // CSS selector or section identifier
    new_content: string,  // New HTML for that section
    preserve_attributes: boolean  // Keep existing classes/ids
  }
}
```

### Phase 2: Granular DOM Tools
**Goal**: Enable precise, surgical edits to individual elements

#### Tools to Implement:
1. **`inspect_element`** - Get details about specific element
2. **`update_element`** - Change text/attributes of element
3. **`add_element`** - Insert new element at position
4. **`remove_element`** - Delete element by selector
5. **`update_styles`** - Modify inline styles or classes
6. **`move_element`** - Reposition element in DOM

#### Technical Approach:
- Use jsdom for server-side DOM manipulation
- Maintain element references across operations
- Generate clean, valid HTML output
- Preserve user's custom attributes

### Phase 3: Page Building Tools
**Goal**: High-level tools for common page building tasks

#### Tools to Implement:
1. **`add_section`** - Add hero, features, testimonials sections
2. **`add_component`** - Insert pre-built components
3. **`update_layout`** - Change page structure (columns, grids)
4. **`apply_theme`** - Apply consistent styling
5. **`optimize_seo`** - Update meta tags, structure

#### Component Library:
- Store in shared blob storage (`_global/components/`)
- Shadcn-based components
- Tailwind styling
- Responsive by default

### Phase 4: Business-Aware Tools
**Goal**: Deep integration with business systems

#### Tools to Implement:
1. **`add_webinar_registration`**
   - Connects to webinar system
   - Creates registration form
   - Handles API integration

2. **`add_payment_form`**
   - Integrates with payment API
   - Product selection
   - Checkout flow

3. **`add_lms_course_card`**
   - Pulls course data
   - Creates course cards
   - Links to LMS

4. **`add_testimonial_section`**
   - Fetches real testimonials
   - Dynamic content

5. **`add_opt_in_form`**
   - Email capture
   - Lead management
   - CRM integration

#### Data Sources:
- Supabase tables for business data
- External APIs (Stripe, webinar platforms)
- Tenant-specific configurations

## File Structure

```
/lib/ai/
├── tools/
│   ├── index.ts           # Main tools export
│   ├── file-tools.ts      # Current file operations
│   ├── dom-tools.ts       # NEW: DOM manipulation
│   ├── page-tools.ts      # NEW: Page building
│   └── business-tools.ts  # NEW: Business integrations
├── parsers/
│   ├── html-parser.ts     # NEW: HTML/DOM parsing
│   └── section-finder.ts  # NEW: Section detection
└── utils/
    ├── preview-client.ts  # NEW: Preview state management
    └── tool-executor.ts   # Tool execution logic
```

## Database Schema Additions

```sql
-- Component usage tracking
CREATE TABLE ai_components_used (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  page_id UUID,
  component_type VARCHAR(100),
  component_props JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business integrations config
CREATE TABLE ai_business_integrations (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  integration_type VARCHAR(50), -- 'webinar', 'payment', 'lms'
  config JSONB,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Success Metrics

### Phase 1 Success Criteria:
- [ ] Can edit a heading without touching rest of page
- [ ] Can update a section while preserving formatting
- [ ] Bot knows current page structure
- [ ] Edit operations complete in <2 seconds

### Phase 2 Success Criteria:
- [ ] Can make 10+ targeted edits without breaking page
- [ ] Maintains valid HTML after all operations
- [ ] Preserves user customizations
- [ ] Clear audit trail of changes

### Phase 3 Success Criteria:
- [ ] Can build complete landing page with components
- [ ] Components are responsive and accessible
- [ ] Consistent styling across sections
- [ ] SEO-optimized output

### Phase 4 Success Criteria:
- [ ] Forms actually submit to real systems
- [ ] Dynamic data updates automatically
- [ ] Business context aware suggestions
- [ ] Multi-tenant data isolation

## Current Focus: Phase 1 Implementation

### Next Steps:
1. Install jsdom or cheerio for HTML parsing
2. Create `update_section` tool
3. Create `get_preview_state` tool
4. Update tool registry in `/lib/ai/tools.ts`
5. Test with sample HTML files
6. Update AIChat component to show section-aware status

## Notes

### Why Partial Editing Matters:
- Users spend time customizing pages
- Full regeneration loses manual tweaks
- Faster, more precise operations
- Better user experience
- Enables incremental improvements

### Technical Decisions:
- **Parser choice**: jsdom (full DOM API) vs cheerio (jQuery-like, faster)
- **Section detection**: ID-based vs semantic HTML5 sections
- **Change tracking**: Store diffs vs full snapshots
- **Preview sync**: Real-time vs on-demand

### Integration Points:
- Preview iframe postMessage communication
- File watcher for external changes
- Undo/redo system integration
- Version control awareness

## Progress Log

### 2025-01-06
- Created this plan document
- Starting Phase 1 implementation
- Installing required dependencies