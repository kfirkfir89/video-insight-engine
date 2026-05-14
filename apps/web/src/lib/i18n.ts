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
  brief: string;
  keyTakeaways: string;
  continueExploring: string;
  highlights: string;
  moreTakeaways: string;
  tips: string;
  // Verdict
  price: string;
  score: string;
  // Tab preview tooltips (keyed by TabEntry.id). Keys the app currently
  // ships are listed in EN below; callers fall back gracefully when a key
  // is absent, so translators can stage coverage incrementally.
  tabPreviews: Record<string, string>;
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
  brief: 'Brief',
  keyTakeaways: 'Key takeaways',
  continueExploring: 'Continue exploring',
  highlights: 'Highlights',
  moreTakeaways: 'More takeaways',
  tips: 'Tips',
  price: 'Price',
  score: 'Score',
  tabPreviews: {
    key_points: 'Essential takeaways from the video',
    concepts: 'Core concepts explained with examples',
    takeaways: 'Action items and insights',
    timestamps: 'Navigate to key moments in the video',
    quizzes: 'Test your understanding with questions',
    flashcards: 'Flip cards to memorize key facts',
    scenarios: 'Branching what-would-you-do situations',
    overview: 'A high-level summary',
    setup: 'Setup and installation steps',
    code: 'Code snippets with explanations',
    patterns: 'Patterns and best practices',
    cheat_sheet: 'Quick reference',
    exercises: 'Step-by-step exercise instructions',
    timer: 'Timed workout guidance',
    tips: 'Tips and technique pointers',
    ingredients: 'Full ingredients list with scaling',
    steps: 'Step-by-step recipe instructions',
    analysis: 'Musical analysis and structure',
    structure: 'Song structure breakdown',
    lyrics: 'Synced lyrics with timestamps',
    credits: 'Credits and attributions',
    itinerary: 'Day-by-day trip plan',
    packing: 'Packing checklist',
    budget: 'Cost breakdown',
    verdict: 'Final verdict and scoring',
    pros_cons: 'Pros and cons side by side',
    specs: 'Specifications and features',
    materials: 'Materials needed',
    tools: 'Tools required',
    safety: 'Safety considerations',
    key_moments: 'Pivotal moments',
    quotes: 'Memorable quotes',
    phrases: 'Useful phrases with translations',
    rules: 'Grammar rules explained',
    drills: 'Practice exercises',
    vocabulary: 'Vocabulary cards',
    key_facts: 'Verified facts',
    experiments: 'Experiments and demonstrations',
  },
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
    brief: 'תקציר',
    keyTakeaways: 'תובנות מפתח',
    continueExploring: 'המשיכו לחקור',
    highlights: 'נקודות בולטות',
    moreTakeaways: 'תובנות נוספות',
    tips: 'טיפים',
    price: 'מחיר',
    score: 'ציון',
    tabPreviews: {
      key_points: 'נקודות מפתח מהסרטון',
      concepts: 'מושגי ליבה מוסברים עם דוגמאות',
      takeaways: 'תובנות ופעולות מעשיות',
      timestamps: 'נווטו לרגעים חשובים בסרטון',
      quizzes: 'בחנו את ההבנה שלכם עם שאלות',
      flashcards: 'הפכו כרטיסים כדי לזכור עובדות מפתח',
      scenarios: 'תרחישים מסתעפים של מה-הייתם-עושים',
      overview: 'סיכום כללי',
      setup: 'שלבי התקנה והגדרה',
      code: 'קטעי קוד עם הסברים',
      patterns: 'דפוסים ופרקטיקות מומלצות',
      cheat_sheet: 'מדריך מהיר',
      exercises: 'הוראות תרגיל צעד אחר צעד',
      timer: 'אימון מתוזמן',
      tips: 'טיפים והנחיות טכניות',
      ingredients: 'רשימת מרכיבים מלאה עם התאמה',
      steps: 'שלבי מתכון מפורטים',
      analysis: 'ניתוח ומבנה מוזיקלי',
      structure: 'פירוק מבנה השיר',
      lyrics: 'מילים מסונכרנות עם חותמות זמן',
      credits: 'קרדיטים וייחוסים',
      itinerary: 'תוכנית טיול יום אחר יום',
      packing: 'רשימת אריזה',
      budget: 'פירוט עלויות',
      verdict: 'פסק דין וציון סופי',
      pros_cons: 'יתרונות וחסרונות זה מול זה',
      specs: 'מפרטים ותכונות',
      materials: 'חומרים נדרשים',
      tools: 'כלים נדרשים',
      safety: 'שיקולי בטיחות',
      key_moments: 'רגעים מכריעים',
      quotes: 'ציטוטים בלתי נשכחים',
      phrases: 'ביטויים שימושיים עם תרגום',
      rules: 'כללי דקדוק מוסברים',
      drills: 'תרגולים',
      vocabulary: 'כרטיסי אוצר מילים',
      key_facts: 'עובדות מאומתות',
      experiments: 'ניסויים והדגמות',
    },
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
    brief: 'موجز',
    keyTakeaways: 'النقاط الرئيسية',
    continueExploring: 'تابع الاستكشاف',
    highlights: 'أبرز النقاط',
    moreTakeaways: 'نقاط إضافية',
    tips: 'نصائح',
    price: 'السعر',
    score: 'النتيجة',
    tabPreviews: {
      key_points: 'النقاط الرئيسية من الفيديو',
      concepts: 'المفاهيم الأساسية مع أمثلة',
      takeaways: 'رؤى وإجراءات عملية',
      timestamps: 'التنقل إلى اللحظات المهمة',
      quizzes: 'اختبر فهمك مع أسئلة',
      flashcards: 'اقلب البطاقات لحفظ الحقائق',
      scenarios: 'سيناريوهات متفرعة "ماذا لو"',
      overview: 'نظرة عامة موجزة',
      setup: 'خطوات الإعداد والتثبيت',
      code: 'مقتطفات برمجية مع شرح',
      patterns: 'أنماط وأفضل الممارسات',
      cheat_sheet: 'مرجع سريع',
      exercises: 'تعليمات تمارين مفصلة',
      timer: 'تدريب موقوت',
      tips: 'نصائح وإرشادات تقنية',
      ingredients: 'قائمة المكونات الكاملة مع التعديل',
      steps: 'خطوات الوصفة بالتفصيل',
      analysis: 'تحليل وبنية موسيقية',
      structure: 'تفصيل بنية الأغنية',
      lyrics: 'كلمات متزامنة مع الوقت',
      credits: 'الإسناد والاعتمادات',
      itinerary: 'خطة رحلة يوماً بيوم',
      packing: 'قائمة التعبئة',
      budget: 'تفصيل التكاليف',
      verdict: 'الحكم النهائي والتقييم',
      pros_cons: 'المزايا والعيوب جنباً إلى جنب',
      specs: 'المواصفات والميزات',
      materials: 'المواد المطلوبة',
      tools: 'الأدوات المطلوبة',
      safety: 'اعتبارات السلامة',
      key_moments: 'اللحظات المحورية',
      quotes: 'اقتباسات لا تُنسى',
      phrases: 'عبارات مفيدة مع الترجمة',
      rules: 'قواعد نحوية موضحة',
      drills: 'تمارين تدريبية',
      vocabulary: 'بطاقات المفردات',
      key_facts: 'حقائق موثقة',
      experiments: 'تجارب ومشاهدات',
    },
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
