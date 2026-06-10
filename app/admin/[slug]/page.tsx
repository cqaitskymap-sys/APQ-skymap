import { redirect } from 'next/navigation';

const ADMIN_ROUTES: Record<string, string> = {
  users: '/dashboard/admin/users',
  roles: '/dashboard/admin/roles',
  departments: '/dashboard/admin/departments',
  designations: '/dashboard/admin/designations',
  'company-site': '/dashboard/admin/company-sites',
  products: '/dashboard/admin/products',
  parameters: '/dashboard/admin/parameters',
  workflows: '/dashboard/admin/workflows',
  'approval-matrix': '/dashboard/admin/approval-matrix',
  'document-numbering': '/dashboard/admin/document-numbering',
  'audit-trail': '/dashboard/admin/audit-trail',
  'esign-settings': '/dashboard/admin/esign-settings',
  notifications: '/dashboard/admin/notifications',
  backup: '/dashboard/admin/backup',
  'system-settings': '/dashboard/admin/system-settings',
};

export default function AdminSlugRedirect({ params }: { params: { slug: string } }) {
  const target = ADMIN_ROUTES[params.slug];
  redirect(target || '/dashboard/admin');
}
