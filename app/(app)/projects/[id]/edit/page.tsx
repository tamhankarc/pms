import { redirect } from "next/navigation";

export default async function RemovedProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/projects/${id}`);
}
