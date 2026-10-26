import { redirect } from 'next/navigation';

/** Old /admin links: users moved to /users, country details to each country's page */
export default async function AdminRedirect({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest } = await params;
  redirect(rest?.[0] === 'countries' ? '/countries' : '/users');
}
