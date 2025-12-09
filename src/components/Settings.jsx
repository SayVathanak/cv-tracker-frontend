import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from "react-qr-code";
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
    FaUserShield, FaFileExcel, FaCloudUploadAlt,
    FaSave, FaTrash, FaCheck, FaUser, FaCreditCard, FaLock,
    FaTimes, FaArrowLeft, FaChevronRight, FaHistory, FaBolt, FaSync, FaGem
} from 'react-icons/fa';

const MySwal = withReactContent(Swal);

const SettingsPage = ({ onClose, initialSettings, onSave, currentCredits, onPaymentSuccess }) => {
    const [activeTab, setActiveTab] = useState('account');
    const [mobileView, setMobileView] = useState('menu'); // 'menu' | 'detail'
    
    // --- STATE & LOGIC ---
    const [localSettings, setLocalSettings] = useState(initialSettings || {
        autoDelete: false,
        retention: '30',
        exportFields: {
            phone: true, dob: true, address: true,
            gender: true, education: true, experience: true
        },
        autoTags: ""
    });

    const [credits, setCredits] = useState(currentCredits || 0);
    const [qrData, setQrData] = useState(null);
    const [checkInterval, setCheckInterval] = useState(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    const currentUserEmail = initialSettings?.profile?.username;

    // --- EFFECT HOOKS ---
    useEffect(() => {
        if (activeTab === 'billing') fetchUserCredits();
        if (activeTab === 'transactions') fetchTransactions();
    }, [activeTab]);

    useEffect(() => {
        return () => { if (checkInterval) clearInterval(checkInterval); }
    }, [checkInterval]);

    // --- API HANDLERS ---
    const fetchUserCredits = async () => {
        try {
            const token = localStorage.getItem("cv_token");
            const res = await axios.get(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
            setCredits(res.data.current_credits);
        } catch (e) { console.error("Failed to fetch credits:", e); }
    };

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("cv_token");
            const res = await axios.get(`${API_URL}/admin/transactions`, { headers: { Authorization: `Bearer ${token}` } });
            setTransactions(res.data);
        } catch (e) { console.error("Fetch error:", e); } finally { setLoading(false); }
    };

    const handleBuy = async (packageId) => {
        try {
            const res = await axios.post(`${API_URL}/api/create-payment`, { package_id: packageId, email: currentUserEmail });
            setQrData(res.data);
            setPaymentSuccess(false);
            startPolling(res.data.md5);
        } catch (error) {
            MySwal.fire({ icon: 'error', title: 'Connection Error', text: 'Could not generate QR code.' });
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
                MySwal.fire({ icon: 'success', title: 'Force Approved', timer: 1000, showConfirmButton: false });
                fetchTransactions();
                fetchUserCredits();
                if (onPaymentSuccess) onPaymentSuccess();
            }
        } catch (e) { MySwal.fire({ icon: 'error', title: 'Error', text: e.message }); }
    };

    const handleClearHistory = async () => {
        const result = await MySwal.fire({
            title: 'Clear History?', text: "This action cannot be undone.", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#000', confirmButtonText: 'Yes, clear it'
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`${API_URL}/admin/transactions`);
                fetchTransactions();
            } catch (e) { MySwal.fire('Error', 'Failed to clear.', 'error'); }
        }
    };

    const handleToggleField = (field) => {
        setLocalSettings(prev => ({ ...prev, exportFields: { ...prev.exportFields, [field]: !prev.exportFields[field] } }));
    };

    // --- RENDER HELPERS ---
    const getTabTitle = (tab) => {
        const titles = {
            general: 'Privacy & Data',
            account: 'Account Profile',
            parsing: 'Parsing Rules',
            export: 'Excel Configuration',
            billing: 'Billing & Plan',
            transactions: 'Payment History'
        };
        return titles[tab] || 'Settings';
    };

    // --- ANIMATION VARIANTS ---
    const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const modalVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 20 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
        exit: { opacity: 0, scale: 0.95, y: 20 }
    };
    
    // Mobile slide animations
    const slideVariants = {
        enter: (direction) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (direction) => ({ x: direction < 0 ? '100%' : '-100%', opacity: 0 })
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-6 overflow-hidden">
                
                {/* BACKDROP */}
                <motion.div 
                    variants={backdropVariants} 
                    initial="hidden" animate="visible" exit="hidden" 
                    onClick={onClose} 
                    className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" 
                />

                {/* MODAL CONTAINER */}
                <motion.div 
                    variants={modalVariants} 
                    initial="hidden" animate="visible" exit="exit" 
                    className="relative bg-white w-full h-full lg:h-[85vh] lg:max-w-5xl lg:rounded-3xl shadow-2xl flex overflow-hidden"
                >
                    
                    {/* === SIDEBAR (Desktop: Always Visible, Mobile: Slide in) === */}
                    <div className={`${mobileView === 'menu' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-72 bg-zinc-50/80 border-r border-zinc-100 h-full`}>
                        <div className="p-6 pt-8 pb-4 border-b border-zinc-100 flex justify-between items-center bg-white lg:bg-transparent">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Settings</h2>
                                <p className="text-xs font-medium text-zinc-400 mt-1">Workspace preferences</p>
                            </div>
                            <button onClick={onClose} className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-black transition-colors">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        
                        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                            <SidebarItem icon={FaUser} label="Account" id="account" active={activeTab} onClick={(id) => { setActiveTab(id); setMobileView('detail'); }} />
                            <SidebarItem icon={FaUserShield} label="Privacy" id="general" active={activeTab} onClick={(id) => { setActiveTab(id); setMobileView('detail'); }} />
                            <SidebarItem icon={FaCloudUploadAlt} label="Parsing" id="parsing" active={activeTab} onClick={(id) => { setActiveTab(id); setMobileView('detail'); }} />
                            <SidebarItem icon={FaFileExcel} label="Exports" id="export" active={activeTab} onClick={(id) => { setActiveTab(id); setMobileView('detail'); }} />
                            <div className="my-4 border-t border-zinc-200/50 mx-2" />
                            <SidebarItem icon={FaCreditCard} label="Billing" id="billing" active={activeTab} onClick={(id) => { setActiveTab(id); setMobileView('detail'); }} />
                            <SidebarItem icon={FaHistory} label="Payment" id="transactions" active={activeTab} onClick={(id) => { setActiveTab(id); setMobileView('detail'); }} />
                        </nav>
                        
                        <div className="p-4 border-t border-zinc-200/50 hidden lg:block">
                             <button onClick={onClose} className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 rounded-xl transition-all">
                                Close
                             </button>
                        </div>
                    </div>

                    {/* === CONTENT AREA === */}
                    <div className={`${mobileView === 'detail' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col h-full bg-white relative`}>
                        
                        {/* Header */}
                        <div className="h-16 border-b border-zinc-100 flex items-center justify-between px-4 lg:px-8 shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setMobileView('menu')} className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-black">
                                    <FaArrowLeft />
                                </button>
                                <h3 className="text-lg font-bold text-zinc-900">{getTabTitle(activeTab)}</h3>
                            </div>
                            
                            {/* Desktop Close Button */}
                            <button onClick={onClose} className="hidden lg:flex w-8 h-8 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 transition-colors">
                                <FaTimes size={14} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-5 lg:p-10 custom-scrollbar relative">
                             <AnimatePresence mode="wait">
                                <motion.div 
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-w-2xl mx-auto pb-10"
                                >
                                    
                                    {/* --- ACCOUNT --- */}
                                    {activeTab === 'account' && (
                                        <div className="space-y-8">
                                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                                                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-3xl font-bold text-zinc-300 border-4 border-white shadow-lg">
                                                    {localSettings.profile?.displayName?.[0]?.toUpperCase() || "U"}
                                                </div>
                                                <div className="text-center sm:text-left space-y-1">
                                                    <h4 className="text-xl font-bold text-zinc-900">{localSettings.profile?.displayName || "User"}</h4>
                                                    <p className="text-sm font-medium text-zinc-500">{localSettings.profile?.username}</p>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wide mt-2">
                                                        Free Plan
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid gap-5">
                                                <InputGroup label="Display Name" value={localSettings.profile?.displayName} onChange={(v) => setLocalSettings(p => ({...p, profile: {...p.profile, displayName: v}}))} />
                                                <InputGroup label="Organization" value={localSettings.profile?.org} onChange={(v) => setLocalSettings(p => ({...p, profile: {...p.profile, org: v}}))} />
                                            </div>
                                            
                                            <div className="pt-4 flex justify-end">
                                                <SaveButton onClick={() => onSave(localSettings)} />
                                            </div>
                                        </div>
                                    )}

                                    {/* --- PRIVACY --- */}
                                    {activeTab === 'general' && (
                                        <div className="space-y-6">
                                            <div className={`group p-6 rounded-2xl border transition-all duration-300 ${localSettings.autoDelete ? 'bg-green-50/50 border-green-200' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}>
                                                <div className="flex justify-between items-center mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${localSettings.autoDelete ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-400'}`}>
                                                            <FaUserShield size={18} />
                                                        </div>
                                                        <span className={`font-bold text-sm uppercase tracking-wide ${localSettings.autoDelete ? 'text-green-800' : 'text-zinc-600'}`}>Auto-Delete Mode</span>
                                                    </div>
                                                    <Toggle checked={localSettings.autoDelete} onChange={() => setLocalSettings(p => ({...p, autoDelete: !p.autoDelete}))} />
                                                </div>
                                                <p className="text-sm text-zinc-500 leading-relaxed ml-12">
                                                    Automatically permanently delete original PDF resumes <strong className="text-zinc-900">24 hours</strong> after they are uploaded. Parsed data will be retained.
                                                </p>
                                            </div>
                                            <div className="pt-4 flex justify-end">
                                                <SaveButton onClick={() => onSave(localSettings)} />
                                            </div>
                                        </div>
                                    )}

                                    {/* --- EXPORT --- */}
                                    {activeTab === 'export' && (
                                        <div className="space-y-6">
                                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-blue-800 text-sm mb-6 flex gap-3">
                                                <FaFileExcel className="shrink-0 mt-0.5" />
                                                <p>Customize columns for your Excel downloads. Unchecked fields will be excluded to keep your reports clean.</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {Object.entries({
                                                    phone: 'Phone Number', dob: 'Date of Birth', address: 'Full Address',
                                                    gender: 'Gender', education: 'Education', experience: 'Experience'
                                                }).map(([key, label]) => (
                                                    <Checkbox key={key} label={label} checked={localSettings.exportFields[key]} onChange={() => handleToggleField(key)} />
                                                ))}
                                            </div>
                                            <div className="pt-4 flex justify-end">
                                                <SaveButton onClick={() => onSave(localSettings)} />
                                            </div>
                                        </div>
                                    )}

                                    {/* --- PARSING --- */}
                                    {activeTab === 'parsing' && (
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Auto-Highlight Keywords</label>
                                                <textarea 
                                                    className="w-full bg-white border border-zinc-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all shadow-sm placeholder:text-zinc-300" 
                                                    rows="5" 
                                                    value={localSettings.autoTags} 
                                                    onChange={(e) => setLocalSettings({ ...localSettings, autoTags: e.target.value })} 
                                                    placeholder="Enter keywords separated by commas (e.g. Sales, React, Manager)..." 
                                                />
                                            </div>
                                            <div className="pt-4 flex justify-end">
                                                <SaveButton onClick={() => onSave(localSettings)} />
                                            </div>
                                        </div>
                                    )}

                                    {/* --- BILLING --- */}
                                    {activeTab === 'billing' && (
                                        <div className="space-y-8">
                                            {/* Credit Card UI */}
                                            <div className="relative overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-2xl p-6 sm:p-8">
                                                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
                                                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
                                                
                                                <div className="relative z-10 flex justify-between items-start">
                                                    <div>
                                                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Available Balance</h4>
                                                        <div className="text-5xl font-bold tracking-tight">{credits}</div>
                                                        <div className="mt-2 text-xs font-medium text-zinc-500">Credits</div>
                                                    </div>
                                                    <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                                                        <FaGem className="text-blue-400" size={24} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Payment UI */}
                                            {qrData && !paymentSuccess ? (
                                                <div className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col items-center text-center shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                    <div className="mb-4 bg-white p-2 rounded-xl shadow-sm border border-zinc-100">
                                                        <QRCode value={qrData.qr_code} size={160} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-2xl font-bold text-zinc-900">${qrData.amount}</p>
                                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Scan to Pay</p>
                                                    </div>
                                                    <div className="mt-6 flex gap-3 w-full">
                                                        <button onClick={() => { setQrData(null); clearInterval(checkInterval); }} className="flex-1 py-2 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 transition">Cancel</button>
                                                        <button className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 flex items-center justify-center gap-2 animate-pulse cursor-default">
                                                            <FaSync className="animate-spin" /> Checking...
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <PricingCard 
                                                        title="Starter" 
                                                        price="$1.00" 
                                                        credits="20" 
                                                        icon={<FaUser className="text-zinc-400" />}
                                                        onClick={() => handleBuy('small')} 
                                                    />
                                                    <PricingCard 
                                                        title="Agency Pro" 
                                                        price="$5.00" 
                                                        credits="150" 
                                                        popular
                                                        icon={<FaUserShield className="text-white" />}
                                                        onClick={() => handleBuy('pro')} 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* --- TRANSACTIONS --- */}
                                    {activeTab === 'transactions' && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="text-xs font-bold uppercase text-zinc-400">History Log</p>
                                                <div className="flex gap-2">
                                                    <button onClick={fetchTransactions} className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><FaSync size={12} /></button>
                                                    <button onClick={handleClearHistory} className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FaTrash size={12} /></button>
                                                </div>
                                            </div>

                                            {loading ? (
                                                <div className="py-10 text-center text-zinc-400 text-xs animate-pulse">Loading records...</div>
                                            ) : transactions.length === 0 ? (
                                                <div className="py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-center">
                                                    <p className="text-sm text-zinc-400">No transaction history found.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {transactions.map((tx) => (
                                                        <div key={tx.id} className="group bg-white border border-zinc-100 hover:border-zinc-300 rounded-xl p-4 flex items-center justify-between transition-all hover:shadow-sm">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                                                    tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                                    tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-zinc-100 text-zinc-500'
                                                                }`}>
                                                                    {tx.status === 'COMPLETED' ? <FaCheck /> : tx.status === 'PENDING' ? '...' : <FaTimes />}
                                                                </div>
                                                                <div>
                                                                    <div className="font-mono text-xs text-zinc-500">{tx.payment_ref}</div>
                                                                    <div className="text-sm font-bold text-zinc-900">${tx.amount}</div>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="text-right">
                                                                {tx.status === 'PENDING' && tx.md5_hash ? (
                                                                     <button 
                                                                        onClick={() => handleForceApprove(tx.md5_hash)}
                                                                        className="flex items-center gap-1 px-3 py-1 bg-zinc-900 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-black transition"
                                                                     >
                                                                         <FaBolt /> Dev Skip
                                                                     </button>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold uppercase text-zinc-300">{tx.status}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </motion.div>
                             </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// --- SUB COMPONENTS ---

const SidebarItem = ({ icon: Icon, label, id, active, onClick }) => (
    <button 
        onClick={() => onClick(id)} 
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 group ${
            active === id 
            ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' 
            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
        }`}
    >
        <div className="flex items-center gap-3">
            <Icon className={`transition-colors ${active === id ? 'text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-600'}`} size={14} />
            {label}
        </div>
        <FaChevronRight className={`text-zinc-300 transition-transform ${active === id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'}`} size={10} />
    </button>
);

const InputGroup = ({ label, value, onChange }) => (
    <div>
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">{label}</label>
        <input 
            type="text" 
            value={value || ""} 
            onChange={(e) => onChange(e.target.value)} 
            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 focus:ring-2 focus:ring-zinc-100 focus:border-zinc-400 outline-none transition-all placeholder:text-zinc-300" 
        />
    </div>
);

const PricingCard = ({ title, price, credits, icon, onClick, popular }) => (
    <div 
        onClick={onClick}
        className={`relative group cursor-pointer rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
            popular 
            ? 'bg-zinc-900 text-white border-zinc-900 shadow-xl' 
            : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-400 hover:shadow-md'
        }`}
    >
        {popular && (
            <div className="absolute top-0 right-0 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-[9px] font-bold uppercase px-2 py-1 rounded-bl-xl rounded-tr-xl">
                Best Value
            </div>
        )}
        <div className="flex justify-between items-start mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${popular ? 'bg-white/10' : 'bg-zinc-100'}`}>
                {icon}
            </div>
            <div className="text-right">
                <span className={`block text-xl font-bold ${popular ? 'text-white' : 'text-zinc-900'}`}>{price}</span>
            </div>
        </div>
        <div>
            <h4 className={`font-bold text-sm ${popular ? 'text-white' : 'text-zinc-900'}`}>{title}</h4>
            <p className={`text-xs mt-1 ${popular ? 'text-zinc-400' : 'text-zinc-500'}`}>{credits} Credits</p>
        </div>
    </div>
);

const Checkbox = ({ label, checked, onChange }) => (
    <label className={`flex items-center gap-3 cursor-pointer p-3.5 border rounded-xl transition-all select-none group ${checked ? 'bg-black border-black text-white shadow-md' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}>
        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${checked ? 'bg-white border-transparent' : 'bg-zinc-100 border-zinc-300'}`}>
            {checked && <FaCheck size={8} className="text-black" />}
        </div>
        <span className={`text-xs font-bold uppercase ${checked ? 'text-white' : 'text-zinc-600 group-hover:text-black'}`}>{label}</span>
        <input type="checkbox" className="hidden" checked={checked} onChange={onChange} />
    </label>
);

const Toggle = ({ checked, onChange }) => (
    <button 
        onClick={onChange} 
        className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${checked ? 'bg-green-500' : 'bg-zinc-200'}`}
    >
        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
);

const SaveButton = ({ onClick }) => (
    <button 
        onClick={onClick} 
        className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95"
    >
        <FaSave /> Save Changes
    </button>
);

export default SettingsPage;