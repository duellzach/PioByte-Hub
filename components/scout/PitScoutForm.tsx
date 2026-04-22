import React, { useState } from 'react';
import { X, Camera, Image, Loader2 } from 'lucide-react';
import { RatingSlider, StarRating, TagInput } from './shared';
import { useTeamSettings } from '../../contexts/TeamSettingsContext';

interface PitScoutFormProps {
  show: boolean;
  editingPit: any | null;
  pitForm: any;
  setPitForm: (f: any) => void;
  onClose: () => void;
  onSave: () => void;
  compressImage: (file: File) => Promise<string>;
  isFtcEvent?: boolean;
  onFetchToaPhoto?: (teamNumber: number) => Promise<{ url: string; description: string }[]>;
}

const PitScoutForm: React.FC<PitScoutFormProps> = ({
  show, editingPit, pitForm, setPitForm, onClose, onSave, compressImage,
  isFtcEvent = false, onFetchToaPhoto,
}) => {
  const { settings } = useTeamSettings();
  const [toaPhotoLoading, setToaPhotoLoading] = useState(false);
  const [toaPhotoMsg, setToaPhotoMsg] = useState<string | null>(null);

  const handleFetchToaPhoto = async () => {
    if (!onFetchToaPhoto || !pitForm.teamNumber) return;
    setToaPhotoLoading(true);
    setToaPhotoMsg(null);
    try {
      const photos = await onFetchToaPhoto(pitForm.teamNumber);
      if (photos.length > 0) {
        setPitForm({ ...pitForm, photoUrl: photos[0].url });
        setToaPhotoMsg(`Photo loaded from TOA.`);
      } else {
        setToaPhotoMsg('No photos found for this team on TOA.');
      }
    } catch {
      setToaPhotoMsg('Failed to fetch from TOA.');
    } finally {
      setToaPhotoLoading(false);
    }
  };

  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-auto p-6 md:p-10 shadow-2xl border-t-8 border-teamColor">
        <div className="flex justify-between items-start mb-6 md:mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
              {editingPit ? 'Edit Robot' : 'Scout Robot'}
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Pit scouting form</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team Number</label>
            <input
              type="number"
              value={pitForm.teamNumber}
              onChange={(e) => { setPitForm({ ...pitForm, teamNumber: parseInt(e.target.value) || 0 }); setToaPhotoMsg(null); }}
              className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-teamColor transition-all font-black text-lg"
              placeholder="Team #"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Drive Train</label>
            <div className="grid grid-cols-2 gap-2">
              {['Tank', 'Swerve', 'Mecanum', 'Other'].map(dt => (
                <button key={dt} type="button"
                  onClick={() => setPitForm({ ...pitForm, driveTrain: dt })}
                  className={`p-2 rounded-[18px] text-xs font-black uppercase tracking-widest border-2 transition-all ${pitForm.driveTrain === dt ? 'border-teamColor bg-teamColor/10 text-teamColor' : 'border-slate-100 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-teamColor/50'}`}>
                  {dt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Autonomous</label>
            <textarea value={pitForm.autoCapabilities} onChange={(e) => setPitForm({ ...pitForm, autoCapabilities: e.target.value })}
              className="w-full h-20 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-teamColor transition-all font-medium text-sm resize-none"
              placeholder="Autonomous capabilities..." />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Teleop / Endgame</label>
            <textarea value={pitForm.teleopCapabilities} onChange={(e) => setPitForm({ ...pitForm, teleopCapabilities: e.target.value })}
              className="w-full h-20 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-teamColor transition-all font-medium text-sm resize-none"
              placeholder="Teleop and endgame capabilities..." />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Strengths</label>
            <TagInput value={pitForm.strengths} onChange={(v) => setPitForm({ ...pitForm, strengths: v })} placeholder="Add strength..." />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Weaknesses</label>
            <TagInput value={pitForm.weaknesses} onChange={(v) => setPitForm({ ...pitForm, weaknesses: v })} placeholder="Add weakness..." />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notes</label>
            <textarea value={pitForm.notes} onChange={(e) => setPitForm({ ...pitForm, notes: e.target.value })}
              className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-teamColor transition-all font-medium text-sm resize-none"
              placeholder="Additional observations..." />
          </div>

          <div className="space-y-2">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Robot Photo</span>
            {pitForm.photoUrl && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 mb-2">
                <img src={pitForm.photoUrl} alt="Robot" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setPitForm({ ...pitForm, photoUrl: '' }); setToaPhotoMsg(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center justify-center gap-2 flex-1 py-3 bg-slate-50 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-teamColor hover:bg-teamColor/5 dark:bg-slate-700 transition-all">
                <Camera size={16} className="text-slate-400 dark:text-slate-500" />
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {pitForm.photoUrl ? 'Change Photo' : 'Take / Upload Photo'}
                </span>
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const dataUrl = await compressImage(file);
                        setPitForm({ ...pitForm, photoUrl: dataUrl });
                        setToaPhotoMsg(null);
                      } catch (err) { console.error('Failed to process image:', err); }
                    }
                  }} />
              </label>
              {isFtcEvent && onFetchToaPhoto && (
                <button
                  type="button"
                  onClick={handleFetchToaPhoto}
                  disabled={toaPhotoLoading || !pitForm.teamNumber}
                  className="flex items-center gap-2 px-3 py-3 text-xs font-black uppercase tracking-widest border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl hover:border-teamColor hover:bg-teamColor/5 dark:bg-slate-700 transition-all disabled:opacity-50 text-slate-400 dark:text-slate-500"
                >
                  {toaPhotoLoading ? <Loader2 size={15} className="animate-spin" /> : <Image size={15} />}
                  Fetch from TOA
                </button>
              )}
            </div>
            {toaPhotoMsg && (
              <p className={`text-xs font-bold ${toaPhotoMsg.includes('loaded') ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {toaPhotoMsg}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <RatingSlider value={pitForm.offenseRating} onChange={(v) => setPitForm({ ...pitForm, offenseRating: v })} label="Offense Rating" />
            <RatingSlider value={pitForm.defenseRating} onChange={(v) => setPitForm({ ...pitForm, defenseRating: v })} label="Defense Rating" />
            <RatingSlider value={pitForm.overallRating} onChange={(v) => setPitForm({ ...pitForm, overallRating: v })} label="Overall Rating" />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Alliance Preference</label>
            <StarRating value={pitForm.coreValuesRating} onChange={(v) => setPitForm({ ...pitForm, coreValuesRating: v })} label="Alliance Interest" max={3} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 rounded-[24px] font-black uppercase tracking-widest text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
              Cancel
            </button>
            <button type="button" onClick={onSave}
              className="flex-1 py-3 bg-teamColor text-white rounded-[24px] font-black uppercase tracking-widest text-sm hover:opacity-90 transition-all">
              {editingPit ? 'Update' : 'Save Scout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PitScoutForm;
