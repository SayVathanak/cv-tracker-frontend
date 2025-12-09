import { FaCoins } from "react-icons/fa";

const CreditBadge = ({ credits, onClick }) => {
  // Change color based on balance
  const isLow = credits < 5; 
  
  return (
    <button 
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold md:border transition-all
        ${isLow 
          ? "md:bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
          : "md:bg-zinc-100 text-zinc-700 border-zinc-200 hover:border-zinc-400 hover:text-black"
        }
      `}
    >
      <FaCoins size={12} className={isLow ? "animate-pulse" : ""} />
      <span>{credits} Credits</span>
      {isLow && <span className="hidden sm:inline-block font-normal opacity-70">- Top up</span>}
    </button>
  );
};

export default CreditBadge;