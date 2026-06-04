import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';
import { GroundingChunk } from '../types';

interface SourcesViewerProps {
  chunks?: GroundingChunk[];
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Web Source';
  }
}

export default function SourcesViewer({ chunks }: SourcesViewerProps) {
  if (!chunks || chunks.length === 0) return null;

  const webChunks = chunks.filter((c) => c.web?.uri);
  if (webChunks.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground">
        {webChunks.length} source{webChunks.length !== 1 ? 's' : ''} cited
      </p>
      <div className="space-y-1.5">
        {webChunks.map((chunk, idx) => {
          const { uri, title } = chunk.web!;
          const domain = getDomain(uri);
          const favicon = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;

          return (
            <a
              key={idx}
              href={uri}
              target="_blank"
              rel="noopener noreferrer"
              title={title}
              className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-background/60 hover:bg-muted/40 px-2.5 py-2 transition-colors group"
            >
              <div className="h-5 w-5 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={favicon}
                  alt={domain}
                  className="h-3 w-3 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                <Globe size={10} className="text-muted-foreground hidden" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {title || domain}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">{domain}</p>
              </div>
              <ExternalLink size={11} className="text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors" />
            </a>
          );
        })}
      </div>
    </div>
  );
}