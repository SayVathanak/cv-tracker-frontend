import { motion, AnimatePresence } from "framer-motion";
import {
  FaCloudUploadAlt,
  FaCheck,
  FaExclamationTriangle,
  FaClock,
  Famagic,
} from "react-icons/fa"; // Added FaMagic for AI icon if needed

const UploadModal = ({
  isOpen,
  progress,
  status,
  error,
  onClose,
  fileCount = 0,
}) => {
  if (!isOpen) return null;

  const isError = !!error;
  const isComplete = progress === 100 && !isError;

  // --- IMPROVEMENT 1: Adjusted Time Calculation ---
  const getEstimatedTime = () => {
    if (fileCount <= 0) return null;

    // CHANGED: Reduced from 13s to 2s per file.
    // Explanation: The modal only waits for the Upload, not the AI processing.
    const totalSeconds = Math.ceil(fileCount * 2.5);

    if (totalSeconds < 60) {
      return `${totalSeconds} seconds`;
    } else {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes} min${minutes > 1 ? "s" : ""} ${
        seconds > 0 ? `${seconds} sec` : ""
      }`;
    }
  };

  const estTime = getEstimatedTime();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {" "}
      {/* Changed z-100 to z-50 for standard Tailwind */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center"
      >
        {/* Icon State */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 
          ${
            isError
              ? "bg-red-50 text-red-500"
              : isComplete
              ? "bg-green-50 text-green-500"
              : "bg-blue-50 text-blue-500"
          }`}
        >
          {isError ? (
            <FaExclamationTriangle className="text-2xl" />
          ) : isComplete ? (
            <FaCheck className="text-2xl" />
          ) : (
            <FaCloudUploadAlt className="text-3xl animate-bounce" />
          )}
        </div>

        <h3 className="text-xl font-bold text-zinc-900 mb-2">
          {isError
            ? "Upload Failed"
            : isComplete
            ? "Upload Complete!"
            : "Uploading Files..."}
        </h3>

        {/* Estimated Time Badge */}
        {!isError && !isComplete && estTime && (
          <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-xs font-medium mb-4">
            <FaClock size={12} />
            <span>Est. Upload: ~{estTime}</span>
          </div>
        )}

        <p className="text-sm text-zinc-500 mb-6 px-4 leading-relaxed">
          {isError
            ? error
            : isComplete
            ? "Files have been uploaded successfully. The AI is now analyzing them in the background."
            : status}
        </p>

        {/* Progress Bar */}
        {!isError && (
          <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden relative mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeInOut" }}
              className={`h-full ${isComplete ? "bg-green-500" : "bg-black"}`}
            />
          </div>
        )}

        {/* Close Button */}
        {(isComplete || isError) && (
          <button
            onClick={onClose}
            className="mt-4 px-8 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-zinc-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {isError ? "Try Again" : "Done"}
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default UploadModal;
