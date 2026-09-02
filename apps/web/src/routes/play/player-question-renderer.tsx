import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { TextArea } from '../../components/ui/form-field';
import { playerApi } from '../../data/api-client/endpoints';
import type { PlayerQuestion } from '../../types/sessions';
import { StudentAudioPlayer } from './student-audio-player';
import { StudentButton } from './student-ui';

export type AnswerState = 'editing' | 'saving' | 'saved';

export function QuestionMedia({
  joinCode,
  attemptId,
  mediaId,
  questionType,
  presentation,
}: {
  joinCode: string;
  attemptId: string;
  mediaId: string;
  questionType: PlayerQuestion['questionType'];
  presentation: 'student' | 'live';
}) {
  const url = playerApi.mediaUrl(joinCode, attemptId, mediaId);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  if (questionType === 'Listening') {
    if (presentation === 'student') return <StudentAudioPlayer src={url} />;
    return (
      <div>
        <audio controls preload="metadata" src={url} onError={() => setPlaybackFailed(true)} className="w-full" data-testid="question-media-audio">
          المتصفح لا يدعم تشغيل الصوت.
        </audio>
        {playbackFailed ? <p role="alert" className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">تعذر تشغيل الصوت. أعد تحميل الصفحة، وإن استمرت المشكلة فأبلغ مسؤول النشاط.</p> : null}
      </div>
    );
  }
  return <img src={url} alt="وسيط مرفق بالسؤال" loading="lazy" className={presentation === 'student' ? 'max-h-80 w-full rounded-xl bg-slate-50 object-contain' : 'max-h-64 w-full rounded-lg object-contain'} data-testid="question-media-image" />;
}

function StudentSaveControl({ answerState, label, disabled, type, onClick }: { answerState: AnswerState; label: string; disabled: boolean; type: 'button' | 'submit'; onClick?: () => void }) {
  if (answerState === 'saved') return <p role="status" className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 sm:w-48 sm:self-start">تم حفظ إجابتك ✓</p>;
  const isSaving = answerState === 'saving';
  return <StudentButton type={type} disabled={disabled || isSaving} onClick={onClick} className="mt-2 w-full sm:w-48 sm:self-start">{isSaving ? 'جارٍ الحفظ…' : label}</StudentButton>;
}

export function AnswerEditor({ question, answerState, presentation, onSubmit }: { question: PlayerQuestion; answerState: AnswerState; presentation: 'student' | 'live'; onSubmit: (answerJson: string) => void }) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [ordered, setOrdered] = useState<string[]>(() => question.options.map((option) => option.optionId));
  const type = question.questionType;
  const isStudent = presentation === 'student';
  const disabled = answerState !== 'editing';

  if (type === 'MultipleChoice' || type === 'TrueFalse' || type === 'Listening') {
    return (
      <fieldset className={`flex flex-col ${isStudent ? 'gap-3' : 'gap-2'}`}>
        <legend className="sr-only">اختر إجابة</legend>
        {question.options.map((option, index) => {
          const optionDirection = /[\u0600-\u06ff]/.test(option.optionText) ? 'rtl' : 'ltr';
          return (
            <label key={option.optionId} dir={isStudent ? optionDirection : undefined} className={`flex cursor-pointer items-center gap-3 border transition-[background-color,border-color,color,transform] duration-200 focus-within:outline-2 focus-within:outline-offset-2 ${isStudent ? 'min-h-16 rounded-xl p-4 text-base focus-within:outline-emerald-700' : 'min-h-11 rounded-lg p-3 text-sm focus-within:outline-sky-600'} ${selectedOption === option.optionId ? isStudent ? 'border-emerald-700 bg-emerald-50 text-emerald-950 shadow-[0_2px_8px_rgb(5_150_105/0.16)]' : 'border-sky-500 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-800 hover:border-emerald-500'} ${disabled ? 'cursor-default opacity-60' : 'active:translate-y-px'}`}>
              <input type="radio" name={`q-${question.quizVersionItemId}`} value={option.optionId} checked={selectedOption === option.optionId} disabled={disabled} onChange={() => setSelectedOption(option.optionId)} className={isStudent ? 'sr-only' : 'h-5 w-5 accent-sky-600'} />
              {isStudent ? <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black ${selectedOption === option.optionId ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-slate-50 text-slate-600'}`}>{String.fromCharCode(65 + index)}</span> : null}
              <span className="min-w-0 flex-1 text-start font-semibold">{option.optionText}</span>
              {isStudent && selectedOption === option.optionId ? <span aria-hidden="true" className="text-lg font-black text-emerald-700">✓</span> : null}
            </label>
          );
        })}
        {isStudent ? <StudentSaveControl answerState={answerState} label="تثبيت الإجابة" disabled={!selectedOption} type="button" onClick={() => onSubmit(JSON.stringify({ optionId: selectedOption }))} /> : <Button type="button" disabled={disabled || !selectedOption} onClick={() => onSubmit(JSON.stringify({ optionId: selectedOption }))}>تثبيت الإجابة</Button>}
      </fieldset>
    );
  }

  if (type === 'ShortAnswer') {
    return (
      <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); if (text.trim().length >= 2) onSubmit(JSON.stringify({ text: text.trim() })); }}>
        <TextArea value={text} onChange={(event) => setText(event.target.value)} minLength={2} maxLength={4000} rows={3} disabled={disabled} placeholder="اكتب إجابتك هنا" aria-label="إجابتك" className={isStudent ? 'min-h-36 rounded-xl p-4 text-base leading-7 placeholder:text-slate-500 focus:border-emerald-700 focus:outline-emerald-700' : ''} />
        {isStudent ? <StudentSaveControl answerState={answerState} label="تثبيت الإجابة" disabled={text.trim().length < 2} type="submit" /> : <Button type="submit" disabled={disabled || text.trim().length < 2}>تثبيت الإجابة</Button>}
      </form>
    );
  }

  return (
    <div className={`flex flex-col ${isStudent ? 'gap-3' : 'gap-2'}`}>
      <p className={isStudent ? 'text-sm font-semibold text-slate-700' : 'text-xs text-slate-500'}>رتّب العناصر بالترتيب الصحيح:</p>
      <ol className={`flex flex-col ${isStudent ? 'gap-3' : 'gap-2'}`}>
        {ordered.map((optionId, index) => {
          const option = question.options.find((item) => item.optionId === optionId);
          return (
            <li key={optionId} className={`flex items-center gap-2 border border-slate-300 bg-white ${isStudent ? 'min-h-16 rounded-xl p-3' : 'min-h-11 rounded-lg p-2'}`}>
              <span className={`text-center font-mono text-sm font-bold ${isStudent ? 'flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700' : 'w-6 text-slate-500'}`}>{index + 1}</span>
              <span dir="auto" className={`flex-1 text-slate-800 ${isStudent ? 'text-base font-semibold' : 'text-sm'}`}>{option?.optionText ?? optionId}</span>
              <div className="flex gap-1">
                <button type="button" aria-label={`أنقل "${option?.optionText ?? ''}" للأعلى`} disabled={disabled || index === 0} onClick={() => setOrdered((previous) => { const next = [...previous]; const before = next[index - 1]; const current = next[index]; if (before !== undefined && current !== undefined) { next[index - 1] = current; next[index] = before; } return next; })} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-40">↑</button>
                <button type="button" aria-label={`أنقل "${option?.optionText ?? ''}" للأسفل`} disabled={disabled || index === ordered.length - 1} onClick={() => setOrdered((previous) => { const next = [...previous]; const current = next[index]; const after = next[index + 1]; if (current !== undefined && after !== undefined) { next[index] = after; next[index + 1] = current; } return next; })} className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-40">↓</button>
              </div>
            </li>
          );
        })}
      </ol>
      {isStudent ? <StudentSaveControl answerState={answerState} label="تثبيت الترتيب" disabled={false} type="button" onClick={() => onSubmit(JSON.stringify({ orderedOptionIds: ordered }))} /> : <Button type="button" disabled={disabled} onClick={() => onSubmit(JSON.stringify({ orderedOptionIds: ordered }))}>تثبيت الترتيب</Button>}
    </div>
  );
}
