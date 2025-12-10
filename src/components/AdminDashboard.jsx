import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaCheck, FaTimes, FaSyncAlt, FaExternalLinkAlt, 
  FaUsers, FaMoneyBillWave, FaChartLine, FaBars, 
  FaSignOutAlt, FaTachometerAlt, FaList, FaServer 
} from 'react-icons/fa';

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const AdminDashboard = ({ onClose }) => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('transactions');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false); 

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  // --- 1. HANDLE RESIZE ---
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setSidebarOpen(false); // Reset on desktop
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 2. FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("cv_token");
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, paymentsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/dashboard-stats`, { headers }).catch(() => ({ data: {} })), 
        axios.get(`${API_URL}/admin/pending-transactions`, { headers }).catch(() => ({ data: [] }))
      ]);

      setStats(statsRes.data || {});
      setPayments(paymentsRes.data || []);
    } catch (e) {
      if (e.response && e.response.status === 403) {
        Swal.fire('Access Denied', 'You are not an admin.', 'error');
        onClose(); 
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 3. LOGIC ---
  const handleDecision = async (id, action) => {
    const confirm = await Swal.fire({
      title: action === "APPROVE" ? 'Approve Payment?' : 'Reject Payment?',
      icon: action === "APPROVE" ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${action}`,
      confirmButtonColor: action === "APPROVE" ? '#10B981' : '#EF4444',
    });

    if (confirm.isConfirmed) {
      try {
        const token = localStorage.getItem("cv_token");
        await axios.post(`${API_URL}/admin/process-transaction/${id}?action=${action}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPayments(prev => prev.filter(p => p.id !== id));
        
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: `Transaction ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`
        });

        fetchData(); 
      } catch (e) {
        Swal.fire('Error', 'Operation failed', 'error');
      }
    }
  };

  // --- UI COMPONENTS ---

  const NavItem = ({ id, icon: Icon, label, count }) => (
    <button 
      onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
        activeTab === id ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-100'
      }`}
    >
      <Icon /> {label}
      {count > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{count}</span>}
    </button>
  );

  // UPDATED STAT CARD: Explicit props for colors
  const StatCard = ({ icon: Icon, label, value, bgColor, iconColor }) => (
    <div variants={itemVariants} className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
          <h3 className="text-3xl font-bold text-zinc-800">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${bgColor}`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-zinc-50 flex text-zinc-800 font-sans">
      
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && isMobile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* --- SIDEBAR --- */}
      <motion.aside 
        animate={isMobile ? { x: isSidebarOpen ? 0 : '-100%' } : { x: 0 }}
        initial={false}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-zinc-200 
          md:relative md:translate-x-0 flex flex-col
        `}
      >
        <div className="p-8 pb-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-zinc-900">Admin<span className="text-emerald-500">.</span></h1>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400"><FaTimes /></button>
        </div>

        <nav className="flex-1 px-6 space-y-2 mt-6">
          <NavItem id="dashboard" icon={FaTachometerAlt} label="Dashboard" />
          <NavItem id="transactions" icon={FaList} label="Transactions" count={payments.length} />
        </nav>

        <div className="p-6 border-t border-zinc-100">
          <button onClick={onClose} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-500 hover:text-red-600">
            <FaSignOutAlt /> Exit Panel
          </button>
        </div>
      </motion.aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/80 backdrop-blur-sm border-b border-zinc-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-zinc-500"><FaBars size={20} /></button>
            <h2 className="text-lg font-bold text-zinc-800">{activeTab === 'dashboard' ? 'Overview' : 'Verification Queue'}</h2>
          </div>
          <button onClick={fetchData} className="p-2 text-zinc-400 hover:text-emerald-600"><FaSyncAlt className={loading ? "animate-spin" : ""} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* FIXED: Passing explicit tailwind classes */}
                    <StatCard 
                      icon={FaUsers} 
                      label="Total Users" 
                      value={stats?.total_users || "0"} 
                      bgColor="bg-blue-50" 
                      iconColor="text-blue-600"
                    />
                    <StatCard 
                      icon={FaChartLine} 
                      label="Candidates" 
                      value={stats?.total_candidates || "0"} 
                      bgColor="bg-purple-50" 
                      iconColor="text-purple-600"
                    />
                    <StatCard 
                      icon={FaMoneyBillWave} 
                      label="Revenue" 
                      value={`$${stats?.total_credits_sold || 0}`} 
                      bgColor="bg-emerald-50" 
                      iconColor="text-emerald-600"
                    />
                  </div>

                  <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-zinc-100 rounded-lg text-zinc-500"><FaServer /></div>
                      <h3 className="font-bold text-zinc-900">System Health</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                       <div className="flex justify-between p-3 bg-zinc-50 rounded-xl">
                          <span className="text-zinc-500">API Latency</span>
                          <span className="font-mono font-bold text-emerald-600">24ms</span>
                       </div>
                       <div className="flex justify-between p-3 bg-zinc-50 rounded-xl">
                          <span className="text-zinc-500">Database</span>
                          <span className="font-bold text-zinc-700 flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online
                          </span>
                       </div>
                       <div className="flex justify-between p-3 bg-zinc-50 rounded-xl">
                          <span className="text-zinc-500">Pending Actions</span>
                          <span className="font-bold text-orange-500">{payments.length} items</span>
                       </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* TRANSACTIONS TAB */}
              {activeTab === 'transactions' && (
                <motion.div 
                  key="transactions"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                    {payments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                             <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
                                <FaCheck className="text-zinc-300" size={24} />
                             </div>
                             <p>No pending transactions.</p>
                        </div>
                    ) : (
                        payments.map(pay => (
                            <motion.div 
                                layout
                                key={pay.id} 
                                className="bg-white p-5 border border-zinc-200 rounded-2xl flex flex-col md:flex-row gap-4 md:items-center shadow-sm"
                            >
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-zinc-900">{pay.username}</h4>
                                            <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-wider font-bold">
                                                ID: {pay.id.slice(-6)}
                                            </span>
                                        </div>
                                        <div className="text-right md:hidden">
                                            <span className="text-emerald-600 font-bold">${pay.amount}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-3 flex gap-2 text-sm">
                                         {pay.proof_url && (
                                            <a href={pay.proof_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                                <FaExternalLinkAlt size={12} /> View Proof
                                            </a>
                                         )}
                                         <span className="text-zinc-400">|</span>
                                         <span className="text-zinc-500">{pay.submitted_at?.split('T')[0]}</span>
                                    </div>
                                </div>

                                <div className="hidden md:block text-right pr-8">
                                    <span className="block text-xl font-bold text-zinc-900">${pay.amount}</span>
                                    <span className="text-xs text-zinc-400">Amount</span>
                                </div>

                                <div className="flex gap-2 border-t pt-4 md:pt-0 md:border-t-0 border-zinc-100">
                                    <button 
                                        onClick={() => handleDecision(pay.id, 'REJECT')} 
                                        className="flex-1 md:flex-none px-4 py-2 border border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-zinc-600 rounded-lg text-sm font-bold transition-colors"
                                    >
                                        Reject
                                    </button>
                                    <button 
                                        onClick={() => handleDecision(pay.id, 'APPROVE')} 
                                        className="flex-1 md:flex-none px-4 py-2 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg text-sm font-bold shadow-lg shadow-zinc-200 transition-all"
                                    >
                                        Approve
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;