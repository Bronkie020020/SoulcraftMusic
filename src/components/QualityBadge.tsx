import React, { useState, useEffect } from 'react';
import { Zap, Activity } from 'lucide-react';

export const QualityBadge = ({ url }: { url: string }) => {
  const [quality, setQuality] = useState<'checking' | 'HD' | 'Standard'>('checking');
  const [bitrate, setBitrate] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    setQuality('checking');
    
    // Simulate network delay for checking
    setTimeout(() => {
      if (!isMounted) return;
      
      const lowerUrl = (url || '').toLowerCase();
      // Basic heuristic for URL scanning estimation
      const isHighQualitySource = lowerUrl.includes('spotify') || lowerUrl.includes('soundcloud.com/hq') || lowerUrl.includes('vimeo');
      const estimatedBitrate = isHighQualitySource ? 320 : (lowerUrl.includes('youtube') ? 256 : 128);
      
      setBitrate(estimatedBitrate);
      setQuality(estimatedBitrate >= 256 ? 'HD' : 'Standard');
    }, 1200 + Math.random() * 800);

    return () => { isMounted = false; };
  }, [url]);

  if (quality === 'checking') {
    return (
      <span className="shrink-0 px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-400 flex items-center gap-1">
        <Activity className="w-3 h-3 animate-pulse" />
        Scanning...
      </span>
    );
  }

  return (
    <span className={`shrink-0 px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors ${
      quality === 'HD' 
        ? 'quality-badge-hd bg-amber-400/15 border-amber-400/35 text-amber-600 dark:bg-yellow-400/10 dark:border-yellow-400/30 dark:text-yellow-300' 
        : 'bg-slate-800 border-slate-700 text-slate-300'
    }`}>
      {quality === 'HD' ? <Zap className="w-3 h-3 text-amber-500 dark:text-yellow-400" /> : <Activity className="w-3 h-3" />}
      <span>{quality === 'HD' ? 'HD' : 'Standard'}</span>
      {bitrate && <span className="opacity-90 font-mono text-[9px] ml-0.5 font-bold">{bitrate} kbps</span>}
    </span>
  );
};
