import { useState, useEffect } from 'react'
import QRCode from "react-qr-code";
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion'
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
    FaUserShield, FaFileExcel, FaCloudUploadAlt,
    FaSave, FaTrash, FaCheck, FaUser, FaCreditCard, FaLock,
    FaTimes, FaArrowLeft, FaChevronRight, FaHistory, FaBolt, FaSync
} from 'react-icons/fa'

const MySwal = withReactContent(Swal);

const SettingsPage = ({ onClose, initialSettings, onSave, currentCredits, onPaymentSuccess }) => {
    const [activeTab, setActiveTab] = useState('account');
    // Mobile Navigation State: 'menu' or 'detail'
    const [mobileView, setMobileView] = useState('menu');

    // Initialize local state
    const [localSettings, setLocalSettings] = useState(initialSettings || {
        autoDelete: false,
        retention: '30',
        exportFields: {
            phone: true, dob: true, address: true,
            gender: true, education: true, experience: true
        },
        autoTags: ""
    });

    // --- PAYMENT & TRANSACTION STATES ---
    const [credits, setCredits] = useState(currentCredits || 0);
    const [qrData, setQrData] = useState(null);
    const [checkInterval, setCheckInterval] = useState(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [transactions, setTransactions] = useState([]); // Store list of transactions

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    const currentUserEmail = initialSettings.profile?.username;

    // Handle Mobile Tab Selection
    const handleTabSelect = (id) => {
        setActiveTab(id);
        setMobileView('detail');
    }

    const handleBackToMenu = () => {
        setMobileView('menu');
    }

    const fetchUserCredits = async () => {
        try {
            const token = localStorage.getItem("cv_token");
            const res = await axios.get(`${API_URL}/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCredits(res.data.current_credits);
        } catch (e) {
            console.error("Failed to fetch credits:", e);
        }
    };

    const fetchTransactions = async () => {
        try {
            const token = localStorage.getItem("cv_token");
            const res = await axios.get(`${API_URL}/admin/transactions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTransactions(res.data);
        } catch (e) { console.error("Failed to fetch transactions:", e); }
    };

    // Refresh data when switching tabs
    useEffect(() => {
        if (activeTab === 'billing') fetchUserCredits();
        if (activeTab === 'transactions') fetchTransactions();
    }, [activeTab]);

    const handleBuy = async (packageId) => {
        try {
            const res = await axios.post(`${API_URL}/api/create-payment`, {
                package_id: packageId,
                email: currentUserEmail
            });
            setQrData(res.data);
            setPaymentSuccess(false);
            startPolling(res.data.md5);
        } catch (error) {
            console.error("Payment Error", error);
            MySwal.fire({ icon: 'error', title: 'Error', text: 'Could not generate QR code.' });
        }
    };

    const startPolling = (md5) => {
        if (checkInterval) clearInterval(checkInterval);

        const interval = setInterval(async () => {
            try {
                const res = await axios.post(`${API_URL}/api/check-payment-status?md5_hash=${md5}`);

                if (res.data.status === "PAID") {
                    clearInterval(interval);
                    setQrData(null);
                    setPaymentSuccess(true);
                    MySwal.fire({ icon: 'success', title: 'Payment Successful!', timer: 2000, showConfirmButton: false });
                    fetchUserCredits();
                    if (onPaymentSuccess) onPaymentSuccess();
                }
            } catch (e) { }
        }, 3000);

        setCheckInterval(interval);
    };

    const handleForceApprove = async (md5) => {
        try {
            const res = await axios.post(`${API_URL}/api/check-payment-status?md5_hash=${md5}&force=true`);
            if (res.data.status === 'PAID') {
                MySwal.fire({ icon: 'success', title: 'Force Approved!', timer: 1500, showConfirmButton: false });
                fetchTransactions(); // Refresh list
                fetchUserCredits();  // Update credit display
                if (onPaymentSuccess) onPaymentSuccess(); // Notify parent app
            }
        } catch (e) {
            MySwal.fire({ icon: 'error', title: 'Error', text: e.message });
        }
    };

    useEffect(() => {
        return () => { if (checkInterval) clearInterval(checkInterval); }
    }, [checkInterval]);

    const handleToggleField = (field) => {
        setLocalSettings(prev => ({
            ...prev,
            exportFields: {
                ...prev.exportFields,
                [field]: !prev.exportFields[field]
            }
        }));
    };

    const handleClearHistory = async () => {
        const result = await MySwal.fire({
            title: 'Clear History?',
            text: "This will permanently delete all transaction logs.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, Clear All'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`${API_URL}/admin/transactions`);
                MySwal.fire('Cleared!', 'History has been wiped.', 'success');
                fetchTransactions(); // Refresh the list (it should be empty now)
            } catch (e) {
                MySwal.fire('Error', 'Failed to clear history.', 'error');
            }
        }
    };

    const getTabTitle = (tab) => {
        switch (tab) {
            case 'general': return 'Privacy Configuration';
            case 'account': return 'Account Profile';
            case 'parsing': return 'Parsing Rules';
            case 'export': return 'Excel Exports';
            case 'billing': return 'Billing & Usage';
            case 'transactions': return 'Transaction History';
            default: return 'Settings';
        }
    }

    // --- ANIMATION VARIANTS ---
    const overlayVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } };
    const containerVariants = { hidden: { y: "100%", opacity: 0 }, visible: { y: 0, opacity: 1 }, exit: { y: "100%", opacity: 0 } };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-100 flex justify-center items-end lg:items-center pointer-events-none">

                {/* BACKDROP */}
                <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="exit" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" />

                {/* MAIN CONTAINER */}
                <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="bg-zinc-50 w-full max-w-4xl h-[92vh] rounded-t-2xl lg:rounded-xl shadow-2xl flex flex-col lg:flex-row overflow-hidden pointer-events-auto relative">

                    {/* MOBILE DRAG HANDLE */}
                    <div className="lg:hidden w-full h-1.5 absolute top-2 left-0 flex justify-center z-50 pointer-events-none">
                        <div className="w-12 h-1.5 bg-zinc-300 rounded-full" />
                    </div>

                    {/* === SIDEBAR === */}
                    <div className={`flex-col bg-zinc-50 border-r border-zinc-200 h-full overflow-y-auto w-full lg:w-64 pt-6 lg:pt-0 ${mobileView === 'menu' ? 'flex' : 'hidden lg:flex'}`}>
                        <div className="p-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-black">Settings</h2>
                                <p className="text-xs text-zinc-400 mt-1">Manage workspace</p>
                            </div>
                            <button onClick={onClose} className="p-2 bg-white rounded-full text-zinc-400 hover:text-black shadow-sm lg:hidden"><FaTimes /></button>
                        </div>

                        <nav className="flex-1 p-4 space-y-2">
                            <SidebarItem icon={FaUser} label="Account" id="account" active={activeTab} onClick={handleTabSelect} />
                            <SidebarItem icon={FaUserShield} label="Privacy" id="general" active={activeTab} onClick={handleTabSelect} />
                            <SidebarItem icon={FaCloudUploadAlt} label="Parsing Rules" id="parsing" active={activeTab} onClick={handleTabSelect} />
                            <SidebarItem icon={FaFileExcel} label="Excel Exports" id="export" active={activeTab} onClick={handleTabSelect} />
                            <SidebarItem icon={FaCreditCard} label="Billing" id="billing" active={activeTab} onClick={handleTabSelect} />
                            <SidebarItem icon={FaHistory} label="Transactions" id="transactions" active={activeTab} onClick={handleTabSelect} />
                        </nav>

                        <div className="hidden lg:block p-4 border-t border-zinc-200">
                            <button onClick={onClose} className="w-full py-2 text-xs font-bold uppercase text-zinc-500 hover:text-black border border-zinc-200 rounded bg-white hover:bg-zinc-50 transition">Close</button>
                        </div>
                    </div>

                    {/* === CONTENT AREA === */}
                    <div className={`flex-1 flex-col bg-white h-full relative ${mobileView === 'detail' ? 'flex' : 'hidden lg:flex'}`}>
                        {/* HEADER */}
                        <div className="lg:hidden h-14 border-b border-zinc-100 flex items-center px-4 justify-between bg-white shrink-0 pt-2">
                            <button onClick={handleBackToMenu} className="flex items-center gap-2 text-zinc-500 hover:text-black py-2"><FaArrowLeft size={14} /> <span className="text-xs font-bold uppercase">Back</span></button>
                            <span className="text-sm font-bold text-black truncate max-w-[150px]">{getTabTitle(activeTab)}</span>
                            <div className="w-10"></div>
                        </div>

                        <div className="hidden lg:flex h-16 border-b border-zinc-100 items-center px-8 justify-between shrink-0">
                            <h3 className="text-lg font-bold capitalize text-zinc-800">{getTabTitle(activeTab)}</h3>
                            {activeTab !== 'transactions' && activeTab !== 'billing' && (
                                <button onClick={() => onSave(localSettings)} className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded text-xs font-bold uppercase hover:bg-zinc-800 transition shadow-lg active:scale-95">
                                    <FaSave /> Save Changes
                                </button>
                            )}
                        </div>

                        {/* SCROLLABLE CONTENT */}
                        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
                            <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>

                                {/* ACCOUNT TAB */}
                                {activeTab === 'account' && (
                                    <div className="space-y-6 max-w-lg">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-2xl font-bold text-zinc-400 border border-zinc-200">
                                                {localSettings.profile?.displayName ? localSettings.profile.displayName.charAt(0).toUpperCase() : "A"}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-black">{localSettings.profile?.displayName || localSettings.profile?.username}</h4>
                                                <p className="text-xs text-zinc-500">{localSettings.profile?.org || "My Organization"} • Free Plan</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between">
                                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Username (System ID)</label>
                                                    <span className="text-[10px] text-zinc-400 flex items-center gap-1"><FaLock size={8} /> Locked</span>
                                                </div>
                                                <input type="text" value={localSettings.profile?.username || ""} disabled className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-sm text-zinc-500 font-mono cursor-not-allowed" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Display Name</label>
                                                <input type="text" placeholder="e.g. John Doe" value={localSettings.profile?.displayName || ""} onChange={(e) => setLocalSettings({ ...localSettings, profile: { ...localSettings.profile, displayName: e.target.value } })} className="w-full bg-white border border-zinc-300 rounded p-2 text-sm font-semibold text-black focus:border-black outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Organization Name</label>
                                                <input type="text" value={localSettings.profile?.org || ""} onChange={(e) => setLocalSettings({ ...localSettings, profile: { ...localSettings.profile, org: e.target.value } })} className="w-full bg-white border border-zinc-300 rounded p-2 text-sm font-semibold text-black focus:border-black outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* PRIVACY TAB */}
                                {activeTab === 'general' && (
                                    <div className="space-y-6 max-w-lg">
                                        <div className={`p-4 rounded-lg border transition-all duration-300 ${localSettings.autoDelete ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <FaUserShield className={localSettings.autoDelete ? "text-green-600" : "text-zinc-400"} size={16} />
                                                    <h4 className={`text-sm font-bold uppercase ${localSettings.autoDelete ? "text-green-800" : "text-zinc-500"}`}>Auto-Delete Files</h4>
                                                </div>
                                                <button onClick={() => setLocalSettings({ ...localSettings, autoDelete: !localSettings.autoDelete })} className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${localSettings.autoDelete ? 'bg-green-500' : 'bg-zinc-300'}`}>
                                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${localSettings.autoDelete ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-zinc-500 leading-relaxed font-medium">When enabled, original PDF files will be automatically marked for deletion **24 hours** after upload.</p>
                                        </div>
                                    </div>
                                )}

                                {/* EXCEL TAB */}
                                {activeTab === 'export' && (
                                    <div className="space-y-6 max-w-lg">
                                        <p className="text-sm text-zinc-500 font-medium">Select which columns to include when downloading the Excel file.</p>
                                        <div className="grid grid-cols-1 gap-3">
                                            <Checkbox label="Phone Number" checked={localSettings.exportFields.phone} onChange={() => handleToggleField('phone')} />
                                            <Checkbox label="Date of Birth" checked={localSettings.exportFields.dob} onChange={() => handleToggleField('dob')} />
                                            <Checkbox label="Full Address" checked={localSettings.exportFields.address} onChange={() => handleToggleField('address')} />
                                            <Checkbox label="Gender" checked={localSettings.exportFields.gender} onChange={() => handleToggleField('gender')} />
                                            <Checkbox label="Education / School" checked={localSettings.exportFields.education} onChange={() => handleToggleField('education')} />
                                            <Checkbox label="Experience Summary" checked={localSettings.exportFields.experience} onChange={() => handleToggleField('experience')} />
                                        </div>
                                    </div>
                                )}

                                {/* PARSING TAB */}
                                {activeTab === 'parsing' && (
                                    <div className="space-y-6 max-w-lg">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Target Keywords</label>
                                            <textarea className="w-full border border-zinc-300 rounded p-3 text-sm focus:ring-1 focus:ring-black outline-none bg-white text-black font-medium" rows="3" value={localSettings.autoTags} onChange={(e) => setLocalSettings({ ...localSettings, autoTags: e.target.value })} placeholder="e.g. Sales, Barista, Kitchen Hand, Baker" />
                                            <p className="text-[10px] text-zinc-400 mt-2 font-medium">Keywords used for auto-highlighting (Coming Soon).</p>
                                        </div>
                                    </div>
                                )}

                                {/* BILLING TAB */}
                                {activeTab === 'billing' && (
                                    <div className="space-y-8 max-w-lg">
                                        <div className="bg-linear-to-br from-zinc-900 to-zinc-800 text-white p-6 rounded-xl shadow-xl relative overflow-hidden border border-zinc-700">
                                            <div className="relative z-10">
                                                <h4 className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Available Credits</h4>
                                                <div className="text-4xl font-bold mb-4">{credits || 0}</div>
                                                <div className="text-xs opacity-70">1 Credit = 1 CV Parsing</div>
                                            </div>
                                        </div>

                                        {qrData && !paymentSuccess && (
                                            <div className="p-4 border-2 border-blue-500 bg-blue-50 rounded-xl flex flex-col items-center text-center">
                                                <h3 className="font-bold text-lg mb-2 text-blue-900">Scan with ABA / Bakong</h3>
                                                <div className="bg-white p-2 rounded shadow-sm mb-3">
                                                    <QRCode value={qrData.qr_code} size={180} />
                                                </div>
                                                <p className="text-xl font-bold text-black">${qrData.amount} USD</p>
                                                <div className="flex items-center gap-2 mt-2 text-xs font-bold text-blue-600 animate-pulse">
                                                    <FaCreditCard /> Waiting for payment...
                                                </div>
                                                <button onClick={() => { setQrData(null); clearInterval(checkInterval); }} className="mt-4 text-xs underline text-zinc-500">Cancel</button>
                                            </div>
                                        )}

                                        {!qrData && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <button onClick={() => handleBuy('small')} className="p-4 border border-zinc-200 rounded-xl hover:border-black hover:shadow-md transition text-left group">
                                                    <div className="text-xs font-bold text-zinc-400 uppercase">Starter Pack</div>
                                                    <div className="text-2xl font-bold text-black mt-1">$1.00</div>
                                                    <div className="text-sm font-medium text-green-600 mt-1">20 Credits</div>
                                                </button>

                                                <button onClick={() => handleBuy('pro')} className="p-4 border border-zinc-200 rounded-xl hover:border-black hover:shadow-md transition text-left group relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 bg-black text-white text-[9px] font-bold px-2 py-1 rounded-bl">POPULAR</div>
                                                    <div className="text-xs font-bold text-zinc-400 uppercase">Pro Pack</div>
                                                    <div className="text-2xl font-bold text-black mt-1">$5.00</div>
                                                    <div className="text-sm font-medium text-green-600 mt-1">150 Credits</div>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* --- TRANSACTIONS TAB (NEW) --- */}
                                {activeTab === 'transactions' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-black">Recent Transactions</h4>
                                            <div className="flex gap-4">
                                                <button onClick={fetchTransactions} className="text-md text-blue-500 hover:cursor-pointer flex items-center gap-2">
                                                    <FaSync size={10} /> Refresh
                                                </button>
                                                <button
                                                    onClick={handleClearHistory}
                                                    className="text-md text-red-500 hover:cursor-pointer flex items-center gap-2"
                                                >
                                                    <FaTrash size={10} /> Clear
                                                </button>
                                            </div>
                                        </div>

                                        <div className="border border-zinc-200 rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-zinc-50 border-b border-zinc-200">
                                                    <tr>
                                                        <th className="p-3 font-bold text-zinc-500 text-xs uppercase">Ref</th>
                                                        <th className="p-3 font-bold text-zinc-500 text-xs uppercase">Amount</th>
                                                        <th className="p-3 font-bold text-zinc-500 text-xs uppercase">Status</th>
                                                        <th className="p-3 font-bold text-zinc-500 text-xs uppercase text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100">
                                                    {transactions.length === 0 ? (
                                                        <tr><td colSpan="4" className="p-8 text-center text-zinc-400 italic">No transactions found.</td></tr>
                                                    ) : (
                                                        transactions.map((tx) => (
                                                            <tr key={tx.id} className="hover:bg-zinc-50 transition">
                                                                <td className="p-3 font-mono text-xs text-zinc-500">{tx.payment_ref || "N/A"}</td>
                                                                <td className={`p-3 font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                                                                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                                        tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                                                                        }`}>
                                                                        {tx.status}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-right">
                                                                    {tx.status === 'PENDING' && tx.md5_hash && (
                                                                        <button
                                                                            onClick={() => handleForceApprove(tx.md5_hash)}
                                                                            className="bg-black text-white px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-zinc-800 transition flex items-center gap-1 ml-auto"
                                                                        >
                                                                            <FaBolt size={10} /> Force Pay
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 bg-zinc-50 p-2 rounded">* "Force Pay" manually approves a transaction. Use only for testing.</p>
                                    </div>
                                )}

                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

const SidebarItem = ({ icon: Icon, label, id, active, onClick }) => (
    <button onClick={() => onClick(id)} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-xs font-bold uppercase transition-all duration-200 ${active === id ? 'bg-white text-black shadow-sm border border-zinc-200 lg:bg-zinc-100 lg:border-transparent lg:shadow-none' : 'text-zinc-500 hover:bg-white hover:text-black border border-transparent'}`}>
        <div className="flex items-center gap-3"><Icon className={active === id ? 'text-black' : 'text-zinc-400'} size={16} />{label}</div>
        <FaChevronRight className="lg:hidden text-zinc-300" size={10} />
    </button>
);

const Checkbox = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-3 cursor-pointer p-3 border border-zinc-200 rounded hover:bg-zinc-50 transition bg-white select-none group">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-black border-black text-white' : 'bg-white border-zinc-300 group-hover:border-zinc-400'}`}>
            {checked && <FaCheck size={10} />}
        </div>
        <span className="text-xs font-bold text-zinc-700 uppercase group-hover:text-black">{label}</span>
        <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
    </label>
);

export default SettingsPage