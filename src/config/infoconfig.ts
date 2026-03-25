import type { InfobarContent } from '@/components/ui/infobar';

export const productInfoContent: InfobarContent = {
  title: 'Product Management',
  sections: [
    {
      title: 'Overview',
      description:
        'The Products page allows you to manage your product catalog. You can view all products in a table format with server-side functionality including sorting, filtering, pagination, and search capabilities. Use the "Add New" button to create new products.',
      links: [
        {
          title: 'Product Management Guide',
          url: '#'
        }
      ]
    },
    {
      title: 'Adding Products',
      description:
        'To add a new product, click the "Add New" button in the page header. You will be taken to a form where you can enter product details including name, description, price, category, and upload product images.',
      links: [
        {
          title: 'Adding Products Documentation',
          url: '#'
        }
      ]
    },
    {
      title: 'Table Features',
      description:
        'The product table includes several powerful features to help you manage large product catalogs efficiently. You can sort columns by clicking on column headers, filter products using the filter controls, navigate through pages using pagination, and quickly find products using the search functionality.',
      links: [
        {
          title: 'Table Features Documentation',
          url: '#'
        }
      ]
    }
  ]
};
