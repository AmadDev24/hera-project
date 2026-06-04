import React from 'react';
import { Search } from 'lucide-react';
import { motion } from 'motion/react';

interface SearchLogsProps {
  query: string;
  isSearching: boolean;
}

export default function SearchLogs({ query, isSearching }: SearchLogsProps) {
  if (!isSearching) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2.5 px-4 py-2"
    >
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        >
          <Search size={13} className="text-blue-500" />
        </motion.div>
      </div>
      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
        Searching hasil.gov.my<span className="animate-pulse">...</span>
      </span>
    </motion.div>
  );
}
