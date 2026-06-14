import ClientApp from "@/components/ClientApp";
import type { Screen } from "@/lib/store";

export default function ScreenPage({ screen }: { screen: Screen }) {
  return <ClientApp initialScreen={screen} />;
}
