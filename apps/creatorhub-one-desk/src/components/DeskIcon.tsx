import iconUrl from "../assets/desk-icon.svg";

interface Props {
  size?: number;
  /** Skygge under ikonet, default true. Sett false for å bruke i inline-rader. */
  shadow?: boolean;
}

export default function DeskIcon({ size = 80, shadow = true }: Props) {
  return (
    <img
      src={iconUrl}
      alt="Creatorhub One Desk"
      width={size}
      height={size}
      style={{
        display: "block",
        borderRadius: size * 0.22,
        ...(shadow
          ? { boxShadow: "0 14px 30px -12px rgba(0,0,0,0.35), 0 6px 14px -6px rgba(255,138,61,0.35)" }
          : {}),
      }}
    />
  );
}
