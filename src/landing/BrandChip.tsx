import { useT } from "../i18n/react.tsx";

/** Owner logo on its black rounded "sticker" chip (the artwork is made for black, so the chip stays black). */
export function BrandChip({ href = "/", size = "md" }: { href?: string; size?: "md" | "sm" }) {
  const { t } = useT();
  return (
    <a className={`ln-chip ln-chip--${size}`} href={href} aria-label={t("common.brand.backToTop")}>
      <img src="/brand/snacc-logo.webp" alt="Snacc" width={1200} height={403} decoding="async" />
    </a>
  );
}
