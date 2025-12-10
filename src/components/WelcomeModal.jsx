import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaGift } from 'react-icons/fa';
import confetti from 'canvas-confetti';

const WelcomeModal = ({ isOpen, onClose }) => {
  // Trigger confetti when the modal opens
  useEffect(() => {
    if (isOpen) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 150 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative bg-white w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl overflow-hidden z-10"
          >
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-blue-50 to-transparent -z-10" />

            {/* Icon */}
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner text-3xl border-4 border-white">
              <FaGift className="animate-bounce" />
            </div>

            {/* Text */}
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Welcome Aboard!</h2>
            <p className="text-zinc-500 mb-8 text-sm leading-relaxed">
              Thanks for joining CV Tracker AI.<br />
              We've added <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">10 Free Credits</span> to your account so you can start analyzing CVs immediately.
            </p>

            {/* Button */}
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-zinc-900 hover:bg-black text-white rounded-xl font-bold shadow-lg shadow-zinc-200 hover:shadow-xl transition-all active:scale-95"
            >
              Start Using Credits
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeModal;