import { useMemo } from 'react';
import { useDirection } from '@/contexts/DirectionContext';

export interface Labels {
  // Navigation
  next: string;
  previous: string;
  prev: string;
  // Actions
  done: string;
  undo: string;
  copy: string;
  copied: string;
  // Quiz / Assessment
  correct: string;
  tryAgain: string;
  review: string;
  missed: string;
  // Flashcards
  gotIt: string;
  reviewAgain: string;
  cardsReviewed: string;
  // Code explorer
  showAll: string;
  stepThrough: string;
  // Exercise
  formCue: string;
  hideFormCue: string;
  duration: string;
  equipment: string;
  completeSet: string;
  workoutComplete: string;
  allSetsFinished: string;
  // Comparison
  description: string;
  example: string;
  goForIt: string;
  // Overview
  level: string;
  items: string;
  // Verdict
  price: string;
  score: string;
}

const EN: Labels = {
  next: 'Next',
  previous: 'Previous',
  prev: 'Prev',
  done: 'Done',
  undo: 'Undo',
  copy: 'Copy',
  copied: 'Copied',
  correct: 'Correct',
  tryAgain: 'Try Again',
  review: 'Review',
  missed: 'missed',
  gotIt: 'Got it!',
  reviewAgain: 'Review again',
  cardsReviewed: 'Cards reviewed',
  showAll: 'Show all',
  stepThrough: 'Step through',
  formCue: 'Form cue',
  hideFormCue: 'Hide form cue',
  duration: 'Duration',
  equipment: 'Equipment',
  completeSet: 'Complete Set',
  workoutComplete: 'Workout complete!',
  allSetsFinished: 'All sets finished. Great effort!',
  description: 'Description',
  example: 'Example',
  goForIt: 'Go for it if...',
  level: 'Level',
  items: 'Items',
  price: 'Price',
  score: 'Score',
};

const TRANSLATIONS: Record<string, Labels> = {
  en: EN,
  he: {
    next: 'הבא',
    previous: 'הקודם',
    prev: 'הקודם',
    done: 'בוצע',
    undo: 'ביטול',
    copy: 'העתק',
    copied: 'הועתק',
    correct: 'נכון',
    tryAgain: 'נסו שוב',
    review: 'סקירה',
    missed: 'שגויות',
    gotIt: 'ידעתי!',
    reviewAgain: 'חזרו שוב',
    cardsReviewed: 'כרטיסים שנסקרו',
    showAll: 'הצג הכל',
    stepThrough: 'צעד אחר צעד',
    formCue: 'טיפ לביצוע',
    hideFormCue: 'הסתר טיפ',
    duration: 'משך',
    equipment: 'ציוד',
    completeSet: 'השלם סט',
    workoutComplete: 'האימון הושלם!',
    allSetsFinished: 'כל הסטים הושלמו. כל הכבוד!',
    description: 'תיאור',
    example: 'דוגמה',
    goForIt: 'שווה את זה אם...',
    level: 'רמה',
    items: 'פריטים',
    price: 'מחיר',
    score: 'ציון',
  },
  ar: {
    next: 'التالي',
    previous: 'السابق',
    prev: 'السابق',
    done: 'تم',
    undo: 'تراجع',
    copy: 'نسخ',
    copied: 'تم النسخ',
    correct: 'صحيح',
    tryAgain: 'حاول مرة أخرى',
    review: 'مراجعة',
    missed: 'خاطئة',
    gotIt: 'فهمت!',
    reviewAgain: 'راجع مرة أخرى',
    cardsReviewed: 'بطاقات تمت مراجعتها',
    showAll: 'عرض الكل',
    stepThrough: 'خطوة بخطوة',
    formCue: 'نصيحة للأداء',
    hideFormCue: 'إخفاء النصيحة',
    duration: 'المدة',
    equipment: 'المعدات',
    completeSet: 'أكمل المجموعة',
    workoutComplete: 'اكتمل التمرين!',
    allSetsFinished: 'تم إنهاء جميع المجموعات. عمل رائع!',
    description: 'الوصف',
    example: 'مثال',
    goForIt: 'اختره إذا...',
    level: 'المستوى',
    items: 'العناصر',
    price: 'السعر',
    score: 'النتيجة',
  },
};

/** Get labels for a given ISO 639-1 language code. Falls back to English. */
export function getLabels(language: string): Labels {
  return TRANSLATIONS[language] ?? EN;
}

/** Hook that returns translated labels based on the current DirectionContext language. */
export function useLabels(): Labels {
  const { language } = useDirection();
  return useMemo(() => getLabels(language), [language]);
}
