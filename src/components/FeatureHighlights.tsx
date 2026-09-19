import React from 'react';
import { Zap, Tag, Share2, ShieldCheck, Radio, Sparkles } from 'lucide-react';
import { AppLanguage } from '../types';
import { translations } from '../utils/translations';

interface FeatureHighlightsProps {
  language: AppLanguage['code'];
}

export const FeatureHighlights: React.FC<FeatureHighlightsProps> = ({ language }) => {
  const t = translations[language];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
      {/* Feature 1 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-3 hover:border-slate-700 transition-all">
        <div className="w-10 h-10 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-300">
          <Zap className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-white">{t.feature1Title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{t.feature1Desc}</p>
      </div>

      {/* Feature 2 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-3 hover:border-slate-700 transition-all">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Share2 className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-white">{t.feature2Title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{t.feature2Desc}</p>
      </div>

      {/* Feature 3 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-3 hover:border-slate-700 transition-all">
        <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <Tag className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-white">{t.feature3Title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{t.feature3Desc}</p>
      </div>
    </div>
  );
};
