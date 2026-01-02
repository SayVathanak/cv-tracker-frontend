import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FaUser,
  FaBriefcase,
  FaMagic,
  FaMars,
  FaVenus,
  FaMapMarkerAlt,
  FaGraduationCap,
  FaClock,
} from "react-icons/fa";

// --- SUB-COMPONENTS ---

const DetailedStat = ({ label, value, sub, icon: Icon }) => (
  <div className="flex flex-col justify-between p-3 rounded-lg border border-zinc-100 bg-zinc-50/50 h-full">
    <div className="flex justify-between items-start mb-1">
      <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        {label}
      </h3>
      {Icon && <Icon className="text-zinc-300 text-[10px]" />}
    </div>
    <div className="mt-1">
      <span className="text-2xl font-semibold text-black tracking-tight block leading-none">
        {value}
      </span>
      <span className="text-[9px] text-zinc-400 font-medium">{sub}</span>
    </div>
  </div>
);

const CompactBar = ({ name, count, percent }) => (
  <div className="w-full mb-2 last:mb-0 group">
    <div className="flex justify-between items-end mb-0.5">
      <span
        className="text-[11px] text-zinc-600 font-medium truncate w-[85%] group-hover:text-black transition-colors"
        title={name}
      >
        {name || "Unknown"}
      </span>
      <span className="text-[9px] font-bold text-zinc-400 group-hover:text-black transition-colors">
        {count}
      </span>
    </div>
    <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: "circOut" }}
        className="h-full bg-zinc-800 rounded-full group-hover:bg-black"
      />
    </div>
  </div>
);

const Divider = () => (
  <div className="w-px bg-zinc-100 mx-3 hidden lg:block h-full"></div>
);

// --- MAIN COMPONENT ---

const DashboardPanel = ({ candidates, folderName = "All Candidates" }) => {
  // --- ANALYTICS LOGIC ---
  const analytics = useMemo(() => {
    // Ensure we are working with an array
    const data = Array.isArray(candidates) ? candidates : [];
    const totalVisible = data.length;

    if (totalVisible === 0)
      return {
        totalVisible: 0,
        positions: [],
        schools: [],
        locations: [],
        avgConf: 0,
        gender: { m: 0, f: 0 },
        recent: [],
      };

    const counts = {
      pos: {},
      school: {},
      loc: {},
      gender: { Male: 0, Female: 0 },
    };
    let totalConf = 0;

    data.forEach((c) => {
      // Normalize data strings
      const p = (
        c.Position?.length > 1 && c.Position !== "N/A"
          ? c.Position
          : "Unspecified"
      ).trim();
      const s = (
        c.School?.length > 1 && c.School !== "N/A" ? c.School : "Unspecified"
      ).trim();
      const l = (
        c.Location?.length > 1 && c.Location !== "N/A"
          ? c.Location.split(",").pop().trim()
          : "Unspecified"
      ).trim();

      counts.pos[p] = (counts.pos[p] || 0) + 1;
      counts.school[s] = (counts.school[s] || 0) + 1;
      counts.loc[l] = (counts.loc[l] || 0) + 1;

      totalConf += c.Confidence || 0;

      const g = (c.Gender || "").toLowerCase();
      if (g === "male") counts.gender.Male++;
      else if (g === "female") counts.gender.Female++;
    });

    // Helper to sort by count and slice top 5
    const sortSlice = (obj) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .filter(([n]) => n !== "Unspecified")
        .slice(0, 5)
        .map(([name, count]) => ({
          name,
          count,
          percent: (count / totalVisible) * 100,
        }));

    // Safe average calculation
    const avgScore =
      totalVisible > 0 ? Math.round(totalConf / totalVisible) : 0;

    return {
      totalVisible,
      positions: sortSlice(counts.pos),
      schools: sortSlice(counts.school),
      locations: sortSlice(counts.loc),
      avgConf: avgScore,
      gender: {
        m: totalVisible > 0 ? (counts.gender.Male / totalVisible) * 100 : 0,
        f: totalVisible > 0 ? (counts.gender.Female / totalVisible) * 100 : 0,
      },
      // Sort by _id (timestamp) descending for "Recently Added"
      recent: [...data].sort((a, b) => b._id.localeCompare(a._id)).slice(0, 6),
    };
  }, [candidates]);

  // Date Formatting (Matches StatusBar.jsx)
  const dateOptions = { weekday: "short", month: "short", day: "numeric" };
  const today = new Date().toLocaleDateString("en-US", dateOptions);

  return (
    <div className="h-full w-full bg-white select-text overflow-hidden flex flex-col font-sans">
      {/* 1. HEADER SECTION */}
      <div className="flex-none p-4 border-b border-zinc-100">
        {/* Status Bar Row (Matches StatusBar.jsx style) */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-50">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            {today}
          </span>
          <div className="text-[10px]">
            <span className="font-bold text-zinc-400 uppercase tracking-wider mr-2">
              Candidates
            </span>
            <span className="font-bold text-black">
              {analytics.totalVisible}
            </span>
          </div>
        </div>

        {/* Title Row */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-black tracking-tight leading-none">
            {folderName}
          </h1>
          <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest">
            Analytics Overview
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-20">
          <DetailedStat
            label="Total Profiles"
            value={analytics.totalVisible}
            sub="Active Database"
            icon={FaUser}
          />
          <DetailedStat
            label="Unique Roles"
            value={analytics.positions.length}
            sub="Detected"
            icon={FaBriefcase}
          />
          <DetailedStat
            label="AI Accuracy"
            value={`${analytics.avgConf}%`}
            sub="Avg. Confidence"
            icon={FaMagic}
          />

          {/* Compact Demographics */}
          <div className="flex flex-col justify-between p-3 rounded-lg border border-zinc-100 bg-zinc-50/50 h-full">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Demographics
            </h3>
            <div className="flex flex-col justify-end h-full mt-2">
              <div className="flex h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden mb-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${analytics.gender.m}%` }}
                  className="h-full bg-zinc-800"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${analytics.gender.f}%` }}
                  className="h-full bg-zinc-400"
                />
              </div>
              <div className="flex justify-between text-[9px] font-bold text-zinc-500">
                <span className="flex items-center gap-1">
                  <FaMars className="text-[8px]" />{" "}
                  {Math.round(analytics.gender.m)}%
                </span>
                <span className="flex items-center gap-1">
                  <FaVenus className="text-[8px]" />{" "}
                  {Math.round(analytics.gender.f)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-0">
            {/* COLUMN 1: ROLES */}
            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-zinc-100">
                <FaBriefcase className="text-zinc-300 text-[9px]" />
                <h4 className="text-[10px] font-bold text-black uppercase tracking-widest">
                  Top Roles
                </h4>
              </div>
              {analytics.positions.length > 0 ? (
                analytics.positions.map((item, i) => (
                  <CompactBar key={i} {...item} />
                ))
              ) : (
                <p className="text-[10px] text-zinc-300 italic py-1">
                  No data available
                </p>
              )}
            </div>

            <Divider />

            {/* COLUMN 2: EDUCATION */}
            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-zinc-100">
                <FaGraduationCap className="text-zinc-300 text-[9px]" />
                <h4 className="text-[10px] font-bold text-black uppercase tracking-widest">
                  Education
                </h4>
              </div>
              {analytics.schools.length > 0 ? (
                analytics.schools.map((item, i) => (
                  <CompactBar key={i} {...item} />
                ))
              ) : (
                <p className="text-[10px] text-zinc-300 italic py-1">
                  No data available
                </p>
              )}
            </div>

            <Divider />

            {/* COLUMN 3: LOCATIONS */}
            <div className="flex-1 min-w-[140px]">
              <div className="flex items-center gap-1.5 mb-2 pb-1 border-b border-zinc-100">
                <FaMapMarkerAlt className="text-zinc-300 text-[9px]" />
                <h4 className="text-[10px] font-bold text-black uppercase tracking-widest">
                  Locations
                </h4>
              </div>
              {analytics.locations.length > 0 ? (
                analytics.locations.map((item, i) => (
                  <CompactBar key={i} {...item} />
                ))
              ) : (
                <p className="text-[10px] text-zinc-300 italic py-1">
                  No data available
                </p>
              )}
            </div>
          </div>

          {/* 3. RECENT ADDITIONS */}
          <div className="mt-2 pt-4 border-t border-zinc-100">
            <div className="flex items-center gap-1.5 mb-3">
              <FaClock className="text-zinc-300 text-[9px]" />
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Recently Added
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {analytics.recent.map((c) => (
                <div
                  key={c._id}
                  className="flex items-center justify-between p-2.5 border border-zinc-100 rounded bg-white hover:border-zinc-300 transition-colors"
                >
                  <div className="flex flex-col overflow-hidden mr-2">
                    <span className="text-xs font-bold text-zinc-800 truncate">
                      {c.Name}
                    </span>
                    <span className="text-[9px] text-zinc-500 truncate uppercase tracking-wider">
                      {c.Position || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-zinc-300">
                      {c.Confidence}%
                    </span>
                    <span
                      className={`flex-none w-1.5 h-1.5 rounded-full ${
                        c.status === "Ready" ? "bg-green-500" : "bg-zinc-200"
                      }`}
                    ></span>
                  </div>
                </div>
              ))}
              {analytics.recent.length === 0 && (
                <p className="text-[10px] text-zinc-300 italic">
                  No recent candidates
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPanel;
