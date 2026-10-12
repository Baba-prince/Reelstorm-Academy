import { notFound } from "next/navigation";
import { OsMarketingShell } from "@/components/marketing/OsMarketingShell";
import { getOsLayer, getOsSlugs } from "@/lib/marketing/os-layers";

export function generateStaticParams() {
  return getOsSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const layer = getOsLayer(params.slug);
  if (!layer) return { title: "OS Layer · REELSTORM" };
  return {
    title: `${layer.title} · REELSTORM OS`,
    description: layer.body,
  };
}

export default function OsLayerMarketingPage({ params }: { params: { slug: string } }) {
  const layer = getOsLayer(params.slug);
  if (!layer) notFound();
  return <OsMarketingShell layer={layer} />;
}
