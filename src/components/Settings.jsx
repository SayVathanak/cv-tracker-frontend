import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    FaUserShield, FaFileExcel, FaCloudUploadAlt,
    FaSave, FaTrash, FaCheck, FaUser, FaCreditCard, FaLock
} from 'react-icons/fa'

const SettingsPage = ({ onClose, initialSettings, onSave }) => {
    const [activeTab, setActiveTab] = useState('general'); // Default tab

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

    // Toggle Handler
    const handleToggleField = (field) => {
        setLocalSettings(prev => ({
            ...prev,
            exportFields: {
                ...prev.exportFields,
                [field]: !prev.exportFields[field]
            }
        }));
    };

    return (
        <div className="fixed inset-0 z-100 bg-black/20 backdrop-blur-sm flex justify-center items-center p-4 lg:p-10 select-none">

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-4xl h-full max-h-[700px] rounded-xl shadow-2xl flex overflow-hidden border border-zinc-200"
            >

                {/* LEFT SIDEBAR */}
                <div className="w-64 bg-zinc-50 border-r border-zinc-200 flex flex-col">
                    <div className="p-6 border-b border-zinc-200">
                        <h2 className="text-xl font-bold tracking-tight text-black">Settings</h2>
                        <p className="text-xs text-zinc-400 mt-1">Manage your workspace</p>
                    </div>

                    <nav className="flex-1 p-4 space-y-1">
                        <SidebarItem icon={FaUser} label="Account" id="account" active={activeTab} onClick={setActiveTab} />
                        <SidebarItem icon={FaUserShield} label="Privacy & Data" id="general" active={activeTab} onClick={setActiveTab} />
                        <SidebarItem icon={FaCloudUploadAlt} label="Parsing Rules" id="parsing" active={activeTab} onClick={setActiveTab} />
                        <SidebarItem icon={FaFileExcel} label="Excel Exports" id="export" active={activeTab} onClick={setActiveTab} />
                        <SidebarItem icon={FaCreditCard} label="Billing & Usage" id="billing" active={activeTab} onClick={setActiveTab} />
                    </nav>

                    <div className="p-4 border-t border-zinc-200">
                        <button onClick={onClose} className="w-full py-2 text-xs font-bold uppercase text-zinc-500 hover:text-black border border-zinc-200 rounded bg-white hover:bg-zinc-50 transition">
                            Close
                        </button>
                    </div>
                </div>

                {/* RIGHT CONTENT AREA */}
                <div className="flex-1 flex flex-col bg-white">

                    {/* HEADER */}
                    <div className="h-16 border-b border-zinc-100 flex items-center px-8 justify-between">
                        <h3 className="text-lg font-bold capitalize text-zinc-800">
                            {activeTab === 'general' ? 'Privacy Configuration' : `${activeTab.replace('-', ' ')}`}
                        </h3>
                        <button
                            onClick={() => onSave(localSettings)}
                            className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded text-xs font-bold uppercase hover:bg-zinc-800 transition shadow-lg"
                        >
                            <FaSave /> Save Changes
                        </button>
                    </div>

                    {/* SCROLLABLE CONTENT */}
                    <div className="flex-1 overflow-y-auto p-8">

                        {/* --- TAB: ACCOUNT --- */}
                        {activeTab === 'account' && (
                            <div className="space-y-6 max-w-lg">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-2xl font-bold text-zinc-400 border border-zinc-200">
                                        {localSettings.profile?.displayName ? localSettings.profile.displayName.charAt(0).toUpperCase() : "A"}
                                    </div>
                                    <div>
                                        {/* Shows Display Name if set, otherwise falls back to System Username */}
                                        <h4 className="font-bold text-black">
                                            {localSettings.profile?.displayName || localSettings.profile?.username}
                                        </h4>
                                        <p className="text-xs text-zinc-500">
                                            {localSettings.profile?.org || "My Organization"} • Free Plan
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">

                                    {/* 1. SYSTEM USERNAME (LOCKED) - Crucial for MongoDB Link */}
                                    <div>
                                        <div className="flex justify-between">
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Username (System ID)</label>
                                            <span className="text-[10px] text-zinc-400 flex items-center gap-1"><FaLock size={8} /> Locked</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={localSettings.profile?.username || ""}
                                            disabled // <--- THIS KEEPS IT SAFE
                                            className="w-full bg-zinc-50 border border-zinc-200 rounded p-2 text-sm text-zinc-500 font-mono cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-zinc-400 mt-1">Used to identify your uploaded files.</p>
                                    </div>

                                    {/* 2. DISPLAY NAME (EDITABLE) - Cosmetic Only */}
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Display Name</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. John Doe"
                                            value={localSettings.profile?.displayName || ""}
                                            onChange={(e) => setLocalSettings({
                                                ...localSettings,
                                                profile: { ...localSettings.profile, displayName: e.target.value }
                                            })}
                                            className="w-full bg-white border border-zinc-300 rounded p-2 text-sm font-semibold text-black focus:border-black outline-none"
                                        />
                                    </div>

                                    {/* 3. ORGANIZATION (EDITABLE) */}
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Organization Name</label>
                                        <input
                                            type="text"
                                            value={localSettings.profile?.org || ""}
                                            onChange={(e) => setLocalSettings({
                                                ...localSettings,
                                                profile: { ...localSettings.profile, org: e.target.value }
                                            })}
                                            className="w-full bg-white border border-zinc-300 rounded p-2 text-sm font-semibold text-black focus:border-black outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: PRIVACY (Functional) --- */}
                        {activeTab === 'general' && (
                            <div className="space-y-6 max-w-lg">
                                <div className={`p-4 rounded-lg border transition-all duration-300 ${localSettings.autoDelete ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <FaUserShield className={localSettings.autoDelete ? "text-green-600" : "text-zinc-400"} size={16} />
                                            <h4 className={`text-sm font-bold uppercase ${localSettings.autoDelete ? "text-green-800" : "text-zinc-500"}`}>
                                                Auto-Delete Files
                                            </h4>
                                        </div>
                                        <button
                                            onClick={() => setLocalSettings({ ...localSettings, autoDelete: !localSettings.autoDelete })}
                                            className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${localSettings.autoDelete ? 'bg-green-500' : 'bg-zinc-300'}`}
                                        >
                                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${localSettings.autoDelete ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                        When enabled, original PDF files will be automatically marked for deletion <strong>24 hours</strong> after upload.
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-zinc-100">
                                    <button className="flex items-center gap-2 text-xs text-red-600 font-bold uppercase border border-red-200 bg-white px-4 py-3 rounded hover:bg-red-50 w-full justify-center transition">
                                        <FaTrash /> Clear Local Cache
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: EXCEL EXPORT (Functional) --- */}
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

                        {/* --- TAB: PARSING (Functional) --- */}
                        {activeTab === 'parsing' && (
                            <div className="space-y-6 max-w-lg">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                                        Target Keywords
                                    </label>
                                    <textarea
                                        className="w-full border border-zinc-300 rounded p-3 text-sm focus:ring-1 focus:ring-black outline-none bg-white text-black font-medium"
                                        rows="3"
                                        value={localSettings.autoTags}
                                        onChange={(e) => setLocalSettings({ ...localSettings, autoTags: e.target.value })}
                                        placeholder="e.g. Sales, Barista, Kitchen Hand, Baker"
                                    />
                                    <p className="text-[10px] text-zinc-400 mt-2 font-medium">Keywords used for auto-highlighting (Coming Soon).</p>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: BILLING (Visual Only) --- */}
                        {activeTab === 'billing' && (
                            <div className="space-y-8 max-w-lg">
                                {/* Credit Card Box */}
                                <div className="bg-linear-to-br from-zinc-900 to-zinc-800 text-white p-6 rounded-xl shadow-xl relative overflow-hidden border border-zinc-700">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <FaCreditCard size={120} />
                                    </div>
                                    <div className="relative z-10">
                                        <h4 className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Current Plan</h4>
                                        <div className="text-2xl font-bold mb-6">Free Starter</div>

                                        <div className="flex justify-between items-end">
                                            <div>
                                                <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">Monthly Credits</div>
                                                <div className="text-sm font-bold">125 / 500 Used</div>
                                            </div>
                                            <button className="bg-white text-black px-3 py-1.5 rounded text-[10px] font-bold uppercase hover:bg-zinc-200 transition">
                                                Upgrade
                                            </button>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden mt-3">
                                            <div className="bg-green-400 h-full w-[25%] shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                                        </div>
                                    </div>
                                </div>

                                {/* History Table */}
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                                        Billing History
                                    </label>
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="text-[10px] text-zinc-400 uppercase border-b border-zinc-100">
                                            <tr>
                                                <th className="py-2 font-bold">Date</th>
                                                <th className="py-2 font-bold">Item</th>
                                                <th className="py-2 font-bold text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-zinc-600 text-xs">
                                            <tr className="border-b border-zinc-50 hover:bg-zinc-50">
                                                <td className="py-3">Oct 01, 2023</td>
                                                <td>Starter Plan (Free)</td>
                                                <td className="text-right font-bold text-black">$0.00</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// --- SUB COMPONENTS ---

const SidebarItem = ({ icon: Icon, label, id, active, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-bold uppercase transition-all duration-200
      ${active === id
                ? 'bg-zinc-100 text-black translate-x-1'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'
            }`}
    >
        <Icon className={active === id ? 'text-black' : 'text-zinc-400'} size={14} />
        {label}
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