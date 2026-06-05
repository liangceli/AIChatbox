import { AdminAccessForm } from "../../components/admin-access-form";
import { sanitizeAdminNextPath } from "../../lib/admin-next-path.cjs";

export default function AdminAccessPage({
  searchParams
}: {
  searchParams?: {
    next?: string;
  };
}) {
  const nextPath = sanitizeAdminNextPath(searchParams?.next);

  return <AdminAccessForm nextPath={nextPath} />;
}
