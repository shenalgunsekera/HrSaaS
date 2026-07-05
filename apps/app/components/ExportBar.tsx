/** CSV + branded-PDF export links for a registered entity. */
export function ExportBar({ entity }: { entity: string }) {
  return (
    <span className="inline-flex gap-2 print:hidden">
      <a
        href={`/api/export/${entity}`}
        className="px-3 py-1.5 border border-line text-mute-1 text-xs font-medium rounded-md hover:border-brand hover:text-brand transition-colors"
      >
        CSV ↓
      </a>
      <a
        href={`/reports/${entity}`}
        target="_blank"
        className="px-3 py-1.5 border border-line text-mute-1 text-xs font-medium rounded-md hover:border-brand hover:text-brand transition-colors"
      >
        PDF report ↗
      </a>
    </span>
  );
}
