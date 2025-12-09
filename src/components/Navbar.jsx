import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FaUserShield, FaDownload, FaChevronDown, FaCog, 
  FaSignOutAlt, FaBars, FaTimes, FaUser 
} from 'react-icons/fa'
import CreditBadge from './CreditBadge'

const Navbar = ({
  deferredPrompt, handleInstallClick, isAuthenticated, setShowLoginModal,
  handleLogout, currentUser, onOpenSettings, autoDeleteEnabled, credits,
  onBuyCredits // 1. ADD THIS to the props list
}) => {
  const [showMenu, setShowMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const userInitial = (currentUser && currentUser.length > 0) ? currentUser.charAt(0).toUpperCase() : "?"

  const menuVariants = {
    closed: {
      x: "100%",
      transition: { type: "spring", stiffness: 400, damping: 40 }
    },
    open: {
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        staggerChildren: 0.05,
        delayChildren: 0.05
      }
    }
  };

  const itemVariants = {
    closed: { x: 20, opacity: 0 },
    open: { x: 0, opacity: 1, transition: { duration: 0.2 } }
  };

  return (
    <nav className="flex-none h-14 px-4 border-b border-zinc-100 bg-white flex items-center justify-between z-50 sticky top-0 select-none">
      <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
        <img src="/logo.svg" alt="Logo" className="w-10 h-10 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none' }} />
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5 lg:gap-2">
            <span className="text-xs text-zinc-400 leading-none mb-0.5">Welcome Back,</span>
            {isAuthenticated && autoDeleteEnabled && (
              <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-[8px] lg:text-[9px] font-bold text-green-700 uppercase tracking-wide cursor-help shrink-0">
                <FaUserShield size={8} className="lg:w-[9px] lg:h-[9px]" />
                <span>Auto-Delete</span>
              </div>
            )}
          </div>
          <span className="text-xl font-bold text-black tracking-tight leading-none">{currentUser || "Guest"}.</span>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        {deferredPrompt && (
          <button onClick={handleInstallClick} className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-blue-600 rounded-md text-[10px] font-bold uppercase hover:bg-blue-50 transition">
            <FaDownload size={10} /> Install App
          </button>
        )}

        {isAuthenticated ? (
          <>
            <div className="hidden md:flex items-center gap-3">
              {/* 2. UPDATE THIS: Use onBuyCredits instead of onOpenSettings */}
              <CreditBadge credits={credits} onClick={onBuyCredits} />
              
              <div className="relative">
                <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-1.5 outline-none group">
                  <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 group-hover:bg-zinc-200 group-hover:text-black transition">
                    {userInitial}
                  </div>
                  <FaChevronDown size={9} className="text-zinc-300 group-hover:text-zinc-500 transition" />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 top-12 w-48 bg-white rounded-lg shadow-xl border border-zinc-100 overflow-hidden z-50 py-1"
                      >
                        <div className="px-4 py-2 border-b border-zinc-50">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase">Signed in as</p>
                          <p className="text-xs font-bold text-black truncate">{currentUser}</p>
                        </div>
                        <button onClick={() => { setShowMenu(false); onOpenSettings(); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition text-left">
                          <FaCog className="text-zinc-400" /> Settings
                        </button>
                        <div className="h-px bg-zinc-100 my-1"></div>
                        <button onClick={() => { setShowMenu(false); handleLogout(); window.location.reload(); }} className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition text-left">
                          <FaSignOutAlt /> Sign Out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <button onClick={() => setShowMobileMenu(true)} className="md:hidden p-2 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 rounded-lg transition">
              <FaBars size={18} />
            </button>

            <AnimatePresence>
              {showMobileMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowMobileMenu(false)}
                    className="md:hidden fixed inset-0 bg-black/30 z-50 will-change-opacity"
                  />
                  <motion.div
                    variants={menuVariants}
                    initial="closed" animate="open" exit="closed"
                    className="md:hidden fixed top-0 right-0 bottom-0 w-full bg-white shadow-2xl z-60 flex flex-col will-change-transform"
                  >
                    <div className="h-20 flex items-end justify-between px-6 pb-4 border-b border-zinc-100 bg-zinc-50 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-sm font-bold shadow-sm">
                          {userInitial}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-black">{currentUser}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Free Plan</p>
                        </div>
                      </div>
                      <button onClick={() => setShowMobileMenu(false)} className="p-2 bg-white rounded-full shadow-sm text-zinc-400 hover:text-black">
                        <FaTimes size={14} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      <motion.div variants={itemVariants} className="p-4 bg-zinc-900 rounded-xl text-white mb-6 shadow-lg">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Available Credits</p>
                        <div className="flex justify-between items-end">
                          <span className="text-3xl font-bold">{credits}</span>
                          
                          {/* 3. UPDATE THIS: Use onBuyCredits here too */}
                          <button onClick={() => { setShowMobileMenu(false); onBuyCredits(); }} className="text-[10px] font-bold bg-white text-black px-2 py-1 rounded">ADD MORE</button>
                        
                        </div>
                      </motion.div>

                      <button onClick={() => { setShowMobileMenu(false); onOpenSettings(); }} className="w-full flex items-center gap-4 px-4 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-50 rounded-xl transition">
                        <FaUser className="text-zinc-400" /> Account Settings
                      </button>

                      {deferredPrompt && (
                        <motion.button variants={itemVariants} onClick={() => { setShowMobileMenu(false); handleInstallClick(); }} className="w-full flex items-center gap-4 px-4 py-3 text-sm font-bold text-blue-600 bg-blue-50 rounded-xl transition">
                          <FaDownload /> Install App
                        </motion.button>
                      )}
                    </div>

                    <motion.div variants={itemVariants} className="p-6 border-t border-zinc-100">
                      <button onClick={() => { setShowMobileMenu(false); handleLogout(); window.location.reload(); }} className="w-full flex items-center justify-center gap-2 px-4 py-4 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 active:bg-red-200 rounded-xl transition">
                        <FaSignOutAlt /> Sign Out
                      </button>
                    </motion.div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        ) : (
          <button onClick={() => setShowLoginModal(true)} className="px-3 lg:px-4 py-1.5 lg:py-2 bg-black text-white rounded text-[10px] lg:text-xs font-bold uppercase hover:bg-zinc-800 active:bg-zinc-900 transition">
            Login
          </button>
        )}
      </div>
    </nav>
  )
}

export default Navbar