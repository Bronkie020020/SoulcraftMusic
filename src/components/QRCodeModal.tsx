import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, X, Copy, Check, Smartphone, ExternalLink, Wifi, Signal, Share, PlusSquare } from 'lucide-react';
import { AppLanguage } from '../types';

interface QRCodeModalProps {
  language: AppLanguage['code'];
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ language, onClose }) => {
  const [copied, setCopied] = useState(false);

  // Always prefer the live public HTTPS cloud URL so it works seamlessly on 4G, 5G and any Wi-Fi
  const getPublicUrl = () => {
    if (typeof window !== 'undefined') {
      const href = window.location.href;
      // If we are on localhost or internal iframe, provide the public shared Cloud Run URL
      if (href.includes('localhost') || href.includes('127.0.0.1')) {
        return 'https://ais-pre-63c5i75otmzaz257s7ftxb-269733825538.europe-west2.run.app';
      }
      return href;
    }
    return 'https://ais-pre-63c5i75otmzaz257s7ftxb-269733825538.europe-west2.run.app';
  };

  const currentUrl = getPublicUrl();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 text-white my-auto max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title={language === 'nl' ? 'Sluiten' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-lg shadow-yellow-400/20">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white">
                {language === 'nl' ? 'Mobiel & iPhone 15 QR-Code' : 'Mobile & iPhone 15 QR Code'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold text-[10px] uppercase tracking-wide">
                Live
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {language === 'nl'
                ? 'Scan met je iPhone of Android camera voor directe toegang via 5G & Wi-Fi'
                : 'Scan with your iPhone or Android camera for direct access over 5G & Wi-Fi'}
            </p>
          </div>
        </div>

        {/* Connectivity Badges: 5G + Wi-Fi Ready */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl text-xs">
            <Signal className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-[11px]">5G & 4G Mobiel</p>
              <p className="text-[10px] text-slate-400">{language === 'nl' ? 'Overal bereikbaar' : 'Global mobile access'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl text-xs">
            <Wifi className="w-4 h-4 text-yellow-400 shrink-0" />
            <div>
              <p className="font-bold text-white text-[11px]">Wi-Fi Netwerk</p>
              <p className="text-[10px] text-slate-400">{language === 'nl' ? 'Snelle streaming' : 'Fast high-speed'}</p>
            </div>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="bg-white p-3.5 rounded-2xl shadow-xl border-4 border-yellow-400/30">
            <QRCodeSVG 
              value={currentUrl} 
              size={210}
              level="H"
              includeMargin={false}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-yellow-300 font-bold bg-yellow-400/10 px-3.5 py-1.5 rounded-full border border-yellow-400/20">
            <Smartphone className="w-4 h-4" />
            <span>
              {language === 'nl'
                ? 'Richt je camera op de code om te openen'
                : 'Point your camera to open instantly'}
            </span>
          </div>
        </div>

        {/* iOS iPhone 15 Install Guide */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 space-y-2 text-xs">
          <p className="font-bold text-white flex items-center gap-1.5 text-[11px] sm:text-xs">
            <Share className="w-3.5 h-3.5 text-yellow-300" />
            <span>{language === 'nl' ? 'Als echte app op je iPhone 15 beginscherm:' : 'Install as app on your iPhone 15 home screen:'}</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
            <li>{language === 'nl' ? 'Scan de QR-code en open de link in Safari.' : 'Scan QR code and open link in Safari.'}</li>
            <li>{language === 'nl' ? 'Tik onderin Safari op het Deel-icoontje (vierkantje met pijl omhoog).' : 'Tap the Share icon at the bottom of Safari.'}</li>
            <li>{language === 'nl' ? 'Kies "Zet op beginscherm" (Add to Home Screen).' : 'Select "Add to Home Screen".'}</li>
          </ol>
        </div>

        {/* URL Box & Copy Button */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {language === 'nl' ? 'Directe Link' : 'Direct Link'}
          </label>
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="w-full bg-transparent text-xs text-slate-300 px-2 outline-none font-mono truncate select-all"
            />
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-md"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-slate-950" />
                  <span>{language === 'nl' ? 'Gekopieerd!' : 'Copied!'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-950" />
                  <span>{language === 'nl' ? 'Kopieer' : 'Copy'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex justify-between items-center text-xs border-t border-slate-800/80">
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-300 hover:text-yellow-200 font-bold flex items-center gap-1.5 transition-colors p-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{language === 'nl' ? 'Open direct in nieuw tabblad' : 'Open direct in new tab'}</span>
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors min-h-[38px]"
          >
            {language === 'nl' ? 'Sluiten' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

