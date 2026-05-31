/**
 * PhotoshopStatusPill — live-pille i HeaderBar som viser om Photoshop-
 * UXP-pluginen er tilkoblet, og hvilket dokument som er aktivt akkurat
 * nå. Oppdateres i sanntid fra `photoshop://event`-strømmen
 * (action notifiers `open`/`close`/`select`/`make` fra pluginen).
 *
 * Klikk åpner Photoshop Bridge-dialogen (samme som tannhjul-menyen).
 */

import { usePhotoshopStatus } from "../hooks/usePhotoshopStatus";

interface Props {
  onClick?: () => void;
}

export function PhotoshopStatusPill({ onClick }: Props) {
  const { status, activeDoc } = usePhotoshopStatus();
  const connected = !!status?.connected;

  const dotColor = connected ? "#4ad48a" : "#8674a8";
  const bg = connected ? "rgba(74,212,138,0.12)" : "rgba(184,168,216,0.08)";
  const border = connected ? "rgba(74,212,138,0.45)" : "rgba(184,168,216,0.25)";
  const text = connected ? "#4ad48a" : "#b8a8d8";

  let label = "Photoshop · frakoblet";
  let tooltip = "UXP-plugin er ikke tilkoblet — sideload via UDT.";
  if (connected && activeDoc) {
    label = `Photoshop · ${shorten(activeDoc.name, 28)}`;
    tooltip = `${activeDoc.name}\n${activeDoc.width}×${activeDoc.height}${
      activeDoc.path ? `\n${activeDoc.path}` : ""
    }`;
  } else if (connected) {
    label = "Photoshop · ingen doc";
    tooltip = "Photoshop er tilkoblet, men har ingen åpne dokumenter.";
  } else if (status?.photoshop_version) {
    label = `Photoshop · v${status.photoshop_version}`;
    tooltip = `Plugin v${status.plugin_version} sist sett`;
  }

  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color: text,
        borderRadius: 999,
        padding: "3px 10px 3px 8px",
        cursor: onClick ? "pointer" : "default",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        marginLeft: 8,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dotColor,
        }}
      />
      {label}
    </button>
  );
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
