import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { FaArrowRight } from 'react-icons/fa'

// --- SUB-COMPONENTS ---

const MinimalStat = ({ label, value, sub }) => (
  <div className="flex flex-col justify-between h-full">
    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</h3>
    <div className="mt-2">
      <span className="text-4xl font-light text-black tracking-tight">{value}</span>
      {sub && <span className="ml-2 text-xs text-zinc-400 font-medium">{sub}</span>}
    </div>
  </div>
)

const MinimalBar = ({ label, count, percent }) => (
  <div className="w-full mb-3 last:mb-0 group">
    <div className="flex justify-between items-end mb-1">
      <span className="text-xs text-zinc-600 font-medium truncate w-[75%] group-hover:text-black transition-colors">{label}</span>
      <span className="text-[10px] font-bold text-zinc-400 group-hover:text-black transition-colors">{count}</span>
    </div>
    <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }} 
        animate={{ width: `${percent}%` }} 
        transition={{ duration: 0.8, ease: "circOut" }} 
        className="h-full bg-zinc-800 rounded-full" 
      />
    </div>
  </div>
)

const Divider = () => <div className="w-px bg-zinc-100 mx-6 hidden lg:block h-full"></div>

// --- MAIN COMPONENT ---

const DashboardPanel = ({ stats, candidates, folderName = "All Candidates" }) => {

  // --- ANALYTICS LOGIC ---
  const analytics = useMemo(() => {
    const data = candidates; 
    const totalVisible = data.length;

    if (totalVisible === 0) return { 
        totalVisible: 0, positions: [], schools: [], locations: [], 
        avgConf: 0, gender: {m:0, f:0}, recent: [] 
    };

    const counts = { pos: {}, school: {}, loc: {}, gender: { Male: 0, Female: 0 } };
    let totalConf = 0;

    data.forEach(c => {
      const p = (c.Position?.length > 2 && c.Position !== "N/A" ? c.Position : "Unspecified").trim();
      const s = (c.School?.length > 2 && c.School !== "N/A" ? c.School : "Unspecified").trim();
      const l = (c.Location?.length > 2 && c.Location !== "N/A" ? c.Location.split(',').pop().trim() : "Unspecified").trim();

      counts.pos[p] = (counts.pos[p] || 0) + 1;
      counts.school[s] = (counts.school[s] || 0) + 1;
      counts.loc[l] = (counts.loc[l] || 0) + 1;

      totalConf += (c.Confidence || 0);

      const g = (c.Gender || "").toLowerCase();
      if (g === "male") counts.gender.Male++;
      else if (g === "female") counts.gender.Female++;
    });

    const sortSlice = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).filter(([n]) => n !== "Unspecified").slice(0, 5).map(([name, count]) => ({ name, count, percent: (count / totalVisible) * 100 }));

    return {
      totalVisible,
      positions: sortSlice(counts.pos),
      schools: sortSlice(counts.school),
      locations: sortSlice(counts.loc),
      avgConf: Math.round(totalConf / totalVisible),
      gender: {
        m: (counts.gender.Male / totalVisible) * 100,
        f: (counts.gender.Female / totalVisible) * 100
      },
      recent: data.sort((a,b) => b._id.localeCompare(a._id)).slice(0, 5)
    };
  }, [candidates]);

  return (
    <div className="h-full w-full bg-white select-text overflow-hidden flex flex-col">
      
      {/* 1. HEADER SECTION (Title + Key Metrics) */}
      <div className="flex-none p-8 lg:p-10 border-b border-zinc-100">
        <div className="flex justify-between items-start mb-8">
            <div>
                <h1 className="text-xl font-medium text-black tracking-tight">{folderName}</h1>
                <p className="text-xs text-zinc-400 uppercase tracking-widest mt-1">Analytics Overview</p>
            </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <MinimalStat label="Candidates" value={analytics.totalVisible} />
            <MinimalStat label="Roles" value={analytics.positions.length} />
            <MinimalStat label="AI Quality" value={`${analytics.avgConf}%`} />
            
            {/* Demographics Mini-Viz */}
            <div className="flex flex-col justify-between h-full">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Demographics</h3>
                <div className="mt-2 space-y-2">
                    <div className="flex h-1 w-full bg-zinc-100 overflow-hidden">
                        <div style={{ width: `${analytics.gender.m}%` }} className="h-full bg-black" />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-zinc-500">
                        <span>Male {Math.round(analytics.gender.m)}%</span>
                        <span>Female {Math.round(analytics.gender.f)}%</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* 2. SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-8 lg:p-10">
            <div className="flex flex-col lg:flex-row gap-10 lg:gap-0">
                
                {/* COLUMN 1: ROLES */}
                <div className="flex-1">
                    <h4 className="text-xs font-bold text-black uppercase tracking-widest mb-6 border-b border-zinc-100 pb-2">Top Roles</h4>
                    {analytics.positions.length > 0 ? (
                        analytics.positions.map((item, i) => <MinimalBar key={i} {...item} />)
                    ) : ( <p className="text-xs text-zinc-300 italic">No data</p> )}
                </div>

                <Divider />

                {/* COLUMN 2: EDUCATION */}
                <div className="flex-1">
                    <h4 className="text-xs font-bold text-black uppercase tracking-widest mb-6 border-b border-zinc-100 pb-2">Education</h4>
                    {analytics.schools.length > 0 ? (
                        analytics.schools.map((item, i) => <MinimalBar key={i} {...item} />)
                    ) : ( <p className="text-xs text-zinc-300 italic">No data</p> )}
                </div>

                <Divider />

                {/* COLUMN 3: LOCATIONS */}
                <div className="flex-1">
                    <h4 className="text-xs font-bold text-black uppercase tracking-widest mb-6 border-b border-zinc-100 pb-2">Locations</h4>
                    {analytics.locations.length > 0 ? (
                        analytics.locations.map((item, i) => <MinimalBar key={i} {...item} />)
                    ) : ( <p className="text-xs text-zinc-300 italic">No data</p> )}
                </div>

            </div>

            {/* 3. RECENT ADDITIONS (Compact Table) */}
            <div className="mt-12 pt-10 border-t border-zinc-100">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Recently Added</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analytics.recent.map(c => (
                        <div key={c._id} className="flex items-center justify-between p-3 border border-zinc-100 rounded-lg hover:border-zinc-300 transition-colors">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-black truncate max-w-[150px]">{c.Name}</span>
                                <span className="text-[10px] text-zinc-400 truncate max-w-[150px]">{c.Position || "N/A"}</span>
                            </div>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'Ready' ? 'bg-black' : 'bg-zinc-300'}`}></span>
                        </div>
                    ))}
                    {analytics.recent.length === 0 && <p className="text-xs text-zinc-300 italic">No recent candidates</p>}
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPanel