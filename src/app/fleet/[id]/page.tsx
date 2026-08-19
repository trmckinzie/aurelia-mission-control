import { ProjectDetail } from "@/components/dashboard/ProjectDetail";

export default async function ProjectPage({ params }: PageProps<"/fleet/[id]">) {
  const { id } = await params;
  return (
    <main className="flex-1 overflow-y-auto px-6 py-5">
      <ProjectDetail projectId={id} />
    </main>
  );
}
