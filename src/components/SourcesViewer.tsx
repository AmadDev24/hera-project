import React from 'react';
import { ExternalLink, Globe, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { GroundingChunk } from '../types';

interface SourcesViewerProps {
  chunks?: GroundingChunk[];
}

function getDomainName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return 'Web Source';
  }
}

export default function SourcesViewer({ chunks }: SourcesViewerProps) {
  if (!chunks || chunks.length === 0) return null;

  // Filter out any chunks that don't have web links
  const webChunks = chunks.filter((chunk) => chunk.web && chunk.web.uri);

  if (webChunks.length === 0) return null;

  return (
    <div className="w-full mt-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-blue-50 dark:bg-blue-950/40 p-1.5 rounded-lg text-google-blue dark:text-blue-400">
          <BookOpen size={15} />
        </div>
        <h5 className="text-xs font-display font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Sources Referenced
        </h5>
        <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold">
          {webChunks.length} {webChunks.length === 1 ? 'Site' : 'Sites'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {webChunks.map((chunk, index) => {
          const webInfo = chunk.web!;
          const domain = getDomainName(webInfo.uri);
          const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;

          return (
            <motion.a
              key={index}
              href={webInfo.uri}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl transition-all shadow-xs hover:shadow-md group relative overflow-hidden"
              title={webInfo.title}
              id={`source-card-${index}`}
            >
              {/* Dynamic Favicon / Fallback Globe */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 flex items-center justify-center overflow-hidden">
                <img
                  src={faviconUrl}
                  alt={domain}
                  onError={(e) => {
                    // Fallback to Globe Icon if Google s2 favicon fails
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      const svg = parent.querySelector('.globe-stub');
                      if (svg) svg.classList.remove('hidden');
                    }
                  }}
                  className="w-4 h-4 object-contain"
                />
                <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500 hidden globe-stub" />
              </div>

              {/* Title & Domain Context */}
              <div className="flex-1 min-w-0 pr-4">
                <h6 className="text-[13px] font-semibold text-slate-800 dark:text-slate-150 line-clamp-1 group-hover:text-google-blue dark:group-hover:text-google-purple transition-colors">
                  {webInfo.title || 'Untitled search result'}
                </h6>
                <span className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500 block leading-tight mt-0.5">
                  {domain}
                </span>
              </div>

              {/* Numeric Indicator */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">
                  {index + 1}
                </span>
                <ExternalLink size={12} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
              </div>
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
