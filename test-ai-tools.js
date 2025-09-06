// Test script to debug AI tool execution
const { getTools, executeToolCall } = require('./lib/ai/tools')

// Simulate different contexts
const contexts = [
  { type: 'folder', path: 'levan/', tenantId: 'test-tenant' },
  { type: 'file', path: 'levan/index.html', tenantId: 'test-tenant' },
  { type: null, path: null, tenantId: 'test-tenant' }
]

// Test tool generation for each context
contexts.forEach(ctx => {
  console.log('\n=== CONTEXT ===')
  console.log(`Type: ${ctx.type}, Path: ${ctx.path}`)
  
  const tools = getTools(ctx.type, ctx.path, ctx.tenantId)
  
  // Check first tool (create_file)
  const createFileTool = tools.find(t => t.name === 'create_file')
  console.log('\nCreate File Tool Description:')
  console.log(createFileTool.description)
  console.log('\nPath Property Description:')
  console.log(createFileTool.input_schema.properties.path.description)
})

// Test what happens when AI sends different inputs
const testInputs = [
  { path: 'test.html', content: 'test' },  // No context awareness
  { path: '', content: 'test' },           // Empty path
  {},                                      // Missing all params
  { content: 'test' }                      // Missing path
]

console.log('\n\n=== TESTING TOOL INPUTS ===')
testInputs.forEach(async (input, i) => {
  console.log(`\nTest ${i + 1}: Input = ${JSON.stringify(input)}`)
  
  try {
    // This would fail in real execution
    if (!input.path || !input.content) {
      console.log('  ❌ Would fail: Missing required parameters')
    } else {
      console.log('  ✅ Has required parameters')
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`)
  }
})

console.log('\n\n=== THE PROBLEM ===')
console.log('1. Tool descriptions are static - they don\'t change based on context')
console.log('2. AI must generate the full path every time')
console.log('3. No validation before sending to Claude')
console.log('4. Context is stored globally but not used in tool schemas')
console.log('5. Path resolution happens AFTER AI generates params, not BEFORE')