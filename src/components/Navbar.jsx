import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUserShield,
  FaDownload,
  FaChevronDown,
  FaCog,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaWallet,
  FaLock,
  FaFolder,
  FaFolderOpen,
  FaLayerGroup,
} from "react-icons/fa";
import CreditBadge from "./CreditBadge";

const ADMIN_EMAIL = "saksovathanaksay@gmail.com";

const Navbar = ({
  deferredPrompt,
  handleInstallClick,
  isAuthenticated,
  setShowLoginModal,
  handleLogout,
  currentUser,
  userEmail,
  onOpenSettings,
  onOpenAdmin,
  autoDeleteEnabled,
  credits,
  onBuyCredits,
  // NEW PROPS FOR FOLDERS
  folders = [],
  activeFolder,
  onSelectFolder,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const userInitial =
    currentUser && currentUser.length > 0
      ? currentUser.charAt(0).toUpperCase()
      : "?";

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showMobileMenu]);

  return (
    <>
      <nav className="flex-none h-12 px-4 md:px-6 border-b border-zinc-100 bg-white/80 backdrop-blur-md flex items-center justify-between z-40 sticky top-0 select-none">
        {/* --- LEFT: Logo & User Info --- */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img
            src="/logo.svg"
            alt="Logo"
            className="w-10 h-10 object-contain shrink-0"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />

          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs text-zinc-400 font-sans">
                Welcome Back,
              </span>
              {isAuthenticated && autoDeleteEnabled && (
                <div className="hidden md:flex items-center gap-1 px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-[9px] font-bold text-green-700 uppercase tracking-wide">
                  <FaUserShield size={8} />
                  <span>Auto-Delete</span>
                </div>
              )}
            </div>
            <span className="text-sm md:text-md font-semibold text-zinc-900 tracking-tight truncate max-w-[150px] md:max-w-none">
              {currentUser || "Guest"}.
            </span>
          </div>
        </div>

        {/* --- RIGHT: Actions --- */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Desktop Install Button */}
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="hidden lg:flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg text-[11px] font-bold uppercase hover:bg-blue-100 transition"
            >
              <FaDownload size={12} /> Install App
            </button>
          )}

          {isAuthenticated ? (
            <>
              {/* --- DESKTOP MENU --- */}
              <div className="hidden md:flex items-center gap-4">
                <CreditBadge credits={credits} onClick={onBuyCredits} />

                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="flex items-center gap-2 outline-none group p-1 rounded-full hover:bg-zinc-50 transition"
                  >
                    <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-700">
                      {userInitial}
                    </div>
                    {/* ANIMATED CHEVRON */}
                    <motion.div
                      animate={{ rotate: showMenu ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FaChevronDown size={10} className="text-zinc-400" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-14 w-56 bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden z-50"
                        >
                          <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">
                              Signed in as
                            </p>
                            <p className="text-sm font-bold text-zinc-900 truncate">
                              {currentUser}
                            </p>
                          </div>

                          {/* --- ADMIN BUTTON (DESKTOP) --- */}
                          {userEmail === ADMIN_EMAIL && (
                            <button
                              onClick={() => {
                                setShowMenu(false);
                                onOpenAdmin();
                              }}
                              className="w-full flex items-center gap-3 px-5 py-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition text-left"
                            >
                              <FaLock /> Admin Panel
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setShowMenu(false);
                              onOpenSettings();
                            }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition text-left"
                          >
                            <FaCog /> Settings
                          </button>

                          <button
                            onClick={() => {
                              setShowMenu(false);
                              handleLogout();
                              window.location.reload();
                            }}
                            className="w-full flex items-center gap-3 px-5 py-3 text-xs font-medium text-red-600 hover:bg-red-50 transition text-left"
                          >
                            <FaSignOutAlt /> Sign Out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* --- MOBILE ITEMS --- */}

              {/* 1. Mobile Credits Display (Near Hamburger) */}
              <div className="md:hidden flex items-center">
                <CreditBadge credits={credits} onClick={onBuyCredits} />
              </div>

              {/* 2. Mobile Menu Button (Hamburger) */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="md:hidden p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                <FaBars size={20} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-4 py-2 bg-black text-white rounded text-xs font-bold uppercase hover:bg-zinc-800 transition"
            >
              Login
            </button>
          )}
        </div>
      </nav>

      {/* --- MOBILE FULL SCREEN MENU (Outside Nav) --- */}
      <AnimatePresence>
        {isAuthenticated && showMobileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-white z-60 flex flex-col md:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-16 border-b border-zinc-100 shrink-0">
              <span className="text-lg font-bold text-black">Menu</span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 bg-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-200"
              >
                <FaTimes size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-4">
              {/* User Profile Summary */}
              <div className="flex items-center gap-3 pb-6 border-b border-zinc-100 shrink-0">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-lg font-bold text-zinc-600">
                  {userInitial}
                </div>
                <div>
                  <p className="font-bold text-lg text-black">{currentUser}</p>
                  <p className="text-xs text-zinc-500">Active Session</p>
                </div>
              </div>

              {/* --- NEW: WORKSPACES (FOLDERS) SECTION --- */}
              <div className="py-2 border-b border-zinc-100 pb-4 shrink-0">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">
                  Workspaces
                </p>
                <div className="space-y-1">
                  {/* All Candidates Option */}
                  <button
                    onClick={() => {
                      if (onSelectFolder) onSelectFolder(null);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      activeFolder === null
                        ? "bg-zinc-100 text-black font-bold"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    <FaLayerGroup
                      size={14}
                      className={
                        activeFolder === null ? "text-black" : "text-zinc-400"
                      }
                    />
                    <span>All Candidates</span>
                  </button>

                  {/* Dynamic Folders List */}
                  {folders &&
                    folders.length > 0 &&
                    folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => {
                          if (onSelectFolder) onSelectFolder(folder.id);
                          setShowMobileMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          activeFolder === folder.id
                            ? "bg-zinc-100 text-black font-bold"
                            : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                        }`}
                      >
                        {activeFolder === folder.id ? (
                          <FaFolderOpen size={14} className="text-black" />
                        ) : (
                          <FaFolder size={14} className="text-zinc-400" />
                        )}
                        <span className="truncate text-left flex-1">
                          {folder.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100">
                          {folder.count || 0}
                        </span>
                      </button>
                    ))}

                  {(!folders || folders.length === 0) && (
                    <div className="px-3 py-2 text-xs text-zinc-400 italic">
                      No folders created
                    </div>
                  )}
                </div>
              </div>
              {/* --- END WORKSPACES SECTION --- */}

              {/* Credits Row in Menu */}
              <div className="flex items-center justify-between py-2 shrink-0">
                <div className="flex items-center gap-2 text-zinc-600 font-medium">
                  <FaWallet className="text-zinc-400" /> Credits:
                </div>
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onBuyCredits();
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-md text-xs font-bold"
                >
                  {credits} available <span className="opacity-50">|</span> +
                  Add
                </button>
              </div>

              {/* --- ADMIN BUTTON (MOBILE) --- */}
              {userEmail === ADMIN_EMAIL && (
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    onOpenAdmin();
                  }}
                  className="flex items-center gap-3 py-3 text-base font-medium text-zinc-800 border-b border-zinc-50 shrink-0"
                >
                  <FaLock className="text-zinc-400" /> Admin Panel
                </button>
              )}

              {/* Settings */}
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onOpenSettings();
                }}
                className="flex items-center gap-3 py-3 text-base font-medium text-zinc-800 border-b border-zinc-50 shrink-0"
              >
                <FaCog className="text-zinc-400" /> Settings
              </button>

              {/* Install (Conditional) */}
              {deferredPrompt && (
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleInstallClick();
                  }}
                  className="flex items-center gap-3 py-3 text-base font-medium text-blue-600 border-b border-zinc-50 shrink-0"
                >
                  <FaDownload /> Install App
                </button>
              )}

              <div className="mt-auto pt-4 shrink-0">
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleLogout();
                    window.location.reload();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-4 text-red-600 font-bold bg-red-50 rounded-xl"
                >
                  <FaSignOutAlt /> Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
