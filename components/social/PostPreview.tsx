import React, { useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, ThumbsUp, Share2, Film, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SocialMediaDto } from '../../services/api';
import { InstagramIcon, FacebookIcon } from './common';
import { useTeamSettings } from '../../contexts/TeamSettingsContext';

type PreviewMedia = Pick<SocialMediaDto, 'kind' | 'url' | 'width' | 'height'>;

/** An approximate mock of how the post will look — so students (and the
 *  approving coach) see cropping, carousel order and caption truncation. */
const PostPreview: React.FC<{ caption: string; media: PreviewMedia[]; platforms: string[] }> = ({ caption, media, platforms }) => {
  const { settings } = useTeamSettings();
  const [which, setWhich] = useState<'instagram' | 'facebook'>(platforms.includes('instagram') ? 'instagram' : 'facebook');
  const [slide, setSlide] = useState(0);
  const active = platforms.includes(which) ? which : (platforms[0] as 'instagram' | 'facebook') || 'instagram';
  const handle = String(settings.teamName || 'team').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const current = media[Math.min(slide, media.length - 1)];
  const ratio = (m?: PreviewMedia) => {
    if (!m?.width || !m?.height) return '4 / 5';
    return `${m.width} / ${m.height}`;
  };

  const MediaBox = () => (
    media.length === 0 ? null : (
      <div className="relative bg-black" style={{ aspectRatio: active === 'instagram' ? ratio(media[0]) : undefined }}>
        {current?.kind === 'video'
          ? <video key={current.url} src={current.url} className="w-full h-full object-cover" muted playsInline controls preload="metadata" />
          : <img src={current?.url} alt="" className="w-full h-full object-cover" />}
        {media.length > 1 && (
          <>
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">{slide + 1}/{media.length}</span>
            {slide > 0 && <button type="button" onClick={() => setSlide(slide - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center" aria-label="Previous"><ChevronLeft size={16} /></button>}
            {slide < media.length - 1 && <button type="button" onClick={() => setSlide(slide + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center" aria-label="Next"><ChevronRight size={16} /></button>}
          </>
        )}
        {media.length === 1 && current?.kind === 'video' && active === 'instagram' && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center gap-1"><Film size={10} /> Reel</span>
        )}
      </div>
    )
  );

  return (
    <div>
      {platforms.length > 1 && (
        <div className="flex gap-1 mb-3 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl w-fit">
          {(['instagram', 'facebook'] as const).filter((p) => platforms.includes(p)).map((p) => (
            <button key={p} type="button" onClick={() => setWhich(p)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${active === p ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>
              {p === 'instagram' ? <InstagramIcon size={12} /> : <FacebookIcon size={12} />} {p === 'instagram' ? 'Instagram' : 'Facebook'}
            </button>
          ))}
        </div>
      )}
      <div className="max-w-sm mx-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-white text-slate-900 shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-teamColor/20 text-teamColor flex items-center justify-center text-[10px] font-black">{String(settings.teamNumber || '').slice(0, 4)}</div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold leading-tight truncate">{active === 'instagram' ? handle : settings.teamName}</p>
            {active === 'facebook' && <p className="text-[11px] text-slate-500 leading-tight">Just now · 🌐</p>}
          </div>
        </div>
        {active === 'facebook' && caption && <p className="px-3 pb-2 text-[13px] whitespace-pre-wrap break-words">{caption}</p>}
        <MediaBox />
        {active === 'instagram' ? (
          <div className="px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-3.5"><Heart size={20} /><MessageCircle size={20} /><Send size={20} /><Bookmark size={20} className="ml-auto" /></div>
            {caption && (
              <p className="text-[13px] whitespace-pre-wrap break-words line-clamp-3"><span className="font-bold mr-1">{handle}</span>{caption}</p>
            )}
          </div>
        ) : (
          <div className="flex justify-around py-2 border-t border-slate-100 text-slate-500 text-[12px] font-semibold">
            <span className="flex items-center gap-1.5"><ThumbsUp size={15} /> Like</span>
            <span className="flex items-center gap-1.5"><MessageCircle size={15} /> Comment</span>
            <span className="flex items-center gap-1.5"><Share2 size={15} /> Share</span>
          </div>
        )}
      </div>
      <p className="text-center text-[10px] text-slate-400 font-bold mt-2">Approximate preview</p>
    </div>
  );
};

export default PostPreview;
