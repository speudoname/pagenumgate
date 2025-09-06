# Tool Catalog

## 📁 File Operations
1. **create_file** - Creates new files with content (needs: path, content)
2. **edit_file** - Modifies existing files (needs: path, content) *Always read first*
3. **delete_file** - Removes files (needs: path)
4. **read_file** - Views file contents (needs: path)
5. **list_files** - Shows directory contents (needs: path optional)
6. **create_folder** - Makes new directories with index.html (needs: path)
7. **move_file** - Renames or relocates files (needs: from, to)

## 🎨 DOM Manipulation
8. **update_section** - Replaces page sections (needs: path, selector, new_content)
9. **get_preview_state** - Analyzes page structure (needs: path)
10. **find_element** - Locates elements by text (needs: path, text)
11. **update_element** - Modifies element properties (needs: path, selector, updates)
12. **add_element** - Inserts new elements (needs: path, selector, element, position)
13. **remove_element** - Deletes elements (needs: path, selector)
14. **inspect_element** - Gets element details (needs: path, selector)

## 📄 Page Building
15. **add_section** - Adds complete sections: hero, features, testimonials, cta, pricing, faq, contact (needs: path, type, content)
16. **apply_theme** - Changes page style: neo-brutalist, glassmorphism, dark, minimal, gradient (needs: path, theme)
17. **update_layout** - Restructures page: single/two/three-columns, sidebar, grid (needs: path, layout)
18. **optimize_seo** - Adds meta tags and structured data (needs: path, title, description, keywords)
19. **add_component** - Adds UI components: navbar, footer, carousel, modal, accordion, tabs (needs: path, type, config)

## 💼 Business Integrations
20. **add_webinar_registration** - Creates event signup forms (needs: path, webinar_details)
21. **add_payment_form** - Adds checkout/payment forms (needs: path, product_details)
22. **add_lms_course_card** - Creates course display cards (needs: path, course_info)
23. **add_testimonial_section** - Adds customer reviews (needs: path, testimonials)
24. **add_opt_in_form** - Creates newsletter signups (needs: path, form_config)
25. **add_product_showcase** - Displays products/services (needs: path, products)

## Usage Notes
- Tools return results you can use in subsequent operations
- Chain tools together for complex tasks
- Use the context path when no path is specified
- Complete all steps needed to fulfill the user's request