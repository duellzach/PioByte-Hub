import React from 'react';
import { X, Camera } from 'lucide-react';
import { RatingSlider, StarRating, TagInput } from './shared';

interface PitScoutFormProps {
  show: boolean;
  editingPit: any | null;
  pitForm: any;
  setPitForm: (f: any) => void;
  onClose: () => void;
  onSave: () => void;
  compressImage: (file: File) => Promise<string>;
}

const PitScoutForm: React.FC<PitScoutFormProps> = ({
  show, editingPit, pitForm, setPitForm, onClose, onSave, compressImage,
}) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-auto p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team Number *</span>
              <input
                type="number"
                value={pitForm.teamNumber || ''}
                onChange={(e) => setPitForm({ ...pitForm, teamNumber: parseInt(e.target.value) || 0 })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-black text-lg"
                placeholder="10991"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team Name</span>
              <input
                value={pitForm.teamName}
                onChange={(e) => setPitForm({ ...pitForm, teamName: e.target.value })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                placeholder="Team Name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Robot Name</span>
              <input
                value={pitForm.robotName}
                onChange={(e) => setPitForm({ ...pitForm, robotName: e.target.value })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                placeholder="Robot Name"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Drivetrain</span>
              <select
                value={pitForm.drivetrain}
                onChange={(e) => setPitForm({ ...pitForm, drivetrain: e.target.value })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
              >
                <option value="">Select...</option>
                <option value="Swerve">Swerve</option>
                <option value="Tank">Tank</option>
                <option value="Mecanum">Mecanum</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Weight (lbs)</span>
              <input type="number" value={pitForm.weight || ''} onChange={(e) => setPitForm({ ...pitForm, weight: parseInt(e.target.value) || 0 })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm" />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Speed (ft/s)</span>
              <input type="number" value={pitForm.speed || ''} onChange={(e) => setPitForm({ ...pitForm, speed: parseInt(e.target.value) || 0 })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm" />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Height (in)</span>
              <input type="number" value={pitForm.height || ''} onChange={(e) => setPitForm({ ...pitForm, height: parseInt(e.target.value) || 0 })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fuel Capacity</span>
              <input type="number" value={pitForm.fuelCapacity || ''} onChange={(e) => setPitForm({ ...pitForm, fuelCapacity: parseInt(e.target.value) || 0 })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                placeholder="0" min={0} />
            </div>
            <div className="col-span-2 space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Shooter Type</span>
              <div className="flex gap-2">
                {['Turret', 'Launcher', 'None'].map(t => (
                  <button key={t} type="button"
                    onClick={() => setPitForm({ ...pitForm, shooterType: pitForm.shooterType === t ? '' : t })}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      pitForm.shooterType === t ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Field Traversal</span>
            <div className="grid grid-cols-4 gap-2">
              {['Over Bump', 'Under Trench', 'Both', 'Neither'].map(t => (
                <button key={t} type="button"
                  onClick={() => setPitForm({ ...pitForm, traversalAbility: pitForm.traversalAbility === t ? '' : t })}
                  className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    pitForm.traversalAbility === t ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          <TagInput tags={pitForm.autoOptions} onChange={(tags) => setPitForm({ ...pitForm, autoOptions: tags })}
            label="Auto Options (list all autonomous routines available)" placeholder="e.g. 2-piece, center, far side... press Enter" />
          <TagInput tags={pitForm.capabilities} onChange={(tags) => setPitForm({ ...pitForm, capabilities: tags })}
            label="Capabilities" placeholder="e.g. Shooter, Climber, Intake..." />
          <TagInput tags={pitForm.deficiencies} onChange={(tags) => setPitForm({ ...pitForm, deficiencies: tags })}
            label="Deficiencies" placeholder="e.g. Slow, Tipping..." />

          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notes</span>
            <textarea value={pitForm.notes} onChange={(e) => setPitForm({ ...pitForm, notes: e.target.value })}
              className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-medium text-sm resize-none"
              placeholder="Additional observations..." />
          </div>

          <div className="space-y-2">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Robot Photo</span>
            {pitForm.photoUrl && (
              <div className="relative w-full h-48 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 mb-2">
                <img src={pitForm.photoUrl} alt="Robot" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPitForm({ ...pitForm, photoUrl: '' })}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all">
                  <X size={14} />
                </button>
              </div>
            )}
            <label className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-red-600 hover:bg-red-50/30 dark:bg-slate-700 transition-all">
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
                    } catch (err) { console.error('Failed to process image:', err); }
                  }
                }} />
            </label>
          </div>

          <div className="space-y-4">
            <RatingSlider value={pitForm.offenseRating} onChange={(v) => setPitForm({ ...pitForm, offenseRating: v })} label="Offense Rating" />
            <RatingSlider value={pitForm.defenseRating} onChange={(v) => setPitForm({ ...pitForm, defenseRating: v })} label="Defense Rating" />
            <RatingSlider value={pitForm.overallRating} onChange={(v) => setPitForm({ ...pitForm, overallRating: v })} label="Overall Rating" />
          </div>

          <StarRating value={pitForm.coreValuesRating} onChange={(v) => setPitForm({ ...pitForm, coreValuesRating: v })} max={5} label="FIRST Core Values Rating" />

          <button onClick={onSave} disabled={!pitForm.teamNumber}
            className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-red-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {editingPit ? 'Update Robot' : 'Save Robot'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PitScoutForm;
