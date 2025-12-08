import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FaSearch, FaBriefcase, FaUniversity, FaMapMarkerAlt, 
  FaChartPie, FaMagic, FaUserClock, FaVenusMars 
} from 'react-icons/fa'
import { CiWavePulse1 } from "react-icons/ci";
import { IoMdPeople, IoIosAlbums } from "react-icons/io";

// --- SUB-COMPONENTS ---

const StatCard = ({ label, value, icon, trend, color = "black" }) => (
  <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 flex flex-col justify-between h-28 relative overflow-hidden group">
    <div className={`absolute right-0 bottom-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-${color}`}>
      {icon}
    </div>
    <div>
      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</h4>
      <span className="text-3xl font-light text-black tracking-tighter">{value}</span>
    </div>
    {trend && (
      <div className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
        <span className="bg-white px-1.5 py-0.5 rounded border border-zinc-200">{trend}</span>
      </div>
    )}
  </div>
)

const DistributionBar = ({ label, count, percent }) => (
  <div className="group w-full mb-3 last:mb-0">
    <div className="flex justify-between items-baseline mb-1.5">
      <span className="text-xs font-medium text-zinc-600 truncate w-[85%]" title={label}>{label}</span>
      <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-1.5 rounded">{count}</span>
    </div>
    <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }} 
        animate={{ width: `${percent}%` }} 
        transition={{ duration: 1.0, ease: "circOut" }} 
        className="h-full bg-zinc-800 rounded-full" 
      />
    </div>
  </div>
)

const ConfidenceMeter = ({ avg, distribution }) => (
  <div className="bg-zinc-900 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-20"><FaMagic size={40} /></div>
    <div className="relative z-10">
      <h4 className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-2">AI Health Score</h4>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-4xl font-bold">{avg}%</span>
        <span className="text-xs opacity-50">Average Confidence</span>
      </div>
      
      {/* Distribution Bars */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px]">
          <span className="w-8 text-right opacity-50">High</span>
          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
             <motion.div initial={{ width: 0 }} animate={{ width: `${distribution.high}%` }} className="h-full bg-green-400" />
          </div>
          <span className="w-6 opacity-75">{Math.round(distribution.high)}%</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="w-8 text-right opacity-50">Med</span>
          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
             <motion.div initial={{ width: 0 }} animate={{ width: `${distribution.med}%` }} className="h-full bg-amber-400" />
          </div>
          <span className="w-6 opacity-75">{Math.round(distribution.med)}%</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="w-8 text-right opacity-50">Low</span>
          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
             <motion.div initial={{ width: 0 }} animate={{ width: `${distribution.low}%` }} className="h-full bg-red-400" />
          </div>
          <span className="w-6 opacity-75">{Math.round(distribution.low)}%</span>
        </div>
      </div>
    </div>
  </div>
)

const EmptyMsg = () => <p className="text-xs text-zinc-300 italic py-2">No data available</p>;

// --- MAIN COMPONENT ---

const DashboardPanel = ({ stats, candidates }) => {
  const [filter, setFilter] = useState("");

  // --- MEMOIZED ANALYTICS ---
  const analytics = useMemo(() => {
    // 1. Filter Data
    const data = candidates.filter(c => {
      if (!filter) return true;
      const s = filter.toLowerCase();
      return (
        (c.Name?.toLowerCase() || "").includes(s) ||
        (c.Position?.toLowerCase() || "").includes(s) ||
        (c.School?.toLowerCase() || "").includes(s) ||
        (c.Location?.toLowerCase() || "").includes(s)
      );
    });

    const total = data.length;
    if (total === 0) return { total: 0, positions: [], schools: [], locations: [], avgConf: 0, confDist: {high:0, med:0, low:0}, gender: {m:0, f:0, n:0}, recent: [] };

    // 2. Aggregate Counts
    const counts = { pos: {}, school: {}, loc: {}, gender: { Male: 0, Female: 0 } };
    let totalConf = 0;
    let high = 0, med = 0, low = 0;

    data.forEach(c => {
      // Top Lists
      const p = (c.Position?.length > 2 ? c.Position : "Unknown").trim();
      const s = (c.School?.length > 2 ? c.School : "Unknown").trim();
      const l = (c.Location?.length > 2 ? c.Location : "Unknown").trim();
      counts.pos[p] = (counts.pos[p] || 0) + 1;
      counts.school[s] = (counts.school[s] || 0) + 1;
      counts.loc[l] = (counts.loc[l] || 0) + 1;

      // Confidence
      const conf = c.Confidence || 0;
      totalConf += conf;
      if (conf >= 80) high++;
      else if (conf >= 50) med++;
      else low++;

      // Gender
      if (c.Gender === "Male") counts.gender.Male++;
      else if (c.Gender === "Female") counts.gender.Female++;
    });

    // 3. Helper to sort and slice
    const sortSlice = (obj) => Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4) // Show Top 4
      .map(([name, count]) => ({ name, count, percent: (count / total) * 100 }));

    return {
      total,
      positions: sortSlice(counts.pos),
      schools: sortSlice(counts.school),
      locations: sortSlice(counts.loc),
      avgConf: Math.round(totalConf / total),
      confDist: {
        high: (high / total) * 100,
        med: (med / total) * 100,
        low: (low / total) * 100
      },
      gender: {
        m: (counts.gender.Male / total) * 100,
        f: (counts.gender.Female / total) * 100
      },
      recent: data.sort((a,b) => b._id.localeCompare(a._id)).slice(0, 3)
    };
  }, [candidates, filter]);

  return (
    <div className="h-full w-full bg-white select-text overflow-hidden flex flex-col p-6 lg:p-8">
      
      {/* HEADER & SEARCH */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-zinc-100 pb-5 mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-light text-black tracking-tight flex items-center gap-3">
            <CiWavePulse1 className="text-zinc-600" size={32}/> Analytics
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 w-1 rounded-full bg-green-500"></div>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Real-time Overview</span>
          </div>
        </div>
        <div className="relative w-full md:w-64 group">
          <FaSearch className="absolute left-3 top-2.5 text-zinc-400 group-focus-within:text-black transition-colors" size={12} />
          <input 
            type="text" 
            placeholder="Filter dashboard stats..." 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)} 
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-black focus:border-black focus:ring-0 outline-none transition-all placeholder:text-zinc-400" 
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
          
          {/* ROW 1: KEY METRICS & AI HEALTH */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Column 1: Stat Cards */}
            <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label={filter ? "Matches" : "Total Candidates"} value={analytics.total} icon={<IoMdPeople size={60} />} />
              <StatCard label="Unique Roles" value={analytics.positions.length > 0 ? analytics.positions.length + "+" : 0} icon={<IoIosAlbums size={52} />} />
              
              {/* Gender Split Card */}
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 flex flex-col justify-between h-28">
                <div className="flex justify-between items-start">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Demographics</h4>
                  <FaVenusMars className="text-zinc-200" size={16} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-blue-600">Male {Math.round(analytics.gender.m)}%</span>
                    <span className="text-pink-600">Female {Math.round(analytics.gender.f)}%</span>
                  </div>
                  <div className="flex h-2 w-full rounded-full overflow-hidden bg-zinc-200">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${analytics.gender.m}%` }} className="h-full bg-blue-500" />
                    <motion.div initial={{ width: 0 }} animate={{ width: `${analytics.gender.f}%` }} className="h-full bg-pink-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: AI Health (Dark Card) */}
            <div className="md:col-span-1">
              <ConfidenceMeter avg={analytics.avgConf} distribution={analytics.confDist} />
            </div>
          </div>

          {/* ROW 2: DETAILED LISTS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
            {/* Top Roles */}
            <div className="bg-white rounded-xl border border-zinc-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-[10px] font-bold text-black uppercase tracking-widest mb-4 pb-2 border-b border-zinc-50 flex items-center gap-2">
                <FaBriefcase className="text-zinc-300" /> Top Roles
              </h3>
              <div className="space-y-1">
                {analytics.positions.map((item, i) => <DistributionBar key={i} label={item.name} count={item.count} percent={item.percent} />)}
                {analytics.positions.length === 0 && <EmptyMsg />}
              </div>
            </div>

            {/* Top Schools */}
            <div className="bg-white rounded-xl border border-zinc-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-[10px] font-bold text-black uppercase tracking-widest mb-4 pb-2 border-b border-zinc-50 flex items-center gap-2">
                <FaUniversity className="text-zinc-300" /> Education
              </h3>
              <div className="space-y-1">
                {analytics.schools.map((item, i) => <DistributionBar key={i} label={item.name} count={item.count} percent={item.percent} />)}
                {analytics.schools.length === 0 && <EmptyMsg />}
              </div>
            </div>

            {/* Locations & Recent */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-zinc-100 p-5 shadow-sm">
                <h3 className="text-[10px] font-bold text-black uppercase tracking-widest mb-4 pb-2 border-b border-zinc-50 flex items-center gap-2">
                  <FaMapMarkerAlt className="text-zinc-300" /> Locations
                </h3>
                <div className="space-y-1">
                  {analytics.locations.map((item, i) => <DistributionBar key={i} label={item.name} count={item.count} percent={item.percent} />)}
                  {analytics.locations.length === 0 && <EmptyMsg />}
                </div>
              </div>

              {/* Recent Activity Mini-List */}
              <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FaUserClock /> Recently Added
                </h3>
                <div className="space-y-2">
                  {analytics.recent.map(c => (
                    <div key={c._id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-zinc-100">
                      <span className="font-bold truncate max-w-[120px]">{c.Name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${c.status === 'Ready' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                  {analytics.recent.length === 0 && <EmptyMsg />}
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}

export default DashboardPanel