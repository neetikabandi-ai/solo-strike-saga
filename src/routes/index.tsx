import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "../components/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Zone Royale — Solo Battle Royale vs Bots" },
      { name: "description", content: "BGMI-style third-person battle royale: drop in, fight 15 bots, survive the shrinking zone." },
      { property: "og:title", content: "Zone Royale — Solo Battle Royale" },
      { property: "og:description", content: "Fight 15 bots in a shrinking zone. Last one standing wins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
