import { Link } from "@tanstack/react-router";

export function Logo({ large = false }: { large?: boolean }) {
  return (
    <Link to="/" aria-label="Lockedin home" className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <img src="/lockedin-logo.webp" alt="" className={large ? "brand-logo brand-logo-large" : "brand-logo"} />
    </Link>
  );
}
