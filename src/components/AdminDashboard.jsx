import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCheck, FaTimes, FaSyncAlt, FaExternalLinkAlt,
  FaUsers, FaCoins, FaChartLine, FaBars, FaTrash,
  FaSignOutAlt, FaTachometerAlt, FaList, FaServer,
  FaExclamationTriangle, FaBan, FaUnlock, FaRedo, FaFileAlt
} from 'react-icons/fa';

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const AdminDashboard = ({ onClose }) => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('transactions');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Data State
  const [stats, setStats] = useState({});
  const [payments, setPayments] = useState([]);
  const [users, setUsers] = useState([]);
  const [failedLogs, setFailedLogs] = useState([]);
  
  // NEW: Store the current logged-in admin's ID
  const [currentAdminId, setCurrentAdminId] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // --- 2. FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("cv_token");
      const headers = { Authorization: `Bearer ${token}` };

      // UPDATED: Added a call to /users/me to get the current admin's ID
      const [analyticsRes, paymentsRes, usersRes, logsRes, meRes] = await Promise.all([
        axios.get(`${API_URL}/admin/analytics`, { headers }).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/admin/pending-transactions`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/admin/users`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/admin/failed-parsings`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/users/me`, { headers }).catch(() => ({ data: null })) // <--- Fetch Current User
      ]);

      setStats(analyticsRes.data || {});
      setPayments(paymentsRes.data || []);
      setUsers(usersRes.data || []);
      setFailedLogs(logsRes.data || []);

      // Set the current admin ID so we can protect it
      if (meRes.data) {
        setCurrentAdminId(meRes.data.id);
      }

    } catch (e) {
      if (e.response && e.response.status === 403) {
        Swal.fire('Access Denied', 'You are not an admin.', 'error');
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  // --- 3. ACTIONS ---

  const handlePaymentDecision = async (id, action) => {
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
        await axios.post(`${API_URL}/admin/process-transaction/${id}?action=${action}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        showToast(`Transaction ${action === 'APPROVE' ? 'Approved' : 'Rejected'}`, 'success');
        fetchData();
      } catch (e) { Swal.fire('Error', 'Operation failed', 'error'); }
    }
  };

  const handleToggleUser = async (user) => {
    // Prevent banning yourself
    if (user.id === currentAdminId) {
      Swal.fire('Action Denied', 'You cannot ban your own account.', 'warning');
      return;
    }

    const action = user.is_active ? 'Ban' : 'Unban';
    const confirm = await Swal.fire({
      title: `${action} User?`,
      text: `Are you sure you want to ${action.toLowerCase()} ${user.username}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: user.is_active ? '#EF4444' : '#10B981',
      confirmButtonText: `Yes, ${action} them`
    });

    if (confirm.isConfirmed) {
      try {
        const token = localStorage.getItem("cv_token");
        await axios.put(`${API_URL}/admin/users/${user.id}/toggle-status`, {}, { headers: { Authorization: `Bearer ${token}` } });
        showToast(`User ${action}ned successfully`, 'success');
        fetchData();
      } catch (e) { Swal.fire('Error', 'Could not update user.', 'error'); }
    }
  };

  const handleDeleteUser = async (user) => {
    // UPDATED: Safety Check
    if (user.id === currentAdminId) {
      Swal.fire('Action Denied', 'You cannot delete your own account.', 'error');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Delete User?',
      text: `This will permanently remove ${user.username} and cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete permanently'
    });

    if (confirm.isConfirmed) {
      try {
        const token = localStorage.getItem("cv_token");
        await axios.delete(`${API_URL}/admin/users/${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
        showToast('User deleted successfully', 'success');
        fetchData();
      } catch (e) {
        Swal.fire('Error', e.response?.data?.detail || 'Could not delete user.', 'error');
      }
    }
  };

  const handleRetryAI = async (id) => {
    try {
      const token = localStorage.getItem("cv_token");
      await axios.post(`${API_URL}/candidates/${id}/retry`, {}, { headers: { Authorization: `Bearer ${token}` } });
      showToast('AI Retry Queued', 'info');
      fetchData();
    } catch (e) { Swal.fire('Error', 'Retry failed', 'error'); }
  };

  const showToast = (title, icon) => {
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true })
      .fire({ icon, title });
  };

  // --- UI COMPONENTS ---

  const NavItem = ({ id, icon: Icon, label, count, color }) => (
    <button
      onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${activeTab === id ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-100'
        }`}
    >
      <Icon className={activeTab === id ? 'text-white' : color || 'text-zinc-400'} /> {label}
      {count > 0 && <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{count}</span>}
    </button>
  );

  const StatCard = ({ icon: Icon, label, value, bgColor, iconColor }) => (
    <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
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
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-zinc-200 md:relative md:translate-x-0 flex flex-col`}
      >
        <div className="p-8 pb-4 flex justify-between items-center">
          <div className='flex items-center gap-3'>
            <img src="/logo.svg" alt="Logo" className="w-10 h-10 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none' }} />
            <h1 className="text-xl font-bold text-zinc-900">Admin<span className="text-emerald-500">.</span></h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400"><FaTimes /></button>
        </div>

        <nav className="flex-1 px-6 space-y-2 mt-6">
          <NavItem id="dashboard" icon={FaTachometerAlt} label="Overview" />
          <NavItem id="transactions" icon={FaList} label="Payments" count={payments.length} color="text-emerald-500" />
          <NavItem id="users" icon={FaUsers} label="User Management" />
          <NavItem id="logs" icon={FaServer} label="System Logs" count={failedLogs.length} color="text-blue-400" />
        </nav>

        <div className="p-6 border-t border-zinc-100">
          <button onClick={onClose} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-500 hover:text-red-600 transition-colors">
            <FaSignOutAlt /> Exit Panel
          </button>
        </div>
      </motion.aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white/80 backdrop-blur-sm border-b border-zinc-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-zinc-500"><FaBars size={20} /></button>
            <h2 className="text-lg font-bold text-zinc-800 capitalize">
              {activeTab === 'dashboard' ? 'Overview' : activeTab.replace('-', ' ')}
            </h2>
          </div>
          <button onClick={fetchData} className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors">
            <FaSyncAlt className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">

              {/* === DASHBOARD === */}
              {activeTab === 'dashboard' && (
                <motion.div key="dashboard" variants={containerVariants} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard icon={FaCoins} label="Total Revenue" value={`$${stats?.revenue || 0}`} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
                    <StatCard icon={FaList} label="Pending Reviews" value={stats?.pending_reviews || 0} bgColor="bg-orange-50" iconColor="text-orange-500" />
                    <StatCard icon={FaChartLine} label="Files Processed" value={stats?.total_files_parsed || 0} bgColor="bg-blue-50" iconColor="text-blue-600" />
                  </div>
                  {/* Quick System Health */}
                  <div className="bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm">
                    <h3 className="font-bold text-zinc-900 mb-4 flex items-center gap-2"><FaServer className="text-zinc-400" /> System Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-zinc-50 rounded-xl flex justify-between items-center">
                        <span className="text-sm text-zinc-500">Database Connection</span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">Operational</span>
                      </div>
                      <div className="p-4 bg-zinc-50 rounded-xl flex justify-between items-center">
                        <span className="text-sm text-zinc-500">AI Service (Gemini)</span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">Active</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* === TRANSACTIONS === */}
              {activeTab === 'transactions' && (
                <motion.div key="transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  {payments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                      <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4"><FaCheck size={24} /></div>
                      <p>All payments caught up!</p>
                    </div>
                  ) : (
                    payments.map(pay => (
                      <motion.div layout key={pay.id} className="bg-white p-5 border border-zinc-200 rounded-2xl flex flex-col md:flex-row gap-4 md:items-center shadow-sm">
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div><h4 className="font-bold text-zinc-900">{pay.username}</h4><span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Ref: {pay.payment_ref}</span></div>
                            <div className="text-right md:hidden">
                              <span className="text-emerald-600 font-bold">${pay.price || pay.amount}</span>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2 text-sm">
                            {pay.proof_url && <a href={pay.proof_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline"><FaExternalLinkAlt size={12} /> View Proof</a>}
                            <span className="text-zinc-400">|</span><span className="text-zinc-500">{pay.submitted_at?.split('T')[0]}</span>
                          </div>
                        </div>
                        <div className="hidden md:block text-right pr-8">
                          <span className="block text-xl font-bold text-zinc-900">
                            ${pay.price ? pay.price.toFixed(2) : pay.amount}
                          </span>
                          <span className="text-xs text-zinc-400">Paid Amount</span>
                        </div>
                        <div className="flex gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-zinc-100">
                          <button onClick={() => handlePaymentDecision(pay.id, 'REJECT')} className="flex-1 md:flex-none px-4 py-2 border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-600 rounded-lg text-sm font-bold transition-colors">Reject</button>
                          <button onClick={() => handlePaymentDecision(pay.id, 'APPROVE')} className="flex-1 md:flex-none px-4 py-2 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg text-sm font-bold shadow-lg transition-all">Approve</button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* === USERS MANAGEMENT === */}
              {activeTab === 'users' && (
                <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                  {/* --- MOBILE VIEW: CARDS --- */}
                  <div className="block md:hidden space-y-3">
                    {users.map(user => {
                      // UPDATED: Check if this user row is ME
                      const isMe = currentAdminId && user.id === currentAdminId;
                      
                      return (
                        <div key={user.id} className={`p-4 rounded-xl border shadow-sm transition-colors ${!user.is_active ? 'bg-red-50/50 border-red-100' : 'bg-white border-zinc-200'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                                {user.username}
                                {isMe && <span className="text-[9px] bg-zinc-800 text-white px-1.5 py-0.5 rounded uppercase">YOU</span>}
                              </div>
                              <div className="text-[10px] text-zinc-500 mt-0.5">Joined: {new Date(user.joined_at).toLocaleDateString()}</div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {user.is_active ? 'Active' : 'Banned'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-4 bg-zinc-50 p-2 rounded-lg">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
                              <FaCoins size={12} /> {user.credits} Credits
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-medium text-purple-600">
                              <FaFileAlt size={12} /> {user.uploads} Uploads
                            </div>
                          </div>

                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleToggleUser(user)}
                              disabled={isMe}
                              className={`flex-1 py-2.5 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition-colors 
                                ${isMe ? 'border-zinc-100 text-zinc-300 cursor-not-allowed bg-zinc-50' : 
                                  user.is_active ? 'border-orange-200 text-orange-600 bg-white hover:bg-orange-50' : 'border-green-200 text-green-600 bg-white hover:bg-green-50'
                                }`}
                            >
                              {user.is_active ? <><FaBan /> Ban</> : <><FaUnlock /> Unban</>}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={isMe}
                              className={`px-4 py-2.5 rounded-lg text-xs font-bold border transition-colors 
                                ${isMe ? 'border-zinc-100 text-zinc-300 cursor-not-allowed bg-zinc-50' : 'border-red-200 text-red-600 bg-white hover:bg-red-50 hover:text-red-700'}`}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* --- DESKTOP VIEW: TABLE --- */}
                  <div className="hidden md:block bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Joined</th>
                          <th className="px-6 py-4">Stats</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {users.map(user => {
                          const isMe = currentAdminId && user.id === currentAdminId;
                          return (
                            <tr key={user.id} className={`hover:bg-zinc-50/50 transition-colors ${!user.is_active ? 'bg-red-50/30' : ''}`}>
                              <td className="px-6 py-4">
                                <div className="font-bold text-zinc-900 flex items-center gap-2">
                                  {user.username}
                                  {isMe && <span className="text-[10px] bg-zinc-900 text-white px-2 py-0.5 rounded-md font-bold">YOU</span>}
                                </div>
                                <div className={`text-xs inline-block px-2 py-0.5 rounded-md mt-1 ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {user.is_active ? 'Active' : 'Banned'}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-zinc-500">{new Date(user.joined_at).toLocaleDateString()}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4 text-xs font-medium">
                                  <span className="flex items-center gap-1 text-blue-600"><FaCoins /> {user.credits} Credits</span>
                                  <span className="flex items-center gap-1 text-purple-600"><FaFileAlt /> {user.uploads} Uploads</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleToggleUser(user)}
                                    disabled={isMe}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border 
                                      ${isMe ? 'border-zinc-100 text-zinc-300 cursor-not-allowed' : 
                                        user.is_active ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'
                                      }`}
                                  >
                                    {user.is_active ? <span className="flex items-center gap-1"><FaBan /> Ban</span> : <span className="flex items-center gap-1"><FaUnlock /> Unban</span>}
                                  </button>

                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    disabled={isMe}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors
                                      ${isMe ? 'border-zinc-100 text-zinc-300 cursor-not-allowed' : 'border-zinc-200 text-zinc-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50'}`}
                                    title="Delete User"
                                  >
                                    <FaTrash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* === SYSTEM LOGS === */}
              {activeTab === 'logs' && (
                <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                  {failedLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                      <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4"><FaCheck size={24} /></div>
                      <p>System is healthy. No failed parsings.</p>
                    </div>
                  ) : (
                    failedLogs.map(log => (
                      <div key={log.id} className="bg-white p-5 border border-red-100 rounded-2xl flex flex-col md:flex-row gap-4 items-start shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-400" />
                        <div className="flex-1">
                          <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                            <FaExclamationTriangle className="text-red-500" /> {log.file_name}
                          </h4>
                          <p className="text-xs text-red-500 font-mono mt-1 bg-red-50 p-2 rounded-lg border border-red-100 inline-block">{log.error_msg}</p>
                          <div className="mt-2 text-xs text-zinc-400">User: {log.uploaded_by} • {new Date(log.upload_date).toLocaleString()}</div>
                        </div>
                        <div className="flex gap-2">
                          {log.cv_url && (
                            <a href={log.cv_url} target="_blank" rel="noreferrer" className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-500"><FaExternalLinkAlt /></a>
                          )}
                          <button onClick={() => handleRetryAI(log.id)} className="px-4 py-2 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg"><FaRedo /> Retry AI</button>
                        </div>
                      </div>
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