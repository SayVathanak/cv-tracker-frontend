import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from "react-qr-code";
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
    FaUserShield, FaFileExcel, FaCloudUploadAlt,
    FaSave, FaTrash, FaCheck, FaUser, FaCreditCard,
    FaTimes, FaArrowLeft, FaChevronRight, FaHistory, FaBolt, FaSync, FaSpinner, FaFileUpload, FaUserTie, FaBuilding, FaCrown
} from 'react-icons/fa';

const MySwal = withReactContent(Swal);

const SettingsPage = ({ onClose, initialSettings, onSave, currentCredits, onPaymentSuccess }) => {
    const [activeTab, setActiveTab] = useState('account');
    const [mobileView, setMobileView] = useState('menu');

    // --- STATE ---
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

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    // --- UPLOAD STATE ---
    const [uploadingId, setUploadingId] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const selectedTxRef = useRef(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
    const currentUserEmail = initialSettings?.profile?.username;

    // --- EFFECTS ---
    useEffect(() => {
        if (activeTab === 'billing') fetchUserCredits();
        if (activeTab === 'transactions') fetchTransactions();
    }, [activeTab]);

    // --- API CALLS ---
    const fetchUserCredits = async () => {
        try {
            const token = localStorage.getItem("cv_token");
            const res = await axios.get(`${API_URL}/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCredits(res.data.current_credits);
            if (res.data.settings && Object.keys(res.data.settings).length > 0) {
                setLocalSettings(prev => ({
                    ...prev,
                    ...res.data.settings,
                    profile: { ...prev.profile, ...res.data.settings.profile, username: res.data.username }
                }));
            }
        } catch (e) { console.error("Failed to fetch user data:", e); }
    };

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("cv_token");
            const res = await axios.get(`${API_URL}/admin/transactions`, { headers: { Authorization: `Bearer ${token}` } });

            // --- FIX 1: FILTER GHOST LOGS ---
            // We only show transactions that have proof (VERIFYING), are done (COMPLETED), or REJECTED.
            // PENDING ones (just clicking the package) are hidden.
            const cleanList = res.data.filter(tx =>
                tx.status === 'VERIFYING' ||
                tx.status === 'COMPLETED' ||
                tx.status === 'REJECTED'
            );
            setTransactions(cleanList);

        } catch (e) { console.error("Fetch error:", e); } finally { setLoading(false); }
    };

    // --- UPLOAD LOGIC ---

    const handleHistoryUploadClick = (tx) => {
        selectedTxRef.current = { md5_hash: tx.md5_hash, id: tx.id, source: 'history' };
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleBillingUploadClick = () => {
        if (!qrData) return;
        selectedTxRef.current = { md5_hash: qrData.md5, source: 'billing' };
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        const txContext = selectedTxRef.current;

        if (!file || !txContext) return;

        if (file.size > 5 * 1024 * 1024) {
            MySwal.fire('Error', 'File size must be less than 5MB', 'error');
            return;
        }

        if (txContext.source === 'history') setUploadingId(txContext.id);
        else setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem("cv_token");
            await axios.post(`${API_URL}/api/submit-payment-proof?md5_hash=${txContext.md5_hash}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            MySwal.fire({
                icon: 'success',
                title: 'Proof Sent!',
                text: 'We are verifying your transaction.',
                timer: 2000,
                showConfirmButton: false
            });

            if (txContext.source === 'billing') {
                setQrData(null);
                setActiveTab('transactions');
            } else {
                fetchTransactions();
            }

        } catch (err) {
            console.error(err);
            MySwal.fire('Error', 'Failed to upload proof.', 'error');
        } finally {
            setUploadingId(null);
            setIsUploading(false);
            selectedTxRef.current = null;
            e.target.value = '';
        }
    };

    // --- PAYMENT LOGIC ---
    const handleBuy = async (packageId) => {
        try {
            const res = await axios.post(`${API_URL}/api/create-payment`, { package_id: packageId, email: currentUserEmail });
            setQrData(res.data);
        } catch (error) {
            MySwal.fire({ icon: 'error', title: 'Connection Error', text: 'Could not generate QR code.' });
        }
    };

    // --- SETTINGS LOGIC ---

    // REMOVED: handleClearHistory (To protect Revenue Data)

    const handleToggleField = (field) => {
        setLocalSettings(prev => ({ ...prev, exportFields: { ...prev.exportFields, [field]: !prev.exportFields[field] } }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("cv_token");
            await axios.put(`${API_URL}/users/settings`, localSettings, { headers: { Authorization: `Bearer ${token}` } });
            localStorage.setItem('cv_app_settings', JSON.stringify(localSettings));
            MySwal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
            if (onSave) onSave(localSettings);
        } catch (error) {
            MySwal.fire({ icon: 'error', title: 'Save Failed', text: 'Could not sync with server.' });
        } finally { setLoading(false); }
    };

    const getTabTitle = (tab) => {
        const titles = { general: 'Privacy & Data', account: 'Account Profile', parsing: 'Parsing Rules', export: 'Excel Configuration', billing: 'Billing & Plan', transactions: 'Payment History' };
        return titles[tab] || 'Settings';
    };

    const statusBadge = credits > 0
        ? { label: 'Active', style: 'bg-green-50 text-green-600 border-green-100' }
        : { label: 'Zero Balance', style: 'bg-zinc-100 text-zinc-500 border-zinc-200' };

    const backdropVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    const modalVariants = { hidden: { opacity: 0, scale: 0.95, y: 20 }, visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } }, exit: { opacity: 0, scale: 0.95, y: 20 } };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-0 lg:p-6 overflow-hidden">
                <motion.div variants={backdropVariants} initial="hidden" animate="visible" exit="hidden" onClick={onClose} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />

                <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit" className="relative bg-white w-full h-full lg:h-[85vh] lg:max-w-5xl lg:rounded-3xl shadow-2xl flex overflow-hidden">

                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

                    {/* SIDEBAR */}
                    <div className={`${mobileView === 'menu' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-72 bg-zinc-50/80 border-r border-zinc-100 h-full`}>
                        <div className="p-6 pt-8 pb-4 border-b border-zinc-100 flex justify-between items-center bg-white lg:bg-transparent">
                            <div><h2 className="text-2xl font-bold tracking-tight text-zinc-900">Settings</h2><p className="text-xs font-medium text-zinc-400 mt-1">Workspace preferences</p></div>
                            <button onClick={onClose} className="lg:hidden p-2 -mr-2 text-zinc-400 hover:text-black"><FaTimes size={20} /></button>
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
                            <button onClick={onClose} className="w-full py-2.5 text-xs font-bold uppercase text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 rounded-xl transition-all">Close</button>
                        </div>
                    </div>

                    {/* CONTENT AREA */}
                    <div className={`${mobileView === 'detail' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col h-full bg-white relative`}>
                        <div className="h-16 border-b border-zinc-100 flex items-center justify-between px-4 lg:px-8 shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setMobileView('menu')} className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-black"><FaArrowLeft /></button>
                                <h3 className="text-lg font-bold text-zinc-900">{getTabTitle(activeTab)}</h3>
                            </div>
                            <button onClick={onClose} className="hidden lg:flex w-8 h-8 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 transition-colors"><FaTimes size={14} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 lg:p-10 custom-scrollbar relative">
                            <AnimatePresence mode="wait">
                                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="max-w-2xl mx-auto pb-10">

                                    {activeTab === 'account' && (
                                        <div className="space-y-8">
                                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                                                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-3xl font-bold text-zinc-300 border-4 border-white shadow-lg">
                                                    {localSettings.profile?.displayName?.[0]?.toUpperCase() || "U"}
                                                </div>
                                                <div className="text-center sm:text-left space-y-1">
                                                    <h4 className="text-xl font-bold text-zinc-900">{localSettings.profile?.displayName || "User"}</h4>
                                                    <p className="text-sm font-medium text-zinc-500">{localSettings.profile?.username}</p>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide mt-2 border ${statusBadge.style}`}>{statusBadge.label}</span>
                                                </div>
                                            </div>
                                            <div className="grid gap-5">
                                                <InputGroup label="Display Name" value={localSettings.profile?.displayName} onChange={(v) => setLocalSettings(p => ({ ...p, profile: { ...p.profile, displayName: v } }))} />
                                                <InputGroup label="Organization" value={localSettings.profile?.org} onChange={(v) => setLocalSettings(p => ({ ...p, profile: { ...p.profile, org: v } }))} />
                                            </div>
                                            <div className="pt-4 flex justify-end"><SaveButton onClick={handleSave} /></div>
                                        </div>
                                    )}

                                    {activeTab === 'general' && (
                                        <div className="space-y-6">
                                            <div className={`group p-6 rounded-2xl border transition-all duration-300 ${localSettings.autoDelete ? 'bg-green-50/50 border-green-200' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}>
                                                <div className="flex justify-between items-center mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${localSettings.autoDelete ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-400'}`}><FaUserShield size={18} /></div>
                                                        <span className={`font-bold text-sm uppercase tracking-wide ${localSettings.autoDelete ? 'text-green-800' : 'text-zinc-600'}`}>Auto-Delete Mode</span>
                                                    </div>
                                                    <Toggle checked={localSettings.autoDelete} onChange={() => setLocalSettings(p => ({ ...p, autoDelete: !p.autoDelete }))} />
                                                </div>
                                                <p className="text-sm text-zinc-500 leading-relaxed ml-12">Automatically permanently delete original PDF resumes <strong className="text-zinc-900">24 hours</strong> after upload.</p>
                                            </div>
                                            <div className="pt-4 flex justify-end"><SaveButton onClick={handleSave} /></div>
                                        </div>
                                    )}

                                    {activeTab === 'export' && (
                                        <div className="space-y-6">
                                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-blue-800 text-sm mb-6 flex gap-3"><FaFileExcel className="shrink-0 mt-0.5" /><p>Customize columns for your Excel downloads.</p></div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {Object.entries({ phone: 'Phone Number', dob: 'Date of Birth', address: 'Full Address', gender: 'Gender', education: 'Education', experience: 'Experience' }).map(([key, label]) => (
                                                    <Checkbox key={key} label={label} checked={localSettings.exportFields[key]} onChange={() => handleToggleField(key)} />
                                                ))}
                                            </div>
                                            <div className="pt-4 flex justify-end"><SaveButton onClick={handleSave} /></div>
                                        </div>
                                    )}

                                    {activeTab === 'parsing' && (
                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 ml-1">Auto-Highlight Keywords</label>
                                                <textarea className="w-full bg-white border border-zinc-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-black/5 focus:border-black outline-none transition-all shadow-sm placeholder:text-zinc-300" rows="5" value={localSettings.autoTags} onChange={(e) => setLocalSettings({ ...localSettings, autoTags: e.target.value })} placeholder="Enter keywords separated by commas..." />
                                            </div>
                                            <div className="pt-4 flex justify-end"><SaveButton onClick={handleSave} /></div>
                                        </div>
                                    )}

                                    {/* --- BILLING --- */}
                                    {activeTab === 'billing' && (
                                        <div className="space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">

                                            {/* Balance Card */}
                                            <div className="relative overflow-hidden rounded-2xl bg-zinc-900 text-white p-4 sm:p-6 shadow-xl border border-zinc-800 group">
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-16 -mt-32 transition-all duration-700 group-hover:bg-blue-600/30 pointer-events-none" />
                                                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
                                                    <div>
                                                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-1">Current Balance</h4>
                                                        <div className="flex items-baseline gap-2">
                                                            {/* Responsive Text Size */}
                                                            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{credits}</span>
                                                            <span className="text-sm font-medium text-zinc-500">credits</span>
                                                        </div>
                                                    </div>

                                                    {/* Actions: Full width on mobile, auto on desktop */}
                                                    <div className="flex w-full sm:w-auto gap-2 sm:gap-3">
                                                        <button onClick={() => setActiveTab('transactions')} className="flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold transition flex items-center gap-2">
                                                            <FaHistory /> History
                                                        </button>
                                                        <div className="hidden sm:flex px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold items-center gap-2">
                                                            <FaCheck size={10} /> Active
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {qrData ? (
                                                <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-lg flex flex-col-reverse md:flex-row">

                                                    {/* Left Side (Instructions) */}
                                                    <div className="w-full md:w-1/2 p-5 sm:p-6 flex flex-col justify-center bg-zinc-50 border-t md:border-t-0 md:border-r border-zinc-100 relative">
                                                        <div className="hidden md:block absolute top-0 left-0 w-1 h-full bg-blue-500 animate-pulse" />
                                                        <div className="mb-6 mt-2">
                                                            <h3 className="text-lg sm:text-xl font-bold text-zinc-900">Scan to Pay</h3>
                                                            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                                                                1. Scan QR with your banking app.<br />
                                                                2. Save the receipt.<br />
                                                                3. Upload it here to confirm.
                                                            </p>
                                                        </div>

                                                        <div className="mb-6 flex justify-between items-center md:block">
                                                            <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Total Amount</div>
                                                            <div className="text-3xl sm:text-4xl font-bold text-blue-600">${qrData.amount}</div>
                                                        </div>

                                                        <div className="space-y-3 mt-auto">
                                                            <button
                                                                onClick={handleBillingUploadClick}
                                                                disabled={isUploading}
                                                                className="w-full py-3 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                                                            >
                                                                {isUploading ? <FaSpinner className="animate-spin" /> : <FaFileUpload />}
                                                                {isUploading ? "Uploading..." : "Upload Payment Proof"}
                                                            </button>
                                                            <button onClick={() => setQrData(null)} className="w-full py-3 rounded-xl text-xs font-bold text-zinc-500 hover:bg-white border border-transparent hover:border-zinc-200 transition-colors">
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Right Side (QR Code) */}
                                                    <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 bg-white">
                                                        <div className="p-3 border-2 border-zinc-100 rounded-2xl shadow-sm bg-white">
                                                            {/* Responsive QR Size */}
                                                            <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px]">
                                                                <QRCode
                                                                    value={qrData.qr_code}
                                                                    size={256}
                                                                    style={{ height: "100%", width: "100%" }}
                                                                    viewBox={`0 0 256 256`}
                                                                />
                                                            </div>
                                                        </div>
                                                        <p className="md:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-4">Scan with Banking App</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Responsive Grid: 1 col mobile, 3 cols desktop */
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <PricingCard title="Mini" price="$0.25" credits="15" perCredit="$0.016" description="Quick try." icon={<FaUserTie className="text-zinc-400" />} onClick={() => handleBuy('mini')} />
                                                    <PricingCard title="Standard" price="$1.50" credits="100" perCredit="$0.015" description="Active job hunters." icon={<FaBuilding className="text-blue-400" />} onClick={() => handleBuy('standard')} />
                                                    <PricingCard title="Max" price="$5.00" credits="400" popular perCredit="$0.012" savings="Best Value" description="High volume." icon={<FaCrown className="text-yellow-300" />} onClick={() => handleBuy('max')} />
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
                                                    <button onClick={fetchTransactions} className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Refresh"><FaSync size={12} /></button>
                                                    {/* Removed Delete Button to protect Revenue Data */}
                                                </div>
                                            </div>

                                            {loading ? <div className="py-10 text-center text-zinc-400 text-xs animate-pulse">Loading records...</div> :
                                                transactions.length === 0 ? <div className="py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-center"><p className="text-sm text-zinc-400">No approved transaction history found.</p></div> :
                                                    (
                                                        <div className="space-y-2">
                                                            {transactions.map((tx) => (
                                                                <div key={tx.id} className="group bg-white border border-zinc-100 hover:border-zinc-300 rounded-xl p-4 flex items-center justify-between transition-all hover:shadow-sm">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                                            tx.status === 'VERIFYING' ? 'bg-blue-100 text-blue-700' :
                                                                                tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-500'
                                                                            }`}>
                                                                            {tx.status === 'COMPLETED' ? <FaCheck /> : tx.status === 'VERIFYING' ? <FaUserShield /> : tx.status === 'REJECTED' ? <FaTimes /> : '...'}
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-mono text-xs text-zinc-500">{tx.payment_ref || "No Ref"}</div>
                                                                            {/* --- FIX 2: CORRECT PRICE DISPLAY --- */}
                                                                            <div className="text-sm font-bold text-zinc-900">
                                                                                ${tx.price ? tx.price : (tx.amount === 20 ? "1.00" : tx.amount === 150 ? "5.00" : "0.00")}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="text-right">
                                                                        {tx.status === 'VERIFYING' ? (
                                                                            <span className="text-[10px] font-bold uppercase text-blue-500 bg-blue-50 px-2 py-1 rounded">In Review</span>
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

// ... (Sub-components remain unchanged)
const SidebarItem = ({ icon: Icon, label, id, active, onClick }) => (
    <button onClick={() => onClick(id)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-200 group ${active === id ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}>
        <div className="flex items-center gap-3"><Icon className={`transition-colors ${active === id ? 'text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-600'}`} size={14} />{label}</div>
        <FaChevronRight className={`text-zinc-300 transition-transform ${active === id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'}`} size={10} />
    </button>
);

const InputGroup = ({ label, value, onChange }) => (
    <div><label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 ml-1">{label}</label><input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 focus:ring-2 focus:ring-zinc-100 focus:border-zinc-400 outline-none transition-all placeholder:text-zinc-300" /></div>
);

const PricingCard = ({ title, price, credits, perCredit, savings, description, icon, onClick, popular }) => (
    <div onClick={onClick} className={`relative group cursor-pointer rounded-2xl p-4 sm:p-5 border transition-all duration-200 active:scale-[0.98] ${popular ? 'bg-zinc-900 text-white border-zinc-900 shadow-xl shadow-zinc-200' : 'bg-white text-zinc-900 border-zinc-200 hover:border-blue-400 sm:hover:shadow-lg sm:hover:shadow-blue-50'}`}>
        {(popular || savings) && <div className={`absolute top-0 right-0 text-[8px] sm:text-[9px] font-bold uppercase px-2 sm:px-3 py-1 rounded-bl-xl rounded-tr-xl ${popular ? 'bg-linear-to-r from-yellow-400 to-yellow-600 text-zinc-900' : 'bg-green-100 text-green-700'}`}>{savings || "Most Popular"}</div>}
        <div className="flex justify-between items-start mb-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${popular ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-900'}`}>{icon}</div><div className="text-right"><span className={`block text-xl font-bold ${popular ? 'text-white' : 'text-zinc-900'}`}>{price}</span><span className={`text-[9px] sm:text-[10px] font-medium opacity-60`}>One-time</span></div></div>
        <div className="space-y-1 mb-4"><h4 className={`text-base font-bold ${popular ? 'text-white' : 'text-zinc-900'}`}>{title}</h4><p className={`text-[10px] sm:text-[11px] ${popular ? 'text-zinc-400' : 'text-zinc-500'}`}>{description}</p></div>
        <div className={`pt-4 border-t flex justify-between items-center ${popular ? 'border-white/10' : 'border-zinc-100'}`}><div className="flex flex-col"><span className={`text-sm font-bold ${popular ? 'text-yellow-400' : 'text-zinc-900'}`}>{credits} Credits</span><span className="text-[9px] opacity-50">{perCredit}</span></div><button className={`h-6 w-6 rounded-full flex items-center justify-center transition-colors ${popular ? 'bg-white text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800'}`}><FaChevronRight size={8} /></button></div>
    </div>
);

const Checkbox = ({ label, checked, onChange }) => (
    <label className={`flex items-center gap-3 cursor-pointer p-3.5 border rounded-xl transition-all select-none group ${checked ? 'bg-black border-black text-white shadow-md' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}><div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${checked ? 'bg-white border-transparent' : 'bg-zinc-100 border-zinc-300'}`}>{checked && <FaCheck size={8} className="text-black" />}</div><span className={`text-xs font-bold uppercase ${checked ? 'text-white' : 'text-zinc-600 group-hover:text-black'}`}>{label}</span><input type="checkbox" className="hidden" checked={checked} onChange={onChange} /></label>
);

const Toggle = ({ checked, onChange }) => (
    <button onClick={onChange} className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none ${checked ? 'bg-green-500' : 'bg-zinc-200'}`}><span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} /></button>
);

const SaveButton = ({ onClick }) => (
    <button onClick={onClick} className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95"><FaSave /> Save Changes</button>
);

export default SettingsPage;