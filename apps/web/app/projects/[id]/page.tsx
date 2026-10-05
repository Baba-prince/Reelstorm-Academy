import { ProjectDetail } from "./ProjectDetail";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export function generateStaticParams() {
  return [] as { id: string }[];
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  return <ProjectDetail id={params.id} />;
}
