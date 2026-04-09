import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Upload, Camera, ChevronLeft, ChevronRight, QrCode } from 'lucide-react';

interface ScoutQRProps {
  matchScoutsData: any[];
  pitScouts: any[];
  selectedMatchIds: Set<number>;
  setSelectedMatchIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  selectedRobotIds: Set<number>;
  setSelectedRobotIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  qrData: string[];
  qrChunkIndex: number;
  setQrChunkIndex: React.Dispatch<React.SetStateAction<number>>;
  onGenerateQR: () => void;
  scanning: boolean;
  importPreview: any | null;
  importResult: { imported: number; skipped: number; robotsImported?: number; robotsSkipped?: number } | null;
  scannedChunks: Map<string, string>;
  scannerContainerRef: React.RefObject<HTMLDivElement>;
  onStartScanner: () => void;
  onStopScanner: () => void;
  onConfirmImport: () => void;
  setImportPreview: React.Dispatch<React.SetStateAction<any>>;
  setScannedChunks: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  setImportResult: React.Dispatch<React.SetStateAction<any>>;
  isGuest?: boolean;
}

const ScoutQR: React.FC<ScoutQRProps> = ({
  matchScoutsData, pitScouts, selectedMatchIds, setSelectedMatchIds,
  selectedRobotIds, setSelectedRobotIds, qrData, qrChunkIndex, setQrChunkIndex,
  onGenerateQR, scanning, importPreview, importResult, scannedChunks,
  scannerContainerRef, onStartScanner, onStopScanner, onConfirmImport,
  setImportPreview, setScannedChunks, setImportResult, isGuest = false,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center">
            <Download size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Export Data</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Share via QR code</p>
          </div>
        </div>

        {matchScoutsData.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Select Matches to Export</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelectedMatchIds(new Set(matchScoutsData.map((m: any) => m.id)))}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all">Select All</button>
                <button type="button" onClick={() => setSelectedMatchIds(new Set())}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all">Deselect All</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-slate-100 dark:border-slate-700 rounded-xl p-2">
              {[...matchScoutsData].sort((a, b) => a.matchNumber - b.matchNumber).map((m: any) => (
                <label key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all">
                  <input type="checkbox" checked={selectedMatchIds.has(m.id)}
                    onChange={(e) => {
                      const next = new Set(selectedMatchIds);
                      if (e.target.checked) next.add(m.id); else next.delete(m.id);
                      setSelectedMatchIds(next);
                    }}
                    style={{ accentColor: 'var(--team-color)' }} className="w-4 h-4" />
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">M{m.matchNumber}</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Team {m.teamNumber}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${m.alliance === 'Red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                    {m.alliance}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
              {selectedMatchIds.size === 0 ? 'All matches will be exported' : `${selectedMatchIds.size} match${selectedMatchIds.size !== 1 ? 'es' : ''} selected`}
            </p>
          </div>
        )}

        {pitScouts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Select Robots to Export</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelectedRobotIds(new Set(pitScouts.map((r: any) => r.id)))}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all">Select All</button>
                <button type="button" onClick={() => setSelectedRobotIds(new Set())}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all">Deselect All</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-slate-100 dark:border-slate-700 rounded-xl p-2">
              {[...pitScouts].sort((a, b) => a.teamNumber - b.teamNumber).map((r: any) => (
                <label key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all">
                  <input type="checkbox" checked={selectedRobotIds.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(selectedRobotIds);
                      if (e.target.checked) next.add(r.id); else next.delete(r.id);
                      setSelectedRobotIds(next);
                    }}
                    style={{ accentColor: 'var(--team-color)' }} className="w-4 h-4" />
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">{r.teamNumber}</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{r.teamName || 'Unknown'}</span>
                </label>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
              {selectedRobotIds.size === 0 ? 'No robots selected for export' : `${selectedRobotIds.size} robot${selectedRobotIds.size !== 1 ? 's' : ''} selected`}
            </p>
          </div>
        )}

        <button onClick={onGenerateQR}
          className="w-full py-4 bg-teamColor text-white font-black rounded-xl uppercase tracking-widest text-xs hover:opacity-90 shadow-lg transition-all flex items-center justify-center gap-2">
          <QrCode size={16} /> Generate QR Code
        </button>

        {qrData.length > 0 && (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700">
              <QRCodeSVG value={qrData[qrChunkIndex]} size={240} />
            </div>
            {qrData.length > 1 && (
              <div className="flex items-center gap-4">
                <button onClick={() => setQrChunkIndex(Math.max(0, qrChunkIndex - 1))} disabled={qrChunkIndex === 0}
                  className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-black text-slate-600 dark:text-slate-400">{qrChunkIndex + 1} / {qrData.length}</span>
                <button onClick={() => setQrChunkIndex(Math.min(qrData.length - 1, qrChunkIndex + 1))} disabled={qrChunkIndex === qrData.length - 1}
                  className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all">
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold text-center">
              {selectedMatchIds.size > 0 ? `${selectedMatchIds.size} of ${matchScoutsData.length}` : matchScoutsData.length} match records
              {selectedRobotIds.size > 0 ? ` + ${selectedRobotIds.size} robots` : ''} encoded
            </p>
          </div>
        )}
      </div>

      {!isGuest && <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <Upload size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Import Data</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Scan QR code to import</p>
          </div>
        </div>

        {!scanning && !importPreview && (
          <button onClick={onStartScanner}
            className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg transition-all flex items-center justify-center gap-2">
            <Camera size={16} /> Start Scanner
          </button>
        )}

        {scanning && (
          <div className="space-y-4">
            <div id="qr-scanner-container" ref={scannerContainerRef} className="rounded-xl overflow-hidden" />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold text-center uppercase">
              Scanned {scannedChunks.size} chunk{scannedChunks.size !== 1 ? 's' : ''}...
            </p>
            <button onClick={onStopScanner}
              className="w-full py-3 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-black rounded-xl uppercase tracking-widest text-xs hover:bg-slate-300 transition-all">
              Cancel Scanning
            </button>
          </div>
        )}

        {importPreview && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-xl p-4">
              <p className="text-sm font-black text-green-800 mb-2">Data Ready to Import</p>
              <p className="text-xs text-green-700 font-bold">{importPreview.matchScouts?.length || 0} match records found</p>
              {importPreview.pitScouts?.length > 0 && (
                <p className="text-xs text-green-700 font-bold mt-1">{importPreview.pitScouts.length} robot records found</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setImportPreview(null); setScannedChunks(new Map()); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl uppercase tracking-widest text-xs">
                Cancel
              </button>
              <button onClick={onConfirmImport}
                className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-green-700 shadow-lg transition-all">
                Confirm Import
              </button>
            </div>
          </div>
        )}

        {importResult && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-xl p-4">
              <p className="text-sm font-black text-green-800 mb-2">Import Complete</p>
              <p className="text-xs text-green-700 font-bold">
                {importResult.imported} match{importResult.imported !== 1 ? 'es' : ''} imported
              </p>
              {(importResult.robotsImported || 0) > 0 && (
                <p className="text-xs text-green-700 font-bold mt-1">
                  {importResult.robotsImported} robot{importResult.robotsImported !== 1 ? 's' : ''} imported
                </p>
              )}
              {importResult.skipped > 0 && (
                <p className="text-xs text-amber-600 font-bold mt-1">
                  {importResult.skipped} match duplicate{importResult.skipped !== 1 ? 's' : ''} skipped
                </p>
              )}
              {(importResult.robotsSkipped || 0) > 0 && (
                <p className="text-xs text-amber-600 font-bold mt-1">
                  {importResult.robotsSkipped} robot duplicate{importResult.robotsSkipped !== 1 ? 's' : ''} skipped
                </p>
              )}
            </div>
            <button onClick={() => setImportResult(null)}
              className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl uppercase tracking-widest text-xs hover:bg-slate-200 transition-all">
              Dismiss
            </button>
          </div>
        )}
      </div>}
    </div>
  );
};

export default ScoutQR;
