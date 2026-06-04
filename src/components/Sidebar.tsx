import React from 'react';
import { Plus, MessageSquare, Trash2, X, Sparkles, AlertCircle, Info, Database } from 'lucide-react';
import { ChatSession } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isOpen,
  onClose,
  user,
  onLogin,
  onLogout,
}: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop Overlay - Only active when menu is open on mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="md:hidden fixed inset-0 bg-black z-30"
          />
        )}
      </AnimatePresence>

      {/* Main Sidebar Drawer */}
      <div
        className={`fixed md:sticky top-0 left-0 h-screen w-[280px] bg-slate-900 border-r border-slate-800 flex flex-col z-40 transition-transform duration-300 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header Branding */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-550 via-purple-500 to-blue-700 flex items-center justify-center text-white">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-display font-bold text-white leading-tight">
                HERA
              </h2>
              <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-400 uppercase">
                HASiL Grounded
              </span>
            </div>
          </div>

          {/* Close button for mobile screen */}
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            id="close-sidebar-mobile"
          >
            <X size={18} />
          </button>
        </div>

        {/* Create New Session Actions */}
        <div className="p-4">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => {
              onNewSession();
              onClose();
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            id="new-session-sidebar"
          >
            <Plus size={16} />
            New Search Chat
          </motion.button>
        </div>

        {/* Sessions Scroll List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-slate-500">
              Recent Queries
            </span>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-8 px-4 text-slate-500 text-xs">
              No recent search sessions. Start your first query!
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  className={`group relative flex items-center rounded-xl transition-all ${
                    isActive
                      ? 'bg-slate-800/80 text-white'
                      : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {/* Select Chat Button */}
                  <button
                    onClick={() => {
                      onSelectSession(session.id);
                      onClose();
                    }}
                    className="flex-1 flex items-center gap-2.5 p-3 text-left text-sm font-medium overflow-hidden cursor-pointer"
                    id={`select-session-${session.id}`}
                  >
                    <MessageSquare
                      size={15}
                      className={isActive ? 'text-google-blue' : 'text-slate-500'}
                    />
                    <span className="truncate pr-4 leading-normal">{session.title}</span>
                  </button>

                  {/* Delete Session */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer"
                    title="Delete ChatSession"
                    id={`delete-session-${session.id}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* User Profile / Firebase Google login card */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/40">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Profile'}
                    className="w-8 h-8 rounded-full border border-slate-700 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs uppercase">
                    {(user.email || 'T').substring(0, 2)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-slate-105 truncate">
                    {user.displayName || 'Taxpayer'}
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate" title={user.email || ''}>
                    {user.email}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onLogout}
                  className="w-full py-1.5 px-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-400 hover:text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                  id="signOutButton"
                >
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-center py-1">
              <p className="text-[10px] text-slate-400 leading-normal mb-1.5">
                Sign in with Google to backup chat history across sessions.
              </p>
              <button
                onClick={onLogin}
                className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
                id="signInWithGoogle"
              >
                <Database size={13} className="text-blue-600 animate-bounce" />
                Sign in with Google
              </button>
            </div>
          )}
        </div>

        {/* Info Banner Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="p-3 bg-slate-850 border border-slate-800 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Info size={14} className="text-google-blue" />
              <span className="text-[11px] font-semibold">LHDN Grounded Mode</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Enforces reference lookups strictly from the Inland Revenue Board of Malaysia (HASiL) official registry.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
