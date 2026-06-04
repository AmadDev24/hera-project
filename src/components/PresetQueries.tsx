import React from 'react';
import { Calculator, Calendar, FileText, UserCheck, Sparkles, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface PresetQuery {
  title: string;
  query: string;
  category: string;
  description: string;
  icon: React.ComponentType<any>;
}

const PRESETS: PresetQuery[] = [
  {
    category: 'Tax Rates & Brackets',
    title: 'Individual Resident Tax Rates',
    query: 'What are the official resident individual income tax rates and brackets in Malaysia for Year of Assessment (YA) 2025?',
    description: 'Check tax percentages, chargeable income thresholds, and rebates.',
    icon: Calculator,
  },
  {
    category: 'Tax Reliefs',
    title: 'Max Personal Tax Relief Limits',
    query: 'What are the individual personal tax reliefs and maximum claim limits allowed under LHDN for YA 2025? Please cover lifestyle, medical, and parents.',
    description: 'Review claims for medical fees, children education, and life insurance.',
    icon: FileText,
  },
  {
    category: 'Deadlines & Forms',
    title: 'e-Filing Due Dates & Grace Period',
    query: 'What are the official filing due dates and deadlines for submitting LHDN Form BE (salaried) and Form B (business) in 2026?',
    description: 'Avoid late submission fines and find e-filing grace extensions.',
    icon: Calendar,
  },
  {
    category: 'Corporate Tax',
    title: 'SME Preferential Tax Rates',
    query: 'What are the current corporate income tax rates for Small and Medium Enterprises (SMEs) in Malaysia for YA 2025/2026?',
    description: 'Review paid-up capital requirements and tax rate tiers.',
    icon: UserCheck,
  },
];

interface PresetQueriesProps {
  onSelectQuery: (query: string) => void;
}

export default function PresetQueries({ onSelectQuery }: PresetQueriesProps) {
  return (
    <div className="w-full max-w-4xl mx-auto my-8 px-4">
      <div className="text-center mb-8">
        <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-850 dark:text-white flex items-center justify-center gap-2">
          <TrendingUp className="text-google-blue dark:text-google-purple animate-pulse" />
          Ask a Tax Consultation Scenario
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-450 mt-2 max-w-lg mx-auto">
          Choose a scenario to see live search grounding in action. All queries explicitly scope content directly from the **hasil.gov.my** registry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRESETS.map((preset, index) => {
          const Icon = preset.icon;
          return (
            <motion.button
              key={index}
              whileHover={{ scale: 1.015, y: -2 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onSelectQuery(preset.query)}
              className="flex flex-col text-left p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs hover:shadow-md transition-all group relative overflow-hidden cursor-pointer"
              id={`preset-card-${index}`}
            >
              {/* Corner Accent Glow */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-radial from-blue-100/35 to-transparent dark:from-blue-950/20 rounded-full group-hover:scale-125 transition-transform" />

              <div className="flex items-center gap-3 mb-2.5">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 group-hover:text-google-blue dark:group-hover:text-blue-400 transition-colors">
                  <Icon size={18} />
                </div>
                <div>
                  <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-400 dark:text-slate-505 block">
                    {preset.category}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-150 mt-0.5">
                    {preset.title}
                  </h4>
                </div>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                "{preset.query}"
              </p>
              
              <div className="mt-auto pt-3 border-t border-slate-100/50 dark:border-slate-800/50 flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-550 group-hover:text-google-blue dark:group-hover:text-google-purple transition-colors font-medium">
                <span>{preset.description}</span>
                <span className="font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Consult &rarr;</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
