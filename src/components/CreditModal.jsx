// components/CreditModal.jsx
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaTimes, FaCheck, FaBuilding, FaUserTie, FaBolt, FaShieldAlt, FaArrowLeft } from 'react-icons/fa';
import QRCode from "react-qr-code";
import axios from 'axios';

const CreditModal = ({ isOpen, onClose, onSuccess, userEmail }) => {
  const [step, setStep] = useState('select'); // select | payment | success
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState('');

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  // --- LOGIC SECTION ---
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setPaymentData(null);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    let interval;
    if (step === 'payment' && paymentData?.md5) {
      interval = setInterval(async () => {
        try {
          const res = await axios.post(`${API_URL}/api/check-payment-status?md5_hash=${paymentData.md5}`);
          if (res.data.status === 'PAID') handlePaymentSuccess();
        } catch (err) { console.error(err); }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step, paymentData]);

  const handlePaymentSuccess = () => {
    setStep('success');
    setTimeout(() => { onSuccess(); onClose(); }, 2500);
  };

  const handleSelectPackage = async (packageId) => {
    if (!userEmail) { setError("Please log in to continue."); return; }
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${API_URL}/api/create-payment`, { package_id: packageId, email: userEmail });
      setPaymentData(res.data);
      setStep('payment');
    } catch (err) {
      setError(err.response?.data?.detail || 'Connection failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleForcePay = async () => {
    if (!paymentData?.md5) return;
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/check-payment-status?md5_hash=${paymentData.md5}&force=true`);
      if (res.data.status === 'PAID') handlePaymentSuccess();
    } catch (err) { setError("Dev skip failed."); } finally { setLoading(false); }
  };

  // --- ANIMATION VARIANTS ---
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
          {/* Backdrop with Blur */}
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
                 {step === 'payment' && (
                    <button onClick={() => setStep('select')} className="mr-1 text-zinc-400 hover:text-zinc-800 transition-colors">
                        <FaArrowLeft size={14} />
                    </button>
                 )}
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                    {step === 'select' && 'Add Credits'}
                    {step === 'payment' && 'Secure Checkout'}
                    {step === 'success' && 'Confirmed'}
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
                
                {/* STEP 1: SELECTION */}
                {step === 'select' && (
                  <motion.div
                    key="select"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-4"
                  >
                    <p className="text-sm text-zinc-500 font-medium">Choose a package to start hiring.</p>

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

                    <div
                      onClick={() => !loading && handleSelectPackage('pro')}
                      className={`group relative p-5 rounded-2xl bg-zinc-900 text-white cursor-pointer shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                       {/* Badge */}
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

                    <div className="flex items-center justify-center gap-2 mt-4 pt-2">
                        <FaShieldAlt className="text-zinc-300" size={12}/>
                        <span className="text-[10px] text-zinc-400 font-medium">Secure KHQR Payment Gateway</span>
                    </div>

                    {error && (
                        <motion.div initial={{opacity:0, y:5}} animate={{opacity:1, y:0}} className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl text-center border border-red-100">
                            {error}
                        </motion.div>
                    )}
                  </motion.div>
                )}

                {/* STEP 2: PAYMENT */}
                {step === 'payment' && paymentData && (
                  <motion.div
                    key="payment"
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-col items-center pt-2"
                  >
                    <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 mb-6 w-full flex flex-col items-center relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 via-purple-500 to-blue-500 animate-gradient-x"></div>
                       
                       {/* QR Container */}
                       <div className="bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm mb-4">
                          <div className="w-48 h-48 flex items-center justify-center">
                            <QRCode
                              size={256}
                              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                              value={paymentData.qr_code}
                              viewBox={`0 0 256 256`}
                            />
                          </div>
                       </div>

                       <div className="text-center w-full">
                          <div className="flex items-end justify-center gap-1 mb-1">
                             <span className="text-3xl font-bold text-zinc-900 tracking-tight">${paymentData.amount}</span>
                             <span className="text-sm font-medium text-zinc-500 mb-1.5">USD</span>
                          </div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Scan with Banking App</p>
                       </div>
                    </div>

                    <div className="flex items-center gap-3 mb-6 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                      </span>
                      <span className="text-xs font-bold text-blue-700">Waiting for payment...</span>
                    </div>

                    <button
                        onClick={handleForcePay}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono text-zinc-300 hover:bg-zinc-50 hover:text-zinc-500 transition-all"
                    >
                        <FaBolt className="group-hover:text-yellow-500 transition-colors" size={10} /> 
                        DEV_SKIP_PAYMENT
                    </button>
                  </motion.div>
                )}

                {/* STEP 3: SUCCESS */}
                {step === 'success' && (
                  <motion.div
                    key="success"
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
                        className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-200 text-white"
                    >
                      <FaCheck size={32} />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-zinc-900">Payment Confirmed!</h3>
                    <p className="text-sm text-zinc-500 font-medium mt-2 max-w-[200px]">
                        Your credits have been added instantly. Redirecting...
                    </p>
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