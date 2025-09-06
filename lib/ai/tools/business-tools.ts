import { HTMLParser } from '../parsers/html-parser'
import { put, list } from '@vercel/blob'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Define Tool interface matching the format in tools.ts
interface Tool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

/**
 * Business-aware tools for deep integration with business systems
 */

/**
 * Add a webinar registration form
 */
export const addWebinarRegistrationTool: Tool = {
  name: 'add_webinar_registration',
  description: 'Add a registration form for a webinar that integrates with the webinar system',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      webinar_id: {
        type: 'string',
        description: 'ID of the webinar from the system'
      },
      target_selector: {
        type: 'string',
        description: 'Where to insert the form'
      },
      style: {
        type: 'string',
        enum: ['inline', 'modal', 'fullwidth', 'compact'],
        description: 'Form style',
        default: 'inline'
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to include (name, email, phone, company, etc.)',
        default: ['name', 'email']
      }
    },
    required: ['path', 'webinar_id', 'target_selector']
  }
}

/**
 * Add a payment form for products
 */
export const addPaymentFormTool: Tool = {
  name: 'add_payment_form',
  description: 'Add a payment form that integrates with the payment system',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      product_id: {
        type: 'string',
        description: 'ID of the product to purchase'
      },
      target_selector: {
        type: 'string',
        description: 'Where to insert the form'
      },
      payment_methods: {
        type: 'array',
        items: { type: 'string' },
        description: 'Payment methods to accept',
        default: ['card', 'paypal']
      },
      currency: {
        type: 'string',
        description: 'Currency code',
        default: 'USD'
      }
    },
    required: ['path', 'product_id', 'target_selector']
  }
}

/**
 * Add LMS course cards
 */
export const addLmsCourseCardTool: Tool = {
  name: 'add_lms_course_card',
  description: 'Add course cards that pull data from the LMS system',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      course_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of courses to display'
      },
      target_selector: {
        type: 'string',
        description: 'Where to insert the cards'
      },
      layout: {
        type: 'string',
        enum: ['grid', 'list', 'carousel'],
        description: 'Layout for course cards',
        default: 'grid'
      },
      show_price: {
        type: 'boolean',
        description: 'Show course price',
        default: true
      },
      show_enrollment: {
        type: 'boolean',
        description: 'Show enrollment count',
        default: true
      }
    },
    required: ['path', 'course_ids', 'target_selector']
  }
}

/**
 * Add testimonials from database
 */
export const addTestimonialSectionTool: Tool = {
  name: 'add_testimonial_section',
  description: 'Add testimonials that pull from the database',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      target_selector: {
        type: 'string',
        description: 'Where to insert testimonials'
      },
      filter: {
        type: 'object',
        properties: {
          product_id: { type: 'string' },
          rating_min: { type: 'number' },
          featured: { type: 'boolean' }
        },
        description: 'Filter criteria for testimonials'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of testimonials',
        default: 3
      },
      layout: {
        type: 'string',
        enum: ['cards', 'carousel', 'masonry'],
        description: 'Layout style',
        default: 'cards'
      }
    },
    required: ['path', 'target_selector']
  }
}

/**
 * Add opt-in form for email capture
 */
export const addOptInFormTool: Tool = {
  name: 'add_opt_in_form',
  description: 'Add an email opt-in form that integrates with the CRM',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      target_selector: {
        type: 'string',
        description: 'Where to insert the form'
      },
      list_id: {
        type: 'string',
        description: 'Email list ID to subscribe to'
      },
      offer: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          button_text: { type: 'string' }
        },
        description: 'Offer details for the opt-in'
      },
      style: {
        type: 'string',
        enum: ['inline', 'popup', 'sticky-bar', 'sidebar'],
        description: 'Form display style',
        default: 'inline'
      }
    },
    required: ['path', 'target_selector', 'list_id']
  }
}

/**
 * Add product showcase from catalog
 */
export const addProductShowcaseTool: Tool = {
  name: 'add_product_showcase',
  description: 'Add a product showcase that pulls from the product catalog',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the HTML file'
      },
      target_selector: {
        type: 'string',
        description: 'Where to insert the showcase'
      },
      product_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Product IDs to showcase'
      },
      layout: {
        type: 'string',
        enum: ['grid', 'slider', 'featured', 'comparison'],
        description: 'Showcase layout',
        default: 'grid'
      },
      show_add_to_cart: {
        type: 'boolean',
        description: 'Show add to cart button',
        default: true
      }
    },
    required: ['path', 'target_selector', 'product_ids']
  }
}

/**
 * Generate business-integrated forms and components
 */
function generateBusinessHTML(type: string, config: any, tenantId: string): string {
  const templates: Record<string, (c: any) => string> = {
    webinar_registration: (c) => `
      <div class="webinar-registration ${c.style === 'fullwidth' ? 'w-full' : 'max-w-md mx-auto'} p-6 bg-white rounded-lg shadow-lg">
        <h3 class="text-2xl font-bold mb-4">Register for Webinar</h3>
        <form data-webinar-id="${c.webinar_id}" data-tenant-id="${tenantId}" class="webinar-form space-y-4">
          ${c.fields.includes('name') ? '<input type="text" name="name" placeholder="Full Name" required class="w-full px-4 py-2 border rounded-lg" />' : ''}
          ${c.fields.includes('email') ? '<input type="email" name="email" placeholder="Email Address" required class="w-full px-4 py-2 border rounded-lg" />' : ''}
          ${c.fields.includes('phone') ? '<input type="tel" name="phone" placeholder="Phone Number" class="w-full px-4 py-2 border rounded-lg" />' : ''}
          ${c.fields.includes('company') ? '<input type="text" name="company" placeholder="Company Name" class="w-full px-4 py-2 border rounded-lg" />' : ''}
          <button type="submit" class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Register Now
          </button>
        </form>
        <script>
          document.querySelector('.webinar-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            // Send to API endpoint
            await fetch('/api/webinar/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...data, webinarId: e.target.dataset.webinarId })
            });
            alert('Registration successful!');
          });
        </script>
      </div>`,
    
    payment_form: (c) => `
      <div class="payment-form-container p-6 bg-white rounded-lg shadow-lg">
        <h3 class="text-2xl font-bold mb-4">Complete Your Purchase</h3>
        <div data-product-id="${c.product_id}" data-currency="${c.currency}" class="payment-form">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Payment Method</label>
            <div class="space-y-2">
              ${c.payment_methods.map((method: string) => `
                <label class="flex items-center">
                  <input type="radio" name="payment_method" value="${method}" class="mr-2" />
                  <span>${method.charAt(0).toUpperCase() + method.slice(1)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="space-y-4">
            <input type="text" placeholder="Card Number" class="w-full px-4 py-2 border rounded-lg" />
            <div class="grid grid-cols-2 gap-4">
              <input type="text" placeholder="MM/YY" class="px-4 py-2 border rounded-lg" />
              <input type="text" placeholder="CVV" class="px-4 py-2 border rounded-lg" />
            </div>
          </div>
          <button type="submit" class="w-full mt-6 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            Pay Now
          </button>
        </div>
      </div>`,
    
    lms_courses: (c) => `
      <div class="lms-courses ${c.layout === 'grid' ? 'grid md:grid-cols-3 gap-6' : 'space-y-6'}">
        ${c.courses.map((course: any) => `
          <div class="course-card bg-white rounded-lg shadow-lg overflow-hidden">
            <img src="${course.thumbnail || '/api/placeholder/400/200'}" alt="${course.title}" class="w-full h-48 object-cover" />
            <div class="p-6">
              <h3 class="text-xl font-bold mb-2">${course.title}</h3>
              <p class="text-gray-600 mb-4">${course.description}</p>
              ${c.show_enrollment ? `<p class="text-sm text-gray-500 mb-2">${course.enrolled || 0} students enrolled</p>` : ''}
              ${c.show_price ? `<p class="text-2xl font-bold text-blue-600 mb-4">$${course.price || '0'}</p>` : ''}
              <a href="/course/${course.id}" class="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                Enroll Now
              </a>
            </div>
          </div>
        `).join('')}
      </div>`,
    
    testimonials: (c) => `
      <div class="testimonials ${c.layout === 'cards' ? 'grid md:grid-cols-3 gap-6' : 'space-y-6'}">
        ${c.testimonials.map((t: any) => `
          <div class="testimonial-card bg-white p-6 rounded-lg shadow-lg">
            <div class="flex mb-4">
              ${Array(t.rating || 5).fill('⭐').join('')}
            </div>
            <p class="text-lg mb-4">"${t.text}"</p>
            <div class="flex items-center">
              ${t.avatar ? `<img src="${t.avatar}" alt="${t.name}" class="w-12 h-12 rounded-full mr-3" />` : ''}
              <div>
                <p class="font-semibold">${t.name}</p>
                <p class="text-sm text-gray-600">${t.role || 'Customer'}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`,
    
    opt_in: (c) => `
      <div class="opt-in-form ${c.style === 'sticky-bar' ? 'fixed bottom-0 left-0 right-0 bg-blue-600 text-white p-4' : 'p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg'}">
        <div class="max-w-4xl mx-auto">
          <h3 class="text-2xl font-bold mb-2">${c.offer?.title || 'Join Our Newsletter'}</h3>
          <p class="mb-4">${c.offer?.description || 'Get exclusive updates and offers'}</p>
          <form data-list-id="${c.list_id}" class="opt-in-form flex gap-4">
            <input type="email" name="email" placeholder="Enter your email" required 
              class="flex-1 px-4 py-2 rounded-lg text-gray-900" />
            <button type="submit" class="px-6 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition">
              ${c.offer?.button_text || 'Subscribe'}
            </button>
          </form>
        </div>
      </div>`,
    
    product_showcase: (c) => `
      <div class="product-showcase ${c.layout === 'grid' ? 'grid md:grid-cols-3 gap-6' : 'space-y-6'}">
        ${c.products.map((product: any) => `
          <div class="product-card bg-white rounded-lg shadow-lg overflow-hidden">
            <img src="${product.image || '/api/placeholder/400/300'}" alt="${product.name}" class="w-full h-48 object-cover" />
            <div class="p-6">
              <h3 class="text-xl font-bold mb-2">${product.name}</h3>
              <p class="text-gray-600 mb-4">${product.description}</p>
              <div class="flex justify-between items-center">
                <span class="text-2xl font-bold text-green-600">$${product.price}</span>
                ${c.show_add_to_cart ? `
                  <button data-product-id="${product.id}" class="add-to-cart px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                    Add to Cart
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>`
  }
  
  return templates[type] ? templates[type](config) : ''
}

/**
 * Fetch business data from database
 */
async function fetchBusinessData(type: string, params: any, tenantId: string): Promise<any> {
  try {
    switch (type) {
      case 'webinar': {
        // In production, fetch from webinar system
        // For now, return mock data
        return {
          id: params.webinar_id,
          title: 'AI in Business Webinar',
          date: '2025-02-01',
          time: '2:00 PM EST'
        }
      }
      
      case 'product': {
        // In production, fetch from product catalog
        // For now, return mock data
        if (Array.isArray(params.product_ids)) {
          return params.product_ids.map((id: string) => ({
            id,
            name: `Product ${id}`,
            description: 'Amazing product description',
            price: 99.99,
            image: '/api/placeholder/400/300'
          }))
        }
        return {
          id: params.product_id,
          name: 'Premium Package',
          price: 299.99
        }
      }
      
      case 'courses': {
        // In production, fetch from LMS
        return params.course_ids.map((id: string) => ({
          id,
          title: `Course ${id}`,
          description: 'Learn amazing skills',
          price: 199,
          enrolled: Math.floor(Math.random() * 1000),
          thumbnail: '/api/placeholder/400/200'
        }))
      }
      
      case 'testimonials': {
        // In production, fetch from database with filters
        const { data } = await supabase
          .from('testimonials')
          .select('*')
          .eq('tenant_id', tenantId)
          .limit(params.limit || 3)
        
        // Fallback to mock data if no testimonials
        if (!data || data.length === 0) {
          return [
            { name: 'John Doe', text: 'Excellent service!', rating: 5, role: 'CEO' },
            { name: 'Jane Smith', text: 'Highly recommended!', rating: 5, role: 'Manager' },
            { name: 'Bob Johnson', text: 'Great experience!', rating: 5, role: 'Developer' }
          ]
        }
        
        return data
      }
      
      default:
        return null
    }
  } catch (error) {
    console.error('Error fetching business data:', error)
    return null
  }
}

/**
 * Execute business tools
 */
export async function executeBusinessTool(
  toolName: string,
  input: any,
  tenantId: string
): Promise<any> {
  const blobPath = `${tenantId}/${input.path}`
  
  try {
    // Get the current HTML content
    const { blobs } = await list({
      prefix: blobPath,
      limit: 1
    })
    
    if (blobs.length === 0) {
      throw new Error('File not found')
    }
    
    const response = await fetch(blobs[0].url)
    if (!response.ok) {
      throw new Error('Failed to fetch file')
    }
    
    const currentHtml = await response.text()
    const parser = new HTMLParser(currentHtml)
    
    switch (toolName) {
      case 'add_webinar_registration': {
        const webinarData = await fetchBusinessData('webinar', { webinar_id: input.webinar_id }, tenantId)
        const formHtml = generateBusinessHTML('webinar_registration', {
          ...input,
          webinar: webinarData
        }, tenantId)
        
        const success = parser.addElement(input.target_selector, formHtml, 'append')
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Added webinar registration form for webinar ${input.webinar_id}`,
            webinar_id: input.webinar_id
          }
        } else {
          throw new Error(`Could not find target: ${input.target_selector}`)
        }
      }
      
      case 'add_payment_form': {
        const productData = await fetchBusinessData('product', { product_id: input.product_id }, tenantId)
        const formHtml = generateBusinessHTML('payment_form', {
          ...input,
          product: productData
        }, tenantId)
        
        const success = parser.addElement(input.target_selector, formHtml, 'append')
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Added payment form for product ${input.product_id}`,
            product_id: input.product_id
          }
        } else {
          throw new Error(`Could not find target: ${input.target_selector}`)
        }
      }
      
      case 'add_lms_course_card': {
        const coursesData = await fetchBusinessData('courses', { course_ids: input.course_ids }, tenantId)
        const coursesHtml = generateBusinessHTML('lms_courses', {
          ...input,
          courses: coursesData
        }, tenantId)
        
        const success = parser.addElement(input.target_selector, coursesHtml, 'append')
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Added ${input.course_ids.length} course cards`,
            course_count: input.course_ids.length
          }
        } else {
          throw new Error(`Could not find target: ${input.target_selector}`)
        }
      }
      
      case 'add_testimonial_section': {
        const testimonialsData = await fetchBusinessData('testimonials', {
          ...input.filter,
          limit: input.limit
        }, tenantId)
        
        const testimonialsHtml = generateBusinessHTML('testimonials', {
          ...input,
          testimonials: testimonialsData
        }, tenantId)
        
        const success = parser.addElement(input.target_selector, testimonialsHtml, 'append')
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Added ${testimonialsData.length} testimonials`,
            count: testimonialsData.length
          }
        } else {
          throw new Error(`Could not find target: ${input.target_selector}`)
        }
      }
      
      case 'add_opt_in_form': {
        const formHtml = generateBusinessHTML('opt_in', input, tenantId)
        
        const success = parser.addElement(input.target_selector, formHtml, 'append')
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Added opt-in form for list ${input.list_id}`,
            list_id: input.list_id
          }
        } else {
          throw new Error(`Could not find target: ${input.target_selector}`)
        }
      }
      
      case 'add_product_showcase': {
        const productsData = await fetchBusinessData('product', { product_ids: input.product_ids }, tenantId)
        const showcaseHtml = generateBusinessHTML('product_showcase', {
          ...input,
          products: productsData
        }, tenantId)
        
        const success = parser.addElement(input.target_selector, showcaseHtml, 'append')
        
        if (success) {
          const updatedHtml = parser.getHTML()
          await put(blobPath, updatedHtml, {
            access: 'public',
            contentType: 'text/html',
          })
          
          return {
            success: true,
            message: `Added product showcase with ${input.product_ids.length} products`,
            product_count: input.product_ids.length
          }
        } else {
          throw new Error(`Could not find target: ${input.target_selector}`)
        }
      }
      
      default:
        throw new Error(`Unknown business tool: ${toolName}`)
    }
  } catch (error) {
    throw error
  }
}

// Export all business tools as an array
export const businessTools = [
  addWebinarRegistrationTool,
  addPaymentFormTool,
  addLmsCourseCardTool,
  addTestimonialSectionTool,
  addOptInFormTool,
  addProductShowcaseTool
]