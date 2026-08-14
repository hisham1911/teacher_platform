import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { FormField, TextArea, TextInput } from '../../components/ui/form-field';
import { mediaApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import {
  MEDIA_ACCEPT,
  QUESTION_TYPE_LABELS,
  type QuestionOptionInput,
  type QuestionType,
} from '../../types/questions';
import { MediaContentPreview } from './media-content-preview';
import { validateQuestionDraft } from './question-draft-validation';

export interface QuestionFormValue {
  questionType: QuestionType;
  prompt: string;
  explanation: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  language: 'ar' | 'en';
  mediaAssetId: string | null;
  tags: string[];
  options: QuestionOptionInput[];
  acceptedAnswers: string[];
}

interface QuestionFormErrors {
  prompt?: string;
  options?: string;
  acceptedAnswers?: string;
  media?: string;
  api?: string;
}

interface QuestionFormProps {
  tenantId: string;
  /** عند الإنشاء: null. عند التعديل: القيمة الحالية للنسخة الحالية. */
  initialValue?: Partial<QuestionFormValue>;
  /** النوع غير قابل للتغيير عند التعديل (نسخة جديدة تحافظ على نوع السؤال الأصلي). */
  typeLocked?: boolean;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (value: QuestionFormValue) => void;
}

/** نموذج سؤال مركب حسب النوع — يتحقق محليًا قبل الإرسال ثم يستند لتحقق الـAPI النهائي. */
export function QuestionForm({
  tenantId,
  initialValue,
  typeLocked = false,
  submitLabel,
  isPending,
  onSubmit,
}: QuestionFormProps) {
  const [questionType, setQuestionType] = useState<QuestionType>(
    initialValue?.questionType ?? 'MultipleChoice',
  );
  const [prompt, setPrompt] = useState(initialValue?.prompt ?? '');
  const [explanation, setExplanation] = useState(initialValue?.explanation ?? '');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>(
    initialValue?.difficulty ?? 'Medium',
  );
  const [language, setLanguage] = useState<'ar' | 'en'>(initialValue?.language ?? 'ar');
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(initialValue?.mediaAssetId ?? null);
  const [uploadedKind, setUploadedKind] = useState<'Image' | 'Audio' | null>(null);
  const [tagsInput, setTagsInput] = useState((initialValue?.tags ?? []).join(', '));
  const [options, setOptions] = useState<QuestionOptionInput[]>(
    initialValue?.options ?? defaultOptionsFor(initialValue?.questionType ?? 'MultipleChoice'),
  );
  const [acceptedAnswersInput, setAcceptedAnswersInput] = useState(
    (initialValue?.acceptedAnswers ?? []).join('\n'),
  );
  const [errors, setErrors] = useState<QuestionFormErrors>({});
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => mediaApi.upload(tenantId, file),
    onSuccess: (asset) => {
      setMediaAssetId(asset.id);
      setUploadedKind(asset.kind);
      setErrors((e) => ({ ...e, media: undefined }));
    },
    onError: (error, file) => {
      setMediaAssetId(null);
      setUploadedKind(null);
      const body = error instanceof HttpError
        ? error.body as { detail?: string; title?: string } | null
        : null;
      setErrors((e) => ({
        ...e,
        media:
          error instanceof HttpError && error.status === 413
            ? 'الملف أكبر من الحد المسموح (5MB صور / 20MB صوت).'
            : error instanceof HttpError && error.status === 400
              ? file.name.toLowerCase().endsWith('.wav')
                ? 'ملف WAV مضغوط أو غير صالح. حوّله إلى WAV PCM غير مضغوط، أو استخدم MP3 أو M4A، ثم أعد المحاولة.'
                : body?.detail ?? 'نوع الملف غير مدعوم. استخدم JPEG/PNG/WebP للصور أو MP3/M4A/WAV PCM غير مضغوط للصوت.'
              : 'تعذر رفع الملف. أعد المحاولة.',
      }));
    },
    onSettled: () => setIsUploading(false),
  });

  function switchType(next: QuestionType) {
    setQuestionType(next);
    setOptions(defaultOptionsFor(next));
    setMediaAssetId(null);
    setUploadedKind(null);
    setSelectedMedia(null);
    setAcceptedAnswersInput('');
  }

  function onMediaSelected(file: File | null) {
    if (!file) {
      return;
    }
    setSelectedMedia(file);
    setIsUploading(true);
    uploadMutation.mutate(file);
  }

  function validateLocal(): boolean {
    const acceptedAnswers = acceptedAnswersInput
      .split('\n')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const draftErrors = validateQuestionDraft(
      {
        questionType,
        prompt,
        options,
        acceptedAnswers,
        mediaAssetId,
      },
      {
        promptRequired: 'نص السؤال مطلوب.',
        promptTooLong: 'نص السؤال أطول من 2000 حرف.',
        optionsCountInvalid: 'يلزم من 2 إلى 10 اختيارات.',
        oneCorrectRequired: 'يجب تحديد إجابة صحيحة واحدة بالضبط.',
        orderingMinItems: 'ترتيب العناصر يتطلب عنصرين على الأقل.',
        acceptedAnswerRequired: 'أضف إجابة واحدة مقبولة على الأقل.',
        listeningRequiresAudio: 'سؤال الاستماع يتطلب ملفًا صوتيًا.',
      },
    );

    setErrors(draftErrors as QuestionFormErrors);
    return Object.keys(draftErrors).length === 0;
  }

  function onSubmitLocal(event: FormEvent) {
    event.preventDefault();
    if (!validateLocal()) {
      return;
    }

    const trimmedOptions = options
      .filter((o) => o.text.trim().length > 0)
      .map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }));

    const acceptedAnswers =
      questionType === 'ShortAnswer'
        ? acceptedAnswersInput.split('\n').map((a) => a.trim()).filter((a) => a.length > 0)
        : [];

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 20);

    if (questionType === 'TrueFalse' && trimmedOptions.length !== 2) {
      // الأمان الإضافي: لا ترسل TrueFalse سوى بخيارين — يغطي أي تلاعب بالواجهة
      setErrors({ options: 'سؤال صح/خطأ يتطلب خيارين بالضبط.' });
      return;
    }

    onSubmit({
      questionType,
      prompt: prompt.trim(),
      explanation: explanation.trim() || null,
      difficulty,
      language,
      mediaAssetId,
      tags,
      options: trimmedOptions,
      acceptedAnswers,
    });
  }

  const isListening = questionType === 'Listening';
  const showMediaPicker = questionType !== 'ShortAnswer';
  const acceptFilter = isListening ? MEDIA_ACCEPT.audio : MEDIA_ACCEPT.image;

  return (
    <form onSubmit={onSubmitLocal} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="q-type" className="text-sm font-medium text-slate-700">نوع السؤال</label>
          <select
            id="q-type"
            value={questionType}
            onChange={(e) => switchType(e.target.value as QuestionType)}
            disabled={typeLocked}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50">
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="q-difficulty" className="text-sm font-medium text-slate-700">الصعوبة</label>
          <select
            id="q-difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="Easy">سهل</option>
            <option value="Medium">متوسط</option>
            <option value="Hard">صعب</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="q-language" className="text-sm font-medium text-slate-700">لغة السؤال</label>
          <select
            id="q-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <FormField id="q-prompt" label="نص السؤال" error={errors.prompt}>
        {(props) => (
          <TextArea
            {...props}
            rows={4}
            dir={language === 'en' ? 'ltr' : 'rtl'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={questionType === 'ShortAnswer' ? 'اكتب السؤال مع ترك فراغ، مثل: I ___ to school every day.' : 'اكتب نص السؤال…'}
          />
        )}
      </FormField>

      {(questionType === 'MultipleChoice' || questionType === 'TrueFalse' || questionType === 'Listening') && (
        <OptionsEditor
          options={options}
          allowAdd={questionType !== 'TrueFalse'}
          onChange={setOptions}
          error={errors.options}
        />
      )}

      {questionType === 'Ordering' && (
        <OrderingEditor options={options} onChange={setOptions} error={errors.options} />
      )}

      {questionType === 'ShortAnswer' && (
        <FormField
          id="q-accepted-answers"
          label="الإجابات المقبولة (سطرًا لكل إجابة — التطابق يتجاهل حالة الأحرف)"
          error={errors.acceptedAnswers}>
          {(props) => (
            <TextArea
              {...props}
              rows={3}
              dir={language === 'en' ? 'ltr' : 'rtl'}
              value={acceptedAnswersInput}
              onChange={(e) => setAcceptedAnswersInput(e.target.value)}
              placeholder={'go\nwent'}
            />
          )}
        </FormField>
      )}

      {showMediaPicker && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4">
          <label htmlFor="q-media" className="mb-2 block text-sm font-medium text-slate-700">
            {isListening ? 'الملف الصوتي (مطلوب)' : 'صورة مرفقة (اختياري)'}
          </label>
          <input
            id="q-media"
            type="file"
            accept={acceptFilter}
            disabled={isUploading}
            onChange={(e) => onMediaSelected(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:me-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:text-sm file:text-white hover:file:bg-slate-700"
          />
          <p className="mt-1 text-xs text-slate-500">
            {isListening ? 'MP3 أو M4A أو WAV PCM غير مضغوط — حد أقصى 20MB.' : 'JPEG أو PNG أو WebP — حد أقصى 5MB. SVG غير مدعوم حاليًا.'}
          </p>
          {selectedMedia ? (
            <p className="mt-2 text-xs text-slate-600">
              الملف المختار: <bdi className="font-semibold">{selectedMedia.name}</bdi> · {formatFileSize(selectedMedia.size)} · {selectedMedia.type || 'نوع غير محدد'}
            </p>
          ) : null}
          {isUploading ? <p role="status" className="mt-2 text-xs text-slate-500">جارٍ رفع الملف وفحصه…</p> : null}
          {errors.media ? (
            <div role="alert" className="mt-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              <p>{errors.media}</p>
              {selectedMedia ? <button type="button" onClick={() => onMediaSelected(selectedMedia)} className="mt-2 min-h-11 rounded-md border border-rose-300 bg-white px-3 font-semibold">إعادة المحاولة</button> : null}
            </div>
          ) : null}

          {mediaAssetId ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
              <p className="mb-2 font-medium text-emerald-800">تم رفع الملف وفحصه بنجاح. اختر ملفًا آخر أعلاه لاستبداله.</p>
              <MediaContentPreview
                tenantId={tenantId}
                mediaId={mediaAssetId}
                kind={uploadedKind ?? (isListening ? 'Audio' : 'Image')}
              />
            </div>
          ) : null}
        </div>
      )}

      <FormField id="q-explanation" label="تفسير الإجابة (اختياري — يظهر بعد التصحيح)">
        {(props) => (
          <TextArea
            {...props}
            rows={2}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        )}
      </FormField>

      <FormField id="q-tags" label="وسوم (تفصل بفواصل — حتى 20)">
        {(props) => (
          <TextInput
            {...props}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="قواعد, وحدة أولى, مفردات"
          />
        )}
      </FormField>

      {errors.api ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{errors.api}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending || isUploading}>
          {isPending ? 'جارٍ الحفظ…' : submitLabel}
        </Button>
      </div>

    </form>
  );
}

function formatFileSize(sizeBytes: number) {
  return sizeBytes < 1024 * 1024
    ? `${Math.max(1, Math.round(sizeBytes / 1024))} كيلوبايت`
    : `${(sizeBytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

function defaultOptionsFor(type: QuestionType): QuestionOptionInput[] {
  if (type === 'TrueFalse') {
    return [
      { text: 'صح', isCorrect: true },
      { text: 'خطأ', isCorrect: false },
    ];
  }

  if (type === 'Ordering') {
    return [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ];
  }

  return [
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ];
}

// ---------- محرر الاختيارات ----------

function OptionsEditor({
  options,
  allowAdd,
  onChange,
  error,
}: {
  options: QuestionOptionInput[];
  allowAdd: boolean;
  onChange: (next: QuestionOptionInput[]) => void;
  error?: string;
}) {
  function update(index: number, patch: Partial<QuestionOptionInput>) {
    const next = options.map((o, i) => {
      if (patch.isCorrect === true && i !== index) {
        return { ...o, isCorrect: false };
      }
      return i === index ? { ...o, ...patch } : o;
    });
    onChange(next);
  }

  function add() {
    onChange([...options, { text: '', isCorrect: false }]);
  }

  function remove(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    const current = next[index];
    const swapWith = next[target];
    if (!current || !swapWith) return;
    next[index] = swapWith;
    next[target] = current;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-700">الاختيارات — حدد إجابة صحيحة واحدة بالضبط:</p>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="radio"
            name="correct-option"
            aria-label={`الإجابة الصحيحة: ${option.text || `اختيار ${index + 1}`}`}
            checked={option.isCorrect}
            onChange={() => update(index, { isCorrect: true })}
            className="h-5 w-5 accent-sky-600"
          />
          <TextInput
            value={option.text}
            onChange={(e) => update(index, { text: e.target.value })}
            placeholder={`نص الاختيار ${index + 1}`}
            className="flex-1"
            aria-label={`نص الاختيار ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => move(index, -1)}
            disabled={index === 0}
            aria-label="تحريك الاختيار للأعلى"
            className="min-h-11 min-w-11 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(index, 1)}
            disabled={index === options.length - 1}
            aria-label="تحريك الاختيار للأسفل"
            className="min-h-11 min-w-11 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            ↓
          </button>
          {allowAdd ? (
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`حذف الاختيار ${index + 1}`}
              className="min-h-11 min-w-11 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50">
              ×
            </button>
          ) : null}
        </div>
      ))}
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      {allowAdd && options.length < 10 ? (
        <button
          type="button"
          onClick={add}
          className="min-h-11 self-start rounded-md border border-dashed border-slate-400 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">
          + إضافة اختيار
        </button>
      ) : null}
    </div>
  );
}

// ---------- محرر ترتيب العناصر ----------

function OrderingEditor({
  options,
  onChange,
  error,
}: {
  options: QuestionOptionInput[];
  onChange: (next: QuestionOptionInput[]) => void;
  error?: string;
}) {
  function update(index: number, text: string) {
    onChange(options.map((o, i) => (i === index ? { ...o, text } : o)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    const current = next[index];
    const swapWith = next[target];
    if (!current || !swapWith) return;
    next[index] = swapWith;
    next[target] = current;
    onChange(next);
  }

  function add() {
    onChange([...options, { text: '', isCorrect: false }]);
  }

  function remove(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-700">عناصر الترتيب — الترتيب المعروض هنا هو الإجابة الصحيحة:</p>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-center text-sm font-mono text-slate-500" aria-label={`الموضع الصحيح ${index + 1}`}>
            {index + 1}
          </span>
          <TextInput
            value={option.text}
            onChange={(e) => update(index, e.target.value)}
            placeholder={`العنصر ${index + 1}`}
            className="flex-1"
            aria-label={`نص العنصر ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => move(index, -1)}
            disabled={index === 0}
            aria-label="تحريك العنصر للأعلى"
            className="min-h-11 min-w-11 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(index, 1)}
            disabled={index === options.length - 1}
            aria-label="تحريك العنصر للأسفل"
            className="min-h-11 min-w-11 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            ↓
          </button>
          <button
            type="button"
            onClick={() => remove(index)}
            disabled={options.length <= 2}
            aria-label={`حذف العنصر ${index + 1}`}
            className="min-h-11 min-w-11 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40">
            ×
          </button>
        </div>
      ))}
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      {options.length < 10 ? (
        <button
          type="button"
          onClick={add}
          className="min-h-11 self-start rounded-md border border-dashed border-slate-400 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">
          + إضافة عنصر
        </button>
      ) : null}
    </div>
  );
}
