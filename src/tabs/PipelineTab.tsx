import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AlertCircle, ExternalLink, Lightbulb, Link2, Plus, Quote, Trash2, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { removeWithUndo } from '../lib/toast';
import type { Board, ContentPiece, Stage } from '../lib/types';
import { cx, maxPos, stripHtml } from '../lib/utils';
import { Kanban } from '../components/Kanban';
import { RichText } from '../components/LazyRichText';
import { Field, Segmented, Sheet } from '../components/ui';

const STAGES = [
  { key: 'idea' as Stage, label: 'Idea bank', color: '#f59e0b' },
  { key: 'drafting' as Stage, label: 'Drafting', color: '#8b5cf6' },
  { key: 'published' as Stage, label: 'Published', color: '#10b981' },
];
type Format = ContentPiece['format'];

function ClaimsLog({ pieceId }: { pieceId: string }) {
  const s = useStore();
  const claims = s.db.content_claims.filter((c) => c.piece_id === pieceId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const cell = 'w-full bg-transparent text-sm outline-none placeholder:text-faint';
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-medium text-mute">Sources & claims log</span>
        <span className="text-xs text-faint">{claims.length}</span>
        <div className="flex-1" />
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => s.insert('content_claims', { piece_id: pieceId, claim: '' })}><Plus size={13} /> Claim</button>
      </div>
      {claims.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-mute">Log every stat you cite: the claim, the number, where it's from, and when.</div>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => {
            const unsourced = !c.source_url?.trim();
            return (
              <div key={c.id} className={cx('rounded-xl border p-3', unsourced ? 'border-amber-500/40' : 'border-line')}>
                <div className="flex items-start gap-2">
                  <Quote size={14} className="mt-1 shrink-0 text-faint" />
                  <textarea rows={1} className={cx(cell, 'resize-none font-medium field-sizing-content')} placeholder="The claim, e.g. Indian SaaS exports will hit $50B by 2030" value={c.claim} onChange={(e) => s.update('content_claims', c.id, { claim: e.target.value })} />
                  <button className="text-faint hover:text-red-500" onClick={() => removeWithUndo('content_claims', c.id, 'Claim removed')} aria-label="Remove claim"><X size={15} /></button>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2 pl-6 sm:grid-cols-[90px_1fr_auto]">
                  <input className={cx(cell, 'rounded-lg bg-panel2 px-2 py-1 font-semibold tabular-nums')} placeholder="Number" value={c.number ?? ''} onChange={(e) => s.update('content_claims', c.id, { number: e.target.value || null })} />
                  <div className="col-span-2 flex min-w-0 items-center gap-1 rounded-lg bg-panel2 px-2 py-1 sm:col-span-1 sm:row-start-1 sm:col-start-2">
                    <Link2 size={13} className="shrink-0 text-faint" />
                    <input className={cell} placeholder="Source URL" value={c.source_url ?? ''} onChange={(e) => s.update('content_claims', c.id, { source_url: e.target.value || null })} />
                    {c.source_url && <a href={/^https?:/.test(c.source_url) ? c.source_url : `https://${c.source_url}`} target="_blank" rel="noreferrer" className="text-faint hover:text-ink"><ExternalLink size={13} /></a>}
                  </div>
                  <input type="date" className="rounded-lg bg-panel2 px-2 py-1 text-xs text-mute outline-none" value={c.source_date ?? ''} onChange={(e) => s.update('content_claims', c.id, { source_date: e.target.value || null })} aria-label="Source date" />
                </div>
                {unsourced && c.claim && <div className="mt-1.5 flex items-center gap-1 pl-6 text-[11px] text-amber-500"><AlertCircle size={11} /> Needs a source before publishing</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PieceEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useStore();
  const p = s.db.content_pieces.find((x) => x.id === id);
  if (!p) return null;
  const up = (patch: Partial<ContentPiece>) => s.update('content_pieces', p.id, patch);
  return (
    <Sheet open onClose={onClose} wide
      title={<Segmented<Stage> value={p.stage} size="sm" onChange={(v) => up({ stage: v, ...(v === 'published' && !p.published_at ? { published_at: format(new Date(), 'yyyy-MM-dd') } : {}) })} options={STAGES.map((x) => ({ value: x.key, label: x.label.replace(' bank', '') }))} />}
      footer={<div className="flex gap-2">
        <button className="btn-ghost text-red-500" onClick={() => { removeWithUndo('content_pieces', p.id, 'Piece deleted'); onClose(); }}><Trash2 size={16} /> Delete</button>
        <div className="flex-1" /><button className="btn-primary" onClick={onClose}>Done</button>
      </div>}>
      <input className="mb-2 w-full bg-transparent text-xl font-semibold outline-none placeholder:text-faint" placeholder="Working title" value={p.title} onChange={(e) => up({ title: e.target.value })} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['post', 'article', 'carousel', 'other'] as Format[]).map((f) => (
          <button key={f} onClick={() => up({ format: f })} className={cx('chip px-2.5 py-1 text-xs capitalize', p.format === f ? 'bg-[var(--accent)] text-white' : 'bg-panel2 text-mute')}>{f}</button>
        ))}
      </div>
      {p.stage === 'published' && (
        <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
          <Field label="Published link"><input className="input" placeholder="linkedin.com/posts/…" value={p.published_url ?? ''} onChange={(e) => up({ published_url: e.target.value || null })} /></Field>
          <Field label="Date"><input type="date" className="input" value={p.published_at ?? ''} onChange={(e) => up({ published_at: e.target.value || null })} /></Field>
        </div>
      )}
      <div className="mb-5 rounded-2xl border border-line px-3">
        <RichText key={p.id} value={p.body} onChange={(html) => up({ body: html })} placeholder="Hook, argument, data, takeaway…" />
      </div>
      <ClaimsLog pieceId={p.id} />
    </Sheet>
  );
}

export default function PipelineTab({ board }: { board: Board }) {
  const s = useStore();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(params.get('piece'));
  const [idea, setIdea] = useState('');
  useEffect(() => { if (params.get('piece')) setParams({ tab: 'pipeline' }, { replace: true }); }, [params, setParams]);
  const pieces = s.db.content_pieces.filter((p) => p.board_id === board.id).sort((a, b) => a.position - b.position);
  const claims = s.db.content_claims;
  const add = () => {
    if (!idea.trim()) return;
    s.insert('content_pieces', { board_id: board.id, title: idea.trim(), position: maxPos(pieces) });
    setIdea('');
  };
  const published = pieces.filter((p) => p.stage === 'published');
  const thisMonth = published.filter((p) => p.published_at?.slice(0, 7) === format(new Date(), 'yyyy-MM')).length;

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {STAGES.map((st) => (
          <div key={st.key} className="card px-3 py-2.5">
            <div className="text-xl font-semibold tabular-nums">{pieces.filter((p) => p.stage === st.key).length}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-mute"><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />{st.label}</div>
          </div>
        ))}
      </div>
      {thisMonth > 0 && <div className="mb-3 px-1 text-xs text-mute">🔥 {thisMonth} published this month</div>}
      <div className="card mb-3 flex items-center gap-2 py-1 pr-1.5 pl-3">
        <Lightbulb size={18} className="text-amber-500" />
        <input className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-faint" placeholder="Capture an idea…" value={idea} onChange={(e) => setIdea(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        {idea && <button className="btn-primary px-2.5 py-1.5" onClick={add}>Add</button>}
      </div>
      <Kanban columns={STAGES} items={pieces} getCol={(p) => p.stage}
        onMove={(p, to) => s.update('content_pieces', p.id, { stage: to, ...(to === 'published' && !p.published_at ? { published_at: format(new Date(), 'yyyy-MM-dd') } : {}) })}
        renderCard={(p) => {
          const cs = claims.filter((c) => c.piece_id === p.id);
          const unsourced = cs.filter((c) => c.claim && !c.source_url).length;
          const words = stripHtml(p.body).split(' ').filter(Boolean).length;
          return (
            <button onClick={() => setOpen(p.id)} className="card block w-full p-3 text-left shadow-sm transition hover:shadow-md">
              <div className="text-sm font-medium">{p.title}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-mute">
                <span className="chip bg-panel2 capitalize">{p.format}</span>
                {words > 0 && <span>{words}w</span>}
                {cs.length > 0 && <span className="flex items-center gap-0.5"><Quote size={10} />{cs.length}</span>}
                {unsourced > 0 && <span className="flex items-center gap-0.5 text-amber-500"><AlertCircle size={10} />{unsourced} unsourced</span>}
                {p.published_at && p.stage === 'published' && <span>{format(parseISO(p.published_at), 'd MMM')}</span>}
              </div>
            </button>
          );
        }} />
      {open && <PieceEditor id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
