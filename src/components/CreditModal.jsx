import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaTimes, FaCheck, FaBuilding, FaUserTie, FaShieldAlt, FaArrowLeft, FaUpload, FaSpinner, FaCloudUploadAlt } from 'react-icons/fa';
import QRCode from "react-qr-code";
import axios from 'axios';
import Swal from 'sweetalert2';

const CreditModal = ({ isOpen, onClose, onSuccess, userEmail }) => {
  const [step, setStep] = useState('select'); // select | payment | verify
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState('');
  const [proofFile, setProofFile] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setPaymentData(null);
      setError('');
      setProofFile(null);
    }
  }, [isOpen]);

  // 1. Create Payment Intent (Get QR Code)
  const handleSelectPackage = async (packageId) => {
    if (!userEmail) { 
      setError("Please log in to continue."); 
      return; 
    }
    setLoading(true); 
    setError('');
    
    try {
      const res = await axios.post(`${API_URL}/api/create-payment`, { 
        package_id: packageId, 
        email: userEmail 
      });
      setPaymentData(res.data);
      setStep('payment');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Connection failed. Please try again.');
    } finally { 
      setLoading(false); 
    }
  };

  // 2. Handle File Selection
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Optional: Check file size/type here
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire('Error', 'File size must be less than 5MB', 'error');
        return;
      }
      setProofFile(file);
    }
  };

  // 3. Submit Proof to Backend
  const handleSubmitProof = async () => {
    if (!proofFile || !paymentData) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', proofFile);

    try {
      // Send MD5 hash as query param so backend knows which transaction this is
      await axios.post(`${API_URL}/api/submit-payment-proof?md5_hash=${paymentData.md5}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStep('verify'); // Move to success/instruction screen
    } catch (err) {
      console.error(err);
      Swal.fire('Upload Failed', 'Could not upload proof. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Animation Variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2 } }
  };

  const stepVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            variants={modalVariants}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 pt-6 pb-2 shrink-0 z-10 bg-white">
              <div className="flex items-center gap-2">
                 {(step === 'payment') && (
                    <button onClick={() => setStep('select')} className="mr-1 text-zinc-400 hover:text-zinc-800 transition-colors">
                        <FaArrowLeft size={14} />
                    </button>
                 )}
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                    {step === 'select' && 'Add Credits'}
                    {step === 'payment' && 'Scan & Verify'}
                    {step === 'verify' && 'Submitted'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 transition-colors"
              >
                <FaTimes size={14} />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 pt-2 overflow-y-auto custom-scrollbar relative">
              <AnimatePresence mode="wait">
                
                {/* === STEP 1: SELECT PACKAGE === */}
                {step === 'select' && (
                  <motion.div
                    key="select"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-4 pt-2"
                  >
                    <p className="text-sm text-zinc-500 font-medium">Select a credit package.</p>

                    {/* Starter Pack */}
                    <div
                      onClick={() => !loading && handleSelectPackage('small')}
                      className={`group relative p-5 rounded-2xl border-2 border-zinc-100 hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                              <FaUserTie size={16} />
                           </div>
                           <div>
                              <h3 className="font-bold text-zinc-900 leading-tight">Starter Pack</h3>
                              <p className="text-xs text-zinc-500 mt-0.5">Perfect for single hires.</p>
                           </div>
                        </div>
                        <div className="text-right">
                          <span className="block text-xl font-bold text-zinc-900 tracking-tight">$1.00</span>
                          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">20 CREDITS</span>
                        </div>
                      </div>
                    </div>

                    {/* Agency Pro */}
                    <div
                      onClick={() => !loading && handleSelectPackage('pro')}
                      className={`group relative p-5 rounded-2xl bg-zinc-900 text-white cursor-pointer shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="absolute -top-3 right-4 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg border border-blue-400/30">
                        Most Popular
                      </div>

                      <div className="flex justify-between items-start">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-blue-200 group-hover:bg-white/20 transition-all">
                              <FaBuilding size={16} />
                           </div>
                           <div>
                              <h3 className="font-bold text-white leading-tight">Agency Pro</h3>
                              <p className="text-xs text-zinc-400 mt-0.5 group-hover:text-zinc-300">Volume hiring & export.</p>
                           </div>
                        </div>
                        <div className="text-right">
                          <span className="block text-xl font-bold text-white tracking-tight">$5.00</span>
                          <span className="text-[10px] font-bold text-zinc-900 bg-white px-2 py-1 rounded-md shadow-sm">150 CREDITS</span>
                        </div>
                      </div>
                    </div>

                    {error && (
                        <motion.div initial={{opacity:0, y:5}} animate={{opacity:1, y:0}} className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl text-center border border-red-100">
                            {error}
                        </motion.div>
                    )}
                  </motion.div>
                )}

                {/* === STEP 2: SCAN & UPLOAD === */}
                {step === 'payment' && paymentData && (
                  <motion.div
                    key="payment"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-col items-center pt-2 space-y-6"
                  >
                    {/* QR Code Section */}
                    <div className="w-full bg-blue-50/50 p-4 rounded-3xl border border-blue-100 flex flex-col items-center relative overflow-hidden">
                       <div className="bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm mb-3 z-10">
                          <QRCode
                            size={180}
                            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                            value={paymentData.qr_code}
                            viewBox={`0 0 256 256`}
                          />
                       </div>
                       <div className="text-center z-10">
                          <p className="text-2xl font-bold text-zinc-900 tracking-tight">${paymentData.amount}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Scan with Bakong App</p>
                       </div>
                    </div>

                    {/* Upload Section */}
                    <div className="w-full space-y-3">
                      <div className="flex items-center justify-between px-1">
                          <p className="text-xs font-bold uppercase text-zinc-400">Proof of Payment</p>
                          <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">Required</span>
                      </div>
                      
                      <label className={`
                        flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all
                        ${proofFile ? 'border-green-300 bg-green-50' : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100'}
                      `}>
                          {proofFile ? (
                              <div className="flex flex-col items-center text-green-700 animate-in fade-in zoom-in">
                                  <FaCheck className="text-xl mb-1" />
                                  <span className="text-xs font-bold truncate max-w-[200px]">{proofFile.name}</span>
                                  <span className="text-[10px] opacity-70">Click to change</span>
                              </div>
                          ) : (
                              <div className="flex flex-col items-center justify-center text-zinc-400">
                                  <FaCloudUploadAlt className="text-2xl mb-2" />
                                  <p className="text-xs font-bold">Click to upload screenshot</p>
                              </div>
                          )}
                          <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                      </label>

                      <button 
                          onClick={handleSubmitProof}
                          disabled={!proofFile || loading}
                          className={`
                            w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg
                            ${proofFile && !loading
                                ? 'bg-zinc-900 text-white hover:bg-black hover:shadow-xl hover:-translate-y-0.5' 
                                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none'}
                          `}
                      >
                          {loading ? <FaSpinner className="animate-spin text-lg"/> : 'Submit for Verification'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* === STEP 3: SUBMITTED === */}
                {step === 'verify' && (
                  <motion.div
                    key="verify"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-yellow-50 text-yellow-600"
                    >
                      <FaShieldAlt size={32} />
                    </motion.div>
                    
                    <h3 className="text-2xl font-bold text-zinc-900">Payment Submitted</h3>
                    <p className="text-sm text-zinc-500 font-medium mt-3 mb-8 max-w-[260px] leading-relaxed">
                        We have received your receipt. Our team will verify it and add credits to your account shortly.
                    </p>

                    <button 
                        onClick={onClose} 
                        className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-bold text-zinc-700 transition-colors"
                    >
                        Okay, got it
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreditModal;