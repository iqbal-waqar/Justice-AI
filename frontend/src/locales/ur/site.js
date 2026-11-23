// Urdu for the public website: landing page, about page, blog (posts included).
// Keys are the English text passed to t(); blog posts and modules are keyed by
// their English fields in src/data/site.js, looked up by slug / key so the long
// Markdown bodies always match exactly.
import { POSTS, MODULES } from '../../data/site.js';

const POSTS_UR = {
    'vault-and-billing': {
        title: 'متعارف کروا رہے ہیں: دستاویزی والٹ اور میکر چیکر بلنگ',
        excerpt: 'ہر درخواست، حکم اور ثبوت کو ایک محفوظ (اِنکرپٹڈ) والٹ میں رکھیں، اور اپنے دفتر کا حساب کتاب اس طرح چلائیں کہ ہر روپے پر دوسری نظر بھی ہو۔',
        body: `
تحقیق پریکٹس چلانے کا صرف ایک حصہ ہے۔ فائلیں اور فیسیں باقی دو حصے ہیں — اور یہ عموماً واٹس ایپ چیٹس، ایک مشترکہ ڈرائیو اور کلرک کی میز پر رکھے رجسٹر میں بکھری ہوتی ہیں۔ جسٹس اے آئی اب یہ دونوں کام سنبھالتا ہے۔

### دستاویزی والٹ

- **کلائنٹ اور مقدمے کے لحاظ سے ترتیب۔** ہر فائل اپنے کلائنٹ اور مقدمے کے تحت ایک زمرے کے ساتھ رکھی جاتی ہے: درخواست، حکم، فیصلہ، ثبوت، خط و کتابت، معاہدہ یا شناختی دستاویزات۔
- **محفوظ کرنے سے پہلے اِنکرپشن۔** فائلیں اسٹوریج تک پہنچنے سے پہلے جسٹس اے آئی کے اندر AES-256 سے اِنکرپٹ کی جاتی ہیں، اس لیے اسٹوریج فراہم کنندہ کے پاس صرف ناقابلِ فہم ڈیٹا ہوتا ہے۔ اگر کسی محفوظ فائل میں ردوبدل ہو تو جسٹس اے آئی اسے پکڑ لیتا ہے اور کھولنے سے انکار کر دیتا ہے۔
- **صرف آپ کی فرم اسے کھول سکتی ہے۔** دستاویزات صرف آپ کی فرم کے ارکان کو نظر آتی ہیں، کسی اور کو نہیں۔
- **ہر رسائی کا ریکارڈ۔** اپ لوڈ، دیکھنا، ڈاؤن لوڈ، ترمیم اور حذف — سب کچھ کرنے والے شخص اور وقت کے ساتھ درج ہوتا ہے۔ مالکان اور پارٹنرز یہ ریکارڈ دیکھ سکتے ہیں۔

### بلنگ اور مالیات

- **فیسیں، مقدمے کے اخراجات اور ادائیگیاں** ہر کلائنٹ اور ہر مقدمے کے لحاظ سے روپوں میں درج ہوتی ہیں۔
- **میکر چیکر منظوری۔** دفتر کا کوئی بھی فرد اندراج کر سکتا ہے؛ شمار ہونے سے پہلے مالک یا پارٹنر اسے منظور کرتا ہے۔ کوئی اپنا اندراج خود منظور نہیں کر سکتا، اس لیے اکیلا شخص حساب میں تبدیلی نہیں کر سکتا۔
- **منظوری کے بعد مقفل۔** منظور شدہ اندراجات میں ترمیم نہیں ہو سکتی۔ غلطی کو وجہ لکھ کر اندراج کالعدم کر کے درست کیا جاتا ہے، اور وہ وجہ ریکارڈ پر رہتی ہے۔
- **ایک کلک میں گوشوارہ۔** کسی بھی مدت کے لیے کلائنٹ کا گوشوارۂ حساب پی ڈی ایف میں نکالیں، جس میں ابتدائی بقایا آگے منتقل ہوتا ہے۔

### ٹیموں کے لیے تیار

ساتھیوں کو پارٹنر، ایسوسی ایٹ یا کلرک کے طور پر مدعو کریں۔ سب ایک ہی کلائنٹ فائلوں، دستاویزات اور کھاتے پر کام کرتے ہیں، اور ہر کردار کو وہی اختیارات نظر آتے ہیں جو اس کے لیے موزوں ہیں۔ اکیلے پریکٹس کرنے والے وکلاء خود منظوری کی اجازت دے سکتے ہیں، اور ایسی ہر منظوری پر "خود منظور شدہ" کا نشان لگتا ہے۔
`,
    },
    'ask-in-urdu': {
        title: 'اردو میں پوچھیں، اردو میں جواب پائیں',
        excerpt: 'جسٹس اے آئی اب اردو یا رومن اردو میں لکھے سوالات سمجھتا ہے اور اردو میں جواب دے سکتا ہے — جبکہ ہر حوالہ بالکل ویسا ہی رہتا ہے جیسا عدالت نے رپورٹ کیا۔',
        body: `
بہت سے کلائنٹ اپنا مسئلہ اردو میں بیان کرتے ہیں، اور وکیل کے دن کا بڑا حصہ بھی اردو میں گزرتا ہے۔ جسٹس اے آئی اب اسی طرح کام کرتا ہے۔

### یہ کیسے کام کرتا ہے

- **اپنا سوال اردو** یا رومن اردو میں لکھیں — مثلاً *"489-F mein zamanat kaise milti hai?"*
- جسٹس اے آئی اسے درست قانونی انگریزی میں ترجمہ کرتا ہے، کیونکہ فیصلے خود انگریزی میں رپورٹ ہوتے ہیں، اور پورے ذخیرے میں تلاش کرتا ہے۔
- جواب رسمی اردو میں لکھا جاتا ہے۔ **مقدمات کے نام، حوالے، عدالتوں کے نام اور دفعات کے نمبر انگریزی میں ہی رہتے ہیں**، بالکل ویسے جیسے قانونی رپورٹس میں ہیں، تاکہ آپ انہیں نقل اور تصدیق کر سکیں۔

### جواب کی زبان منتخب کریں

چیٹ میں **English / اردو** کا سوئچ موجود ہے۔ انگریزی پر، اردو رسم الخط میں لکھے سوال کا جواب پھر بھی اردو میں آتا ہے؛ اردو پر، ہر جواب اردو میں آتا ہے — چاہے آپ انگریزی میں پوچھیں۔ اردو متن دائیں سے بائیں، باقاعدہ نستعلیق فونٹ میں دکھایا جاتا ہے۔

### وہی حفاظتی اقدامات

اردو جوابات بھی انہی جانچوں سے گزرتے ہیں جن سے انگریزی جوابات: صرف وہی فیصلے استعمال ہوتے ہیں جو واقعی آپ کے سوال سے متعلق ہوں، اور جو دفعہ نمبر حاصل شدہ متن میں نہ ملے اس پر *(غیر تصدیق شدہ)* کا نشان لگا دیا جاتا ہے۔
`,
    },
    'grounded-answers': {
        title: 'ہر جواب کسی حقیقی فیصلے کا حوالہ کیوں دیتا ہے',
        excerpt: 'عام چیٹ بوٹس فرضی نظائر گھڑ لیتے ہیں۔ یہاں دیکھیں کہ جسٹس اے آئی ایک جملہ لکھنے سے پہلے اپنے ماخذ کیسے جانچتا ہے۔',
        body: `
ضمانت کی درخواست میں ایک فرضی حوالہ، کوئی حوالہ نہ ہونے سے بھی بدتر ہے۔ عام مقصد کے اے آئی معاون معقول لگنے والے فرضی مقدمات گھڑنے کے لیے مشہور ہیں۔ جسٹس اے آئی ایک سادہ اصول پر بنایا گیا ہے: **یہ صرف اسی کا حوالہ دیتا ہے جو اس نے واقعی تلاش کر کے حاصل کیا ہو۔**

### جواب لکھنے سے پہلے تین جانچیں

1. **اصل ریکارڈ میں تلاش۔** آپ کے سوال کا موازنہ سپریم کورٹ، لاہور ہائی کورٹ اور اسلام آباد ہائی کورٹ کے {judgments} رپورٹ شدہ فیصلوں اور {statutes} وفاقی و پنجاب کے قوانین سے کیا جاتا ہے۔
2. **مطابقت کا جائزہ۔** ایک دوسرا ماڈل حاصل شدہ اقتباسات کا جائزہ لیتا ہے اور اسے وہ عین الفاظ نقل کرنے ہوتے ہیں جن سے ثابت ہو کہ ہر فیصلہ آپ کے مسئلے سے متعلق ہے۔ جو دستاویزات محض کوئی لفظ مشترک رکھتی ہوں، نکال دی جاتی ہیں۔
3. **حوالوں کی جانچ۔** جواب لکھے جانے کے بعد ہر دفعہ اور آرٹیکل نمبر کو حاصل شدہ متن سے ملایا جاتا ہے۔ جو وہاں نہ ملے وہ رہتا ہے مگر اس پر *(غیر تصدیق شدہ)* لکھ دیا جاتا ہے، تاکہ آپ جانیں کہ کس چیز کی دوبارہ جانچ کرنی ہے۔

### جب جواب "موجود نہیں" ہو

اگر ذخیرے میں کوئی چیز واقعی آپ کے سوال کا جواب نہ دیتی ہو تو جسٹس اے آئی صاف بتا دیتا ہے اور قریب ترین دستاویزات کی فہرست دیتا ہے — بجائے اس کے کہ فیصلوں سے ایسی باتیں منسوب کرے جو ان میں موجود ہی نہیں۔

### ماخذ تک ایک کلک

ہر حوالہ شدہ فیصلہ عدالت کی اپنی پی ڈی ایف سے منسلک ہے، اس لیے اصل متن صرف ایک کلک کے فاصلے پر ہے۔
`,
    },
    'whatsapp-hearing-reminders': {
        title: 'کوئی پیشی نہ چُھوٹے: واٹس ایپ یاددہانیاں',
        excerpt: 'کیس ڈائری ہر پیشی کو ایک جگہ رکھتی ہے اور ہر تاریخ سے دو دن اور ایک دن پہلے واٹس ایپ پر یاددہانی بھیجتی ہے۔',
        body: `
تحقیق پریکٹس کا صرف آدھا حصہ ہے؛ باقی آدھا یہ ہے کہ صحیح دن صحیح عدالت میں موجود ہوں۔

### کیس ڈائری

مقدمے کے عنوان، نمبر، عدالت، تاریخ اور وقت کے ساتھ پیشی درج کریں۔ ہر پیشی کا **اپنا واٹس ایپ نمبر** ہو سکتا ہے — یہ اس وقت کارآمد ہے جب آپ کے بجائے کسی جونیئر یا کلرک کو یاددہانی ملنی چاہیے۔

### یاددہانیاں

جسٹس اے آئی دن میں کئی بار آپ کی ڈائری دیکھتا ہے اور ہر پیشی سے **دو دن اور ایک دن پہلے** واٹس ایپ اور ای میل پر یاددہانی بھیجتا ہے۔ پیشی کو مکمل قرار دیں تو یاددہانیاں رک جاتی ہیں۔

### نوٹس جو ہر جگہ ساتھ رہیں

مقدمے کے نوٹس آپ کے اکاؤنٹ میں محفوظ ہوتے ہیں، براؤزر میں نہیں، اس لیے جس آلے سے بھی سائن اِن کریں وہ وہاں موجود ہوتے ہیں۔
`,
    },
    'how-search-works': {
        title: 'تلاش کے اندر: درست نظیر کیسے ملتی ہے',
        excerpt: 'لفظی تلاش ہم معنی الفاظ نہیں پکڑتی؛ خالص اے آئی تلاش عین دفعہ نمبر نہیں پکڑتی۔ جسٹس اے آئی دونوں استعمال کرتا ہے، پھر دوبارہ درجہ بندی کرتا ہے۔',
        body: `
وکلاء دو بالکل مختلف طریقوں سے تلاش کرتے ہیں: **عین حوالے** سے ("Section 489-F PPC"، "2023 SCMR 2122") اور **تصور** سے ("ضمانت جہاں مدعی نے ایف آئی آر میں تاخیر کی")۔ ایک اچھے قانونی سرچ انجن کو دونوں سنبھالنے ہوتے ہیں۔

### ہائبرڈ تلاش

- **لفظی مطابقت (BM25)** عین دفعہ نمبر، حوالے اور فریقین کے نام تلاش کرتی ہے۔
- **معنوی تلاش** ایسے فیصلے ڈھونڈتی ہے جو وہی قانونی نکتہ مختلف الفاظ میں بیان کرتے ہیں۔
- دونوں نتائج کی فہرستیں یکجا کی جاتی ہیں، اس لیے جو فیصلہ کسی ایک پہلو سے بھی مضبوط ہو، زیرِ غور آتا ہے۔

### دوبارہ درجہ بندی

بہترین امیدواروں کو پھر ایک مخصوص درجہ بندی ماڈل دوبارہ اسکور کرتا ہے جو آپ کا سوال اور ہر اقتباس ساتھ ساتھ پڑھتا ہے۔ صرف چند سرِفہرست فیصلے — ہر ایک کے زیادہ سے زیادہ دو متعلقہ ترین اقتباسات کے ساتھ — جواب تک پہنچتے ہیں۔

### پہلے سوال کو سمجھنا

تلاش سے پہلے جسٹس اے آئی یہ طے کرتا ہے کہ آپ نے کس قسم کا سوال پوچھا ہے (نظائر، قانون، جج، یا قانون سے باہر کوئی بات)، گفتگو سے *"پہلے مقدمے کی وضاحت کریں"* جیسے ضمنی سوالات سمجھتا ہے، *"2020 کے فیصلے"* جیسے سال کے فلٹر لگاتا ہے، اور بھارتی دفعات (مثلاً Section 482 CrPC) کو ان کے پاکستانی متبادل (Section 561-A Cr.P.C.) سے ملاتا ہے۔
`,
    },
};

const TAGS_UR = { Launch: 'نیا اجرا', Feature: 'نئی سہولت', Trust: 'اعتماد', Technology: 'ٹیکنالوجی' };

const MODULES_UR = {
    research: ['اے آئی قانونی تحقیق', 'سادہ زبان میں پوچھیں اور ایک واضح جواب پائیں جو قانون کی وضاحت کرے اور جن فیصلوں پر مبنی ہو ان کا حوالہ دے — ہر فیصلہ عدالتی ریکارڈ سے منسلک۔'],
    language: ['انگریزی، اردو اور آواز', 'انگریزی، اردو یا رومن اردو میں، لکھ کر یا بول کر پوچھیں۔ جواب آپ کی زبان میں آتے ہیں اور حوالے بالکل ویسے ہی رہتے ہیں جیسے رپورٹ ہوئے۔'],
    vault: ['محفوظ دستاویزی والٹ', 'درخواستیں، احکامات اور ثبوت کلائنٹ اور مقدمے کے لحاظ سے محفوظ، اسٹوریج سے پہلے اِنکرپٹڈ، اور ہر رسائی کا ریکارڈ۔'],
    billing: ['بلنگ اور مالیات', 'فیسیں، مقدمے کے اخراجات اور کلائنٹ کی ادائیگیاں، میکر چیکر منظوری، تازہ ترین بقایا اور پی ڈی ایف گوشوارے کے ساتھ۔'],
    diary: ['کیس ڈائری اور یاددہانیاں', 'پیشیاں اور نوٹس ایک جگہ، ہر تاریخ سے دو دن اور ایک دن پہلے واٹس ایپ اور ای میل یاددہانیوں کے ساتھ۔'],
    analysis: ['دستاویز کا تجزیہ', 'پی ڈی ایف اپ لوڈ کریں — ایف آئی آر، فیصلہ یا معاہدہ — اور ایسے سوالات پوچھیں جن کا جواب صرف اسی دستاویز سے دیا جائے۔'],
};

const fromData = {};
for (const p of POSTS) {
    const ur = POSTS_UR[p.slug];
    if (!ur) continue;
    fromData[p.title] = ur.title;
    fromData[p.excerpt] = ur.excerpt;
    fromData[p.body] = ur.body;
    if (TAGS_UR[p.tag]) fromData[p.tag] = TAGS_UR[p.tag];
}
for (const m of MODULES) {
    const ur = MODULES_UR[m.key];
    if (!ur) continue;
    fromData[m.title] = ur[0];
    fromData[m.text] = ur[1];
}

export default {
    ...fromData,

    // ── Blog pages ──
    'News, features & how it works': 'خبریں، نئی سہولیات اور یہ کیسے کام کرتا ہے',
    'Product updates and a look under the hood of Justice AI.': 'پروڈکٹ کی تازہ ترین معلومات اور جسٹس اے آئی کے اندرونی نظام پر ایک نظر۔',
    '{n} min read': '{n} منٹ کا مطالعہ',
    'Read post': 'تحریر پڑھیں',
    'All posts': 'تمام تحریریں',
    'Next post': 'اگلی تحریر',
    'Try Justice AI': 'جسٹس اے آئی آزمائیں',
    'Read': 'پڑھیں',

    // ── About page ──
    'About Justice AI': 'جسٹس اے آئی کے بارے میں',
    'Making Pakistani law easy to find — and safe to rely on.': 'پاکستانی قانون کو تلاش کرنا آسان — اور اس پر بھروسا کرنا محفوظ بنانا۔',
    'Justice AI is a legal workspace for Pakistani advocates, law firms and students. It brings {judgments} judgments of the superior and district courts and {statutes} statutes into one place you can question in English or Urdu — and around that research it provides the tools a practice runs on: an encrypted document vault, maker-checker billing and a case diary with reminders.':
        'جسٹس اے آئی پاکستانی وکلاء، لاء فرموں اور طلبہ کے لیے ایک قانونی ورک اسپیس ہے۔ یہ اعلیٰ اور ضلعی عدالتوں کے {judgments} فیصلوں اور {statutes} قوانین کو ایک جگہ جمع کرتا ہے جن سے آپ انگریزی یا اردو میں سوال کر سکتے ہیں — اور اس تحقیق کے ساتھ وہ اوزار بھی فراہم کرتا ہے جن پر پریکٹس چلتی ہے: اِنکرپٹڈ دستاویزی والٹ، میکر چیکر بلنگ اور یاددہانیوں والی کیس ڈائری۔',
    'The problem': 'مسئلہ',
    'Pakistani judgments are spread across separate court websites, published as PDFs and searchable mostly by title or citation. Finding the authority for a legal point means hours of reading. General-purpose AI chatbots fill the gap by inventing cases that do not exist — a serious risk in court. Meanwhile, case files live in WhatsApp chats, fees in a paper register and hearings on a wall calendar.':
        'پاکستانی فیصلے مختلف عدالتوں کی الگ الگ ویب سائٹس پر بکھرے ہوئے ہیں، پی ڈی ایف کی صورت میں شائع ہوتے ہیں اور زیادہ تر صرف عنوان یا حوالے سے تلاش کیے جا سکتے ہیں۔ کسی قانونی نکتے کی نظیر ڈھونڈنے کا مطلب ہے گھنٹوں کا مطالعہ۔ عام اے آئی چیٹ بوٹس یہ خلا ایسے مقدمات گھڑ کر پُر کرتے ہیں جو موجود ہی نہیں — جو عدالت میں ایک سنگین خطرہ ہے۔ دوسری طرف مقدمات کی فائلیں واٹس ایپ چیٹس میں، فیسیں کاغذی رجسٹر میں اور پیشیاں دیوار کے کیلنڈر پر ہوتی ہیں۔',
    'Our approach': 'ہمارا طریقہ',
    'Justice AI answers every question by first searching the actual judgments and statutes, checking that what it found really addresses the question, and only then writing an answer that cites those sources. Around that research engine we built the practice tools lawyers asked for — so the authority you find, the documents you file and the fees you charge all live in one secure workspace.':
        'جسٹس اے آئی ہر سوال کا جواب دینے سے پہلے اصل فیصلوں اور قوانین میں تلاش کرتا ہے، جانچتا ہے کہ جو ملا وہ واقعی سوال سے متعلق ہے، اور تب ہی ان ماخذ کے حوالوں کے ساتھ جواب لکھتا ہے۔ اسی تحقیقی نظام کے گرد ہم نے وہ پریکٹس ٹولز بنائے جو وکلاء نے مانگے — تاکہ آپ کی تلاش کی گئی نظیر، دائر کردہ دستاویزات اور وصول کردہ فیسیں سب ایک محفوظ ورک اسپیس میں ہوں۔',
    'What it includes': 'اس میں کیا شامل ہے',
    'Six modules, one workspace': 'چھ ماڈیول، ایک ورک اسپیس',
    'How an answer is made': 'جواب کیسے تیار ہوتا ہے',
    'Four steps between your question and the answer': 'آپ کے سوال اور جواب کے درمیان چار مراحل',
    'Understanding': 'سوال کو سمجھنا',
    'A language model reads the question and the conversation: what is being asked, in which language, whether it is a follow-up, which courts and years matter, and the precise English legal query to search.':
        'ایک لینگویج ماڈل سوال اور گفتگو پڑھتا ہے: کیا پوچھا جا رہا ہے، کس زبان میں، کیا یہ ضمنی سوال ہے، کون سی عدالتیں اور سال اہم ہیں، اور تلاش کے لیے درست انگریزی قانونی سوال کیا ہوگا۔',
    'Hybrid retrieval': 'ہائبرڈ تلاش',
    'Keyword matching (BM25) finds exact sections and citations; semantic search (Voyage AI embeddings) finds judgments that discuss the same idea in other words. Results are fused and re-ranked.':
        'لفظی مطابقت (BM25) عین دفعات اور حوالے تلاش کرتی ہے؛ معنوی تلاش (Voyage AI embeddings) ایسے فیصلے ڈھونڈتی ہے جو وہی نکتہ دوسرے الفاظ میں بیان کرتے ہیں۔ نتائج یکجا کر کے دوبارہ درجہ بندی کی جاتی ہے۔',
    'Relevance review': 'مطابقت کا جائزہ',
    'A reviewer step must quote the passage that shows each judgment addresses the question. Anything that merely shares a keyword is dropped; if nothing is on point, the answer says so.':
        'جائزے کے مرحلے میں وہ اقتباس نقل کرنا لازم ہے جو ثابت کرے کہ ہر فیصلہ سوال سے متعلق ہے۔ جو چیز محض کوئی لفظ مشترک رکھتی ہو، نکال دی جاتی ہے؛ اگر کچھ بھی متعلقہ نہ ہو تو جواب یہی بتاتا ہے۔',
    'Grounded answer': 'ماخذ پر مبنی جواب',
    'The answer is written only from the retrieved passages, cites them inline, and is checked again: section numbers not found in the sources are marked “unverified”.':
        'جواب صرف حاصل شدہ اقتباسات سے لکھا جاتا ہے، متن کے اندر ان کا حوالہ دیتا ہے، اور دوبارہ جانچا جاتا ہے: جو دفعہ نمبر ماخذ میں نہ ملیں ان پر ”غیر تصدیق شدہ“ لکھ دیا جاتا ہے۔',
    'Reported judgments': 'رپورٹ شدہ فیصلے',
    'Judgments approved for reporting': 'رپورٹنگ کے لیے منظور شدہ فیصلے',
    'Federal legislation': 'وفاقی قانون سازی',
    'Acts, ordinances and codes': 'ایکٹ، آرڈیننس اور ضابطے',
    'Punjab legislation': 'پنجاب کی قانون سازی',
    'Provincial acts and ordinances': 'صوبائی ایکٹ اور آرڈیننس',
    'Judges (SC, LHC, IHC)': 'جج صاحبان (سپریم کورٹ، لاہور و اسلام آباد ہائی کورٹ)',
    'Sitting and former judge profiles': 'موجودہ اور سابق جج صاحبان کے پروفائل',
    'What is in the collection': 'ذخیرے میں کیا ہے',
    'Distinct documents currently indexed.': 'اس وقت انڈیکس شدہ منفرد دستاویزات۔',
    'Technology': 'ٹیکنالوجی',
    'How it is built': 'یہ کیسے بنا ہے',
    'A modern retrieval-augmented system with an agent at its core.': 'ایک جدید ریٹریول آگمینٹڈ نظام جس کے مرکز میں ایک اے آئی ایجنٹ ہے۔',
    'Interface': 'انٹرفیس',
    'React, Vite and Tailwind CSS — light, responsive, right-to-left aware for Urdu': 'React، Vite اور Tailwind CSS — ہلکا، ہر اسکرین کے مطابق، اور اردو کے لیے دائیں سے بائیں کی سہولت کے ساتھ',
    'Application': 'ایپلیکیشن',
    'Python FastAPI with a LangGraph agent orchestrating each research step': 'Python FastAPI، جس میں LangGraph ایجنٹ تحقیق کے ہر مرحلے کو منظم کرتا ہے',
    'Language models': 'لینگویج ماڈلز',
    'OpenAI GPT-4.1 mini for understanding, relevance review and writing answers': 'سوال سمجھنے، مطابقت کے جائزے اور جواب لکھنے کے لیے OpenAI GPT-4.1 mini',
    'Qdrant vector database with hybrid dense + BM25 search; Voyage AI embeddings and re-ranking': 'Qdrant ویکٹر ڈیٹابیس، ہائبرڈ (dense + BM25) تلاش کے ساتھ؛ Voyage AI embeddings اور دوبارہ درجہ بندی',
    'Voice': 'آواز',
    'ElevenLabs Scribe speech-to-text for questions in Urdu, English and Roman Urdu': 'اردو، انگریزی اور رومن اردو میں بولے گئے سوالات کے لیے ElevenLabs Scribe اسپیچ ٹو ٹیکسٹ',
    'Data': 'ڈیٹا',
    'PostgreSQL for accounts, cases, billing and audit logs; Redis answer cache': 'اکاؤنٹس، مقدمات، بلنگ اور آڈٹ ریکارڈ کے لیے PostgreSQL؛ جوابات کے کیش کے لیے Redis',
    'Documents': 'دستاویزات',
    'AES-256-GCM encryption in the app; Cloudflare R2 or any S3-compatible object storage': 'ایپ کے اندر AES-256-GCM اِنکرپشن؛ Cloudflare R2 یا کوئی بھی S3 سے ہم آہنگ اسٹوریج',
    'Notifications': 'اطلاعات',
    'WhatsApp (Meta Cloud API) and email hearing reminders': 'پیشیوں کی واٹس ایپ (Meta Cloud API) اور ای میل یاددہانیاں',
    'Our principles': 'ہمارے اصول',
    'Grounded, not generated': 'ماخذ پر مبنی، گھڑا ہوا نہیں',
    'Answers come from retrieved judgments and statutes. If the collection does not cover a question, Justice AI says so rather than guessing.':
        'جوابات حاصل شدہ فیصلوں اور قوانین سے آتے ہیں۔ اگر ذخیرہ کسی سوال کا احاطہ نہ کرے تو جسٹس اے آئی اندازہ لگانے کے بجائے صاف بتا دیتا ہے۔',
    'Pakistani law first': 'پاکستانی قانون اوّل',
    'Indian provisions are mapped to their Pakistani equivalents, and citations follow Pakistani reporting (PLD, SCMR, CLC, LHC).':
        'بھارتی دفعات کو ان کے پاکستانی متبادل سے ملایا جاتا ہے، اور حوالے پاکستانی رپورٹنگ (PLD، SCMR، CLC، LHC) کے مطابق ہوتے ہیں۔',
    'Transparent by design': 'شفافیت بنیادی اصول',
    'You can watch each research step happen, open every cited judgment, and see exactly which references could not be verified.':
        'آپ تحقیق کا ہر مرحلہ ہوتا دیکھ سکتے ہیں، ہر حوالہ شدہ فیصلہ کھول سکتے ہیں، اور ٹھیک ٹھیک دیکھ سکتے ہیں کہ کون سے حوالے تصدیق نہ ہو سکے۔',
    'Confidential by default': 'رازداری بنیادی اصول',
    'Client documents are encrypted before storage, limited to your firm and logged on every access; money records need a second approver.':
        'کلائنٹ کی دستاویزات اسٹوریج سے پہلے اِنکرپٹ ہوتی ہیں، صرف آپ کی فرم تک محدود رہتی ہیں اور ہر رسائی درج ہوتی ہے؛ رقم کے ریکارڈ کے لیے دوسرے منظور کنندہ کی ضرورت ہوتی ہے۔',
    'Important:': 'اہم:',
    'Justice AI is a research and practice-management tool. Its answers summarise reported judgments and statutes to help you find authority faster; they are not legal advice. Always read the cited judgment before relying on it in court.':
        'جسٹس اے آئی تحقیق اور پریکٹس مینجمنٹ کا ایک ٹول ہے۔ اس کے جوابات رپورٹ شدہ فیصلوں اور قوانین کا خلاصہ پیش کرتے ہیں تاکہ آپ نظیر جلد تلاش کر سکیں؛ یہ قانونی مشورہ نہیں۔ عدالت میں کسی فیصلے پر انحصار سے پہلے ہمیشہ حوالہ شدہ فیصلہ خود پڑھیں۔',

    // ── Landing page: product preview ──
    'Is the offence under section 489-F PPC bailable?': 'کیا دفعہ 489-F PPC کے تحت جرم قابلِ ضمانت ہے؟',
    'The judgments do not call it “bailable”. Section 489-F PPC carries a maximum of three years, so it falls':
        'فیصلے اسے ”قابلِ ضمانت“ نہیں کہتے۔ دفعہ 489-F PPC کی زیادہ سے زیادہ سزا تین سال ہے، اس لیے یہ دفعہ 497 Cr.P.C. کی',
    'outside the prohibitory clause': 'ممانعتی شق سے باہر',
    'of Section 497 Cr.P.C. Bail is therefore the rule and refusal the exception.': 'آتا ہے۔ چنانچہ ضمانت اصول ہے اور انکار استثنا۔',
    'The Supreme Court applied this in Noman Khaliq v. The State (2023 SCMR 2122) and Abdul Saboor v. The State (2022 SCMR 592), granting bail where the dispute was essentially over money owed.':
        'سپریم کورٹ نے یہ اصول Noman Khaliq v. The State (2023 SCMR 2122) اور Abdul Saboor v. The State (2022 SCMR 592) میں لاگو کیا، اور جہاں تنازع بنیادی طور پر واجب الادا رقم کا تھا وہاں ضمانت منظور کی۔',
    'Ask a follow-up, in English or اردو…': 'ضمنی سوال پوچھیں، انگریزی یا اردو میں…',
    'FIR No. 452/2026': 'ایف آئی آر نمبر 452/2026',
    'Bail petition (filed)': 'درخواستِ ضمانت (دائر شدہ)',
    'Petition': 'درخواست',
    'Interim order 03-11-2026': 'عبوری حکم 03-11-2026',
    'Muhammad Asif · Asif v. State': 'محمد آصف · آصف بنام سرکار',
    'Bail petition — drafting & hearing': 'درخواستِ ضمانت — مسودہ اور پیشی',
    'Rs {amount}': '{amount} روپے',
    'Court fee & stamp paper': 'کورٹ فیس اور اسٹامپ پیپر',
    'Travel to Rawalpindi bench': 'راولپنڈی بینچ کا سفر',
    'recorded by the clerk': 'کلرک نے درج کیا',
    'Approved': 'منظور شدہ',
    'Balance due': 'واجب الادا بقایا',
    'Asif v. State — bail': 'آصف بنام سرکار — ضمانت',
    'Tomorrow': 'کل',
    '9:00 AM': 'صبح 9:00 بجے',
    'WhatsApp reminder:': 'واٹس ایپ یاددہانی:',
    'Hearing tomorrow — Asif v. State, Lahore High Court, 9:00 AM.': 'کل پیشی ہے — آصف بنام سرکار، لاہور ہائی کورٹ، صبح 9:00 بجے۔',
    'or just say it — voice questions in Urdu, English or Roman Urdu': 'یا بس بول دیں — اردو، انگریزی یا رومن اردو میں آواز سے سوال',
    'Partly': 'جزوی طور پر',

    // ── Landing page: hero and coverage ──
    'Open your workspace': 'اپنی ورک اسپیس کھولیں',
    'Get started free': 'مفت شروع کریں',
    'NEW': 'نیا',
    'Document vault, billing and voice questions': 'دستاویزی والٹ، بلنگ اور آواز سے سوالات',
    'Legal research and practice management,': 'قانونی تحقیق اور پریکٹس مینجمنٹ،',
    'built for Pakistan.': 'پاکستان کے لیے تیار کردہ۔',
    'Ask a legal question and get an answer grounded in real Supreme Court and High Court judgments, with every source linked. Then keep your files, fees and hearings in the same secure workspace.':
        'قانونی سوال پوچھیں اور سپریم کورٹ اور ہائی کورٹس کے حقیقی فیصلوں پر مبنی جواب پائیں، ہر ماخذ کے لنک کے ساتھ۔ پھر اپنی فائلیں، فیسیں اور پیشیاں اسی محفوظ ورک اسپیس میں رکھیں۔',
    'See what it does': 'دیکھیں یہ کیا کرتا ہے',
    'Free to start': 'مفت آغاز',
    'Sign in with Google': 'گوگل سے سائن اِن',
    'English, اردو and voice': 'انگریزی، اردو اور آواز',
    'Every citation checked': 'ہر حوالہ جانچا گیا',
    'against the retrieved judgment': 'حاصل شدہ فیصلے کے مقابل',
    'Answers drawn from the official record of': 'جوابات ان اداروں کے سرکاری ریکارڈ سے',
    'Federal & Punjab legislation': 'وفاقی اور پنجاب کی قانون سازی',
    '{n} judgments': '{n} فیصلے',
    '{n} statutes': '{n} قوانین',

    // ── Landing page: platform ──
    'The platform': 'پلیٹ فارم',
    'Everything a practice needs, in one workspace.': 'پریکٹس کی ہر ضرورت، ایک ورک اسپیس میں۔',
    'From the first research question to the final statement of account. Four tools that share the same clients, cases and documents.':
        'پہلے تحقیقی سوال سے آخری گوشوارۂ حساب تک۔ چار ٹولز جو ایک ہی کلائنٹس، مقدمات اور دستاویزات پر کام کرتے ہیں۔',
    'Ask the way you would ask a senior colleague.': 'ویسے ہی پوچھیں جیسے کسی سینئر ساتھی سے پوچھتے ہیں۔',
    'Justice AI works out what you mean, searches the judgments and statutes, checks that what it found really answers the question, and writes a clear answer with the authorities cited as it goes.':
        'جسٹس اے آئی سمجھتا ہے کہ آپ کیا پوچھ رہے ہیں، فیصلوں اور قوانین میں تلاش کرتا ہے، جانچتا ہے کہ جو ملا وہ واقعی سوال کا جواب ہے، اور نظائر کے حوالوں کے ساتھ واضح جواب لکھتا ہے۔',
    'Only real judgments are cited, each linked to the court’s PDF': 'صرف حقیقی فیصلوں کا حوالہ، ہر ایک عدالت کی پی ڈی ایف سے منسلک',
    'Follow-up questions keep the context of the conversation': 'ضمنی سوالات میں گفتگو کا سیاق و سباق برقرار رہتا ہے',
    'Indian provisions are mapped to their Pakistani equivalents': 'بھارتی دفعات کو ان کے پاکستانی متبادل سے ملایا جاتا ہے',
    'When the law reports don’t cover a point, it says so': 'جب قانونی رپورٹس کسی نکتے کا احاطہ نہ کریں تو یہ صاف بتا دیتا ہے',
    'What is the effect of delay in lodging an FIR?': 'ایف آئی آر درج کرانے میں تاخیر کا کیا اثر ہوتا ہے؟',
    'Unexplained delay casts doubt on the prosecution story and the benefit goes to the accused. The FIR is the cornerstone of the case, as the Supreme Court held in Mst. Asia Bibi v. The State (PLD 2019 SC 64)…':
        'بلا وضاحت تاخیر استغاثہ کی کہانی کو مشکوک بنا دیتی ہے اور اس کا فائدہ ملزم کو جاتا ہے۔ ایف آئی آر مقدمے کی بنیاد ہے، جیسا کہ سپریم کورٹ نے Mst. Asia Bibi v. The State (PLD 2019 SC 64) میں قرار دیا…',
    'Understood the question': 'سوال سمجھ لیا',
    'Searched case law across all courts': 'تمام عدالتوں کے نظائر میں تلاش کی',
    'Found {n} judgments on point': '{n} متعلقہ فیصلے ملے',
    'Checked every statement against the sources': 'ہر بیان کو ماخذ سے جانچا',
    'Every petition, order and piece of evidence, in its place.': 'ہر درخواست، حکم اور ثبوت، اپنی جگہ پر۔',
    'File documents under the client and case they belong to. They are encrypted before they are stored, visible only to your firm, and every access is recorded.':
        'دستاویزات کو ان کے کلائنٹ اور مقدمے کے تحت رکھیں۔ وہ محفوظ ہونے سے پہلے اِنکرپٹ ہوتی ہیں، صرف آپ کی فرم کو نظر آتی ہیں، اور ہر رسائی درج ہوتی ہے۔',
    'AES-256 encryption before storage': 'اسٹوریج سے پہلے AES-256 اِنکرپشن',
    'Organised by client, case and category': 'کلائنٹ، مقدمے اور زمرے کے لحاظ سے ترتیب',
    'A full record of who opened what, and when': 'مکمل ریکارڈ کہ کس نے کیا کھولا، اور کب',
    'Billing & financials': 'بلنگ اور مالیات',
    'Accounts with a second pair of eyes.': 'حساب کتاب، دوسری نظر کے ساتھ۔',
    'Record fees, case expenses and client payments in rupees. A partner approves each entry before it counts, so nobody can change the books alone.':
        'فیسیں، مقدمے کے اخراجات اور کلائنٹ کی ادائیگیاں روپوں میں درج کریں۔ ہر اندراج شمار ہونے سے پہلے پارٹنر منظور کرتا ہے، اس لیے کوئی اکیلا حساب میں تبدیلی نہیں کر سکتا۔',
    'Maker-checker approval on every entry': 'ہر اندراج پر میکر چیکر منظوری',
    'Live balance for every client and case': 'ہر کلائنٹ اور مقدمے کا تازہ ترین بقایا',
    'Statement of account as a PDF in one click': 'ایک کلک میں پی ڈی ایف گوشوارۂ حساب',
    'Be in the right courtroom on the right day.': 'صحیح دن، صحیح عدالت میں موجود رہیں۔',
    'Keep hearings and case notes in one diary. Reminders go out by WhatsApp and email two days and one day before every date.':
        'پیشیاں اور مقدمات کے نوٹس ایک ڈائری میں رکھیں۔ ہر تاریخ سے دو دن اور ایک دن پہلے واٹس ایپ اور ای میل پر یاددہانی جاتی ہے۔',
    'A separate WhatsApp number per hearing, for a junior or clerk': 'ہر پیشی کے لیے الگ واٹس ایپ نمبر، کسی جونیئر یا کلرک کے لیے',
    'Notes saved to your account, on any device': 'نوٹس آپ کے اکاؤنٹ میں محفوظ، ہر آلے پر دستیاب',
    'Reminders stop once a hearing is marked completed': 'پیشی مکمل قرار دینے پر یاددہانیاں رک جاتی ہیں',
    'Ask in the language your client speaks, typed or spoken. Citations stay exactly as reported.':
        'اسی زبان میں پوچھیں جو آپ کا کلائنٹ بولتا ہے، لکھ کر یا بول کر۔ حوالے بالکل ویسے ہی رہتے ہیں جیسے رپورٹ ہوئے۔',
    'Upload an FIR, a judgment or a contract and ask questions answered only from that document.':
        'ایف آئی آر، فیصلہ یا معاہدہ اپ لوڈ کریں اور ایسے سوالات پوچھیں جن کا جواب صرف اسی دستاویز سے دیا جائے۔',
    'Who are the parties?': 'فریقین کون ہیں؟',
    'Which sections are invoked?': 'کون سی دفعات لگائی گئی ہیں؟',
    'What was the final order?': 'حتمی حکم کیا تھا؟',
    'Built for teams': 'ٹیموں کے لیے تیار',
    'Invite partners, associates and clerks. Everyone shares the same files, and each role sees the actions that suit it.':
        'پارٹنرز، ایسوسی ایٹس اور کلرکوں کو مدعو کریں۔ سب ایک ہی فائلیں استعمال کرتے ہیں، اور ہر کردار کو وہی اختیارات نظر آتے ہیں جو اس کے لیے موزوں ہیں۔',
    'Owner / Partner': 'مالک / پارٹنر',
    'Approves entries, reviews the audit log': 'اندراجات منظور کرتا ہے، آڈٹ ریکارڈ دیکھتا ہے',
    'Associate': 'ایسوسی ایٹ',
    'Researches, files documents': 'تحقیق کرتا ہے، دستاویزات محفوظ کرتا ہے',
    'Clerk': 'کلرک',
    'Records fees and hearings': 'فیسیں اور پیشیاں درج کرتا ہے',

    // ── Landing page: numbers ──
    'reported judgments': 'رپورٹ شدہ فیصلے',
    'Supreme Court, Lahore and Islamabad High Courts': 'سپریم کورٹ، لاہور اور اسلام آباد ہائی کورٹس',
    'statutes': 'قوانین',
    'Federal and Punjab legislation': 'وفاقی اور پنجاب کی قانون سازی',
    'judge profiles': 'جج صاحبان کے پروفائل',
    'Sitting and former judges': 'موجودہ اور سابق جج صاحبان',
    'languages': 'زبانیں',
    'English, Urdu and Roman Urdu': 'انگریزی، اردو اور رومن اردو',

    // ── Landing page: how research works ──
    'How research works': 'تحقیق کیسے ہوتی ہے',
    'From question to cited answer, and you can watch every step.': 'سوال سے حوالہ جاتی جواب تک، اور آپ ہر مرحلہ دیکھ سکتے ہیں۔',
    'Ask': 'پوچھیں',
    'Type or speak your question — a section, a legal issue or your client’s facts — in English, Urdu or Roman Urdu.':
        'اپنا سوال لکھیں یا بولیں — کوئی دفعہ، قانونی مسئلہ یا آپ کے کلائنٹ کے حقائق — انگریزی، اردو یا رومن اردو میں۔',
    'Understand & search': 'سمجھنا اور تلاش',
    'Justice AI works out what you mean, resolves follow-ups, then searches judgments and statutes by keyword and by meaning.':
        'جسٹس اے آئی سمجھتا ہے کہ آپ کا مطلب کیا ہے، ضمنی سوالات واضح کرتا ہے، پھر فیصلوں اور قوانین میں الفاظ اور معنی دونوں کے لحاظ سے تلاش کرتا ہے۔',
    'Verify': 'تصدیق',
    'A reviewer step keeps only judgments that genuinely address your issue, quoting the passage that proves it.':
        'جائزے کا مرحلہ صرف وہی فیصلے رکھتا ہے جو واقعی آپ کے مسئلے سے متعلق ہوں، اور ثبوت کے طور پر متعلقہ اقتباس نقل کرتا ہے۔',
    'Answer': 'جواب',
    'You get a clear answer with inline citations and practical next steps, streamed live, with every source one click away.':
        'آپ کو متن کے اندر حوالوں اور عملی اگلے اقدامات کے ساتھ واضح جواب براہِ راست ملتا ہے، اور ہر ماخذ ایک کلک کے فاصلے پر ہوتا ہے۔',

    // ── Landing page: comparison ──
    'Why Justice AI': 'جسٹس اے آئی کیوں',
    'A fabricated citation is worse than no citation.': 'فرضی حوالہ، کوئی حوالہ نہ ہونے سے بھی بدتر ہے۔',
    'General chatbots are known to invent cases. Court websites have the real ones, but finding the right paragraph takes hours. Justice AI is built to give you both: speed, and sources you can open.':
        'عام چیٹ بوٹس فرضی مقدمات گھڑنے کے لیے مشہور ہیں۔ عدالتی ویب سائٹس پر اصل فیصلے موجود ہیں، مگر صحیح پیراگراف ڈھونڈنے میں گھنٹے لگتے ہیں۔ جسٹس اے آئی آپ کو دونوں دیتا ہے: رفتار، اور ایسے ماخذ جو آپ کھول سکیں۔',
    'General AI chatbot': 'عام اے آئی چیٹ بوٹ',
    'Searching court websites': 'عدالتی ویب سائٹس پر تلاش',
    'Cites only judgments it actually retrieved': 'صرف انہی فیصلوں کا حوالہ جو واقعی تلاش کر کے حاصل کیے',
    'Every source linked to the court’s own record': 'ہر ماخذ عدالت کے اپنے ریکارڈ سے منسلک',
    'A clear answer in seconds': 'چند سیکنڈ میں واضح جواب',
    'Says so when the law reports don’t cover a point': 'جب قانونی رپورٹس کسی نکتے کا احاطہ نہ کریں تو صاف بتاتا ہے',
    'Questions and answers in Urdu and Roman Urdu': 'اردو اور رومن اردو میں سوال و جواب',
    'Client files, billing and hearings in the same place': 'کلائنٹ فائلیں، بلنگ اور پیشیاں ایک ہی جگہ',

    // ── Landing page: security ──
    'Security & trust': 'سکیورٹی اور اعتماد',
    'Your clients’ confidences stay confidential.': 'آپ کے کلائنٹس کے راز، راز ہی رہتے ہیں۔',
    'Lawyers hold some of the most sensitive information there is. Documents are protected at rest, access is limited to your firm, money records need a second approver, and research answers are never invented.':
        'وکلاء کے پاس انتہائی حساس معلومات ہوتی ہیں۔ دستاویزات محفوظ حالت میں رکھی جاتی ہیں، رسائی صرف آپ کی فرم تک محدود ہے، رقم کے ریکارڈ کے لیے دوسرا منظور کنندہ درکار ہے، اور تحقیقی جوابات کبھی گھڑے نہیں جاتے۔',
    'Cloud storage:': 'کلاؤڈ اسٹوریج:',
    'Cloudflare R2 or any S3-compatible provider': 'Cloudflare R2 یا کوئی بھی S3 سے ہم آہنگ فراہم کنندہ',
    'AES-256 encryption': 'AES-256 اِنکرپشن',
    'Vault files are encrypted inside Justice AI before they are stored. The storage provider only ever holds scrambled data.':
        'والٹ کی فائلیں محفوظ ہونے سے پہلے جسٹس اے آئی کے اندر اِنکرپٹ کی جاتی ہیں۔ اسٹوریج فراہم کنندہ کے پاس ہمیشہ صرف ناقابلِ فہم ڈیٹا ہوتا ہے۔',
    'Tamper detection': 'ردوبدل کی نشاندہی',
    'Every stored file is integrity-checked when opened. A modified file is refused, never served.':
        'ہر محفوظ فائل کھولتے وقت اس کی سالمیت جانچی جاتی ہے۔ تبدیل شدہ فائل مسترد کر دی جاتی ہے، کبھی پیش نہیں کی جاتی۔',
    'Firm-level isolation': 'فرم کی سطح پر علیحدگی',
    'Clients, documents and accounts belong to your firm. No other firm can see or open them.':
        'کلائنٹس، دستاویزات اور حسابات آپ کی فرم کے ہیں۔ کوئی دوسری فرم انہیں نہ دیکھ سکتی ہے نہ کھول سکتی ہے۔',
    'Complete audit trail': 'مکمل آڈٹ ریکارڈ',
    'Every upload, view, download and deletion is recorded with the person and the time.':
        'ہر اپ لوڈ، دیکھنا، ڈاؤن لوڈ اور حذف کرنا، متعلقہ شخص اور وقت کے ساتھ درج ہوتا ہے۔',
    'Maker-checker accounts': 'میکر چیکر حسابات',
    'One person records a fee or payment; a partner approves it. Nobody can change the books alone.':
        'ایک شخص فیس یا ادائیگی درج کرتا ہے؛ پارٹنر اسے منظور کرتا ہے۔ کوئی اکیلا حساب میں تبدیلی نہیں کر سکتا۔',
    'Honest answers': 'دیانت دار جوابات',
    'If the judgments don’t cover a question, Justice AI says so instead of inventing an authority.':
        'اگر فیصلے کسی سوال کا احاطہ نہ کریں تو جسٹس اے آئی کوئی نظیر گھڑنے کے بجائے صاف بتا دیتا ہے۔',

    // ── Landing page: audiences ──
    'Who it’s for': 'یہ کس کے لیے ہے',
    'Made for the way Pakistani lawyers work.': 'پاکستانی وکلاء کے کام کے انداز کے مطابق بنایا گیا۔',
    'Advocates in solo practice': 'انفرادی پریکٹس کرنے والے وکلاء',
    'Research faster, keep every client file in one place and never miss a hearing — without hiring extra staff.':
        'تیزی سے تحقیق کریں، ہر کلائنٹ کی فائل ایک جگہ رکھیں اور کوئی پیشی نہ چُھوٹے — اضافی عملہ رکھے بغیر۔',
    'Law firms & chambers': 'لاء فرمیں اور چیمبرز',
    'Share client files across partners, associates and clerks with roles, approvals and an audit trail.':
        'کرداروں، منظوریوں اور آڈٹ ریکارڈ کے ساتھ کلائنٹ فائلیں پارٹنرز، ایسوسی ایٹس اور کلرکوں میں شیئر کریں۔',
    'Law students & researchers': 'قانون کے طلبہ اور محققین',
    'Find the leading authorities on a point, read the judgment, and understand it in English or Urdu.':
        'کسی نکتے پر اہم نظائر تلاش کریں، فیصلہ پڑھیں، اور اسے انگریزی یا اردو میں سمجھیں۔',

    // ── Landing page: FAQ ──
    'Questions': 'سوالات',
    'Frequently asked.': 'اکثر پوچھے جانے والے سوالات۔',
    'Can’t find what you need?': 'مطلوبہ معلومات نہیں ملیں؟',
    'Read more about the project': 'منصوبے کے بارے میں مزید پڑھیں',
    '.': '۔',
    'Is Justice AI a substitute for a lawyer’s judgment?': 'کیا جسٹس اے آئی وکیل کی رائے کا متبادل ہے؟',
    'No. It is a research and practice-management tool. It finds and summarises reported judgments and statutes so you reach the authority faster; always read the cited judgment before relying on it in court.':
        'نہیں۔ یہ تحقیق اور پریکٹس مینجمنٹ کا ٹول ہے۔ یہ رپورٹ شدہ فیصلے اور قوانین تلاش کر کے ان کا خلاصہ پیش کرتا ہے تاکہ آپ نظیر تک جلد پہنچ سکیں؛ عدالت میں انحصار سے پہلے ہمیشہ حوالہ شدہ فیصلہ خود پڑھیں۔',
    'Which courts and laws are covered?': 'کون سی عدالتیں اور قوانین شامل ہیں؟',
    'Reported judgments of the Supreme Court of Pakistan ({sc}), the Lahore High Court ({lhc}) and the Islamabad High Court ({ihc}), plus {federal} federal and {punjab} Punjab statutes, and profiles of {judges} judges.':
        'سپریم کورٹ آف پاکستان ({sc})، لاہور ہائی کورٹ ({lhc}) اور اسلام آباد ہائی کورٹ ({ihc}) کے رپورٹ شدہ فیصلے، اس کے علاوہ {federal} وفاقی اور {punjab} پنجاب کے قوانین، اور {judges} جج صاحبان کے پروفائل۔',
    'How do I know a citation is real?': 'مجھے کیسے پتا چلے کہ حوالہ حقیقی ہے؟',
    'Justice AI only cites judgments it has actually retrieved, and each one links to the court’s own PDF. Any section number it cannot find in those judgments is marked “unverified”.':
        'جسٹس اے آئی صرف انہی فیصلوں کا حوالہ دیتا ہے جو اس نے واقعی حاصل کیے ہوں، اور ہر ایک عدالت کی اپنی پی ڈی ایف سے منسلک ہوتا ہے۔ جو دفعہ نمبر ان فیصلوں میں نہ ملے اس پر ”غیر تصدیق شدہ“ لکھ دیا جاتا ہے۔',
    'Can I ask in Urdu?': 'کیا میں اردو میں پوچھ سکتا ہوں؟',
    'Yes — type or speak in Urdu, Roman Urdu or English. Answers can be written in Urdu, with case names, citations and section numbers kept in English exactly as reported.':
        'جی ہاں — اردو، رومن اردو یا انگریزی میں لکھیں یا بولیں۔ جوابات اردو میں لکھے جا سکتے ہیں، جبکہ مقدمات کے نام، حوالے اور دفعات کے نمبر رپورٹ کے عین مطابق انگریزی میں رہتے ہیں۔',
    'Where are my documents stored, and who can see them?': 'میری دستاویزات کہاں محفوظ ہوتی ہیں، اور انہیں کون دیکھ سکتا ہے؟',
    'Documents are encrypted with AES-256 before storage on cloud object storage (Cloudflare R2 or any S3-compatible service). Only members of your firm can open them, and every access is logged.':
        'دستاویزات کلاؤڈ اسٹوریج (Cloudflare R2 یا کوئی بھی S3 سے ہم آہنگ سروس) پر محفوظ کرنے سے پہلے AES-256 سے اِنکرپٹ کی جاتی ہیں۔ انہیں صرف آپ کی فرم کے ارکان کھول سکتے ہیں، اور ہر رسائی درج ہوتی ہے۔',
    'Can my clerk record fees without being able to approve them?': 'کیا میرا کلرک فیس درج کر سکتا ہے مگر منظور نہیں کر سکتا؟',
    'Yes. Clerks and associates record entries; only an owner or partner can approve them, and nobody can approve an entry they recorded themselves.':
        'جی ہاں۔ کلرک اور ایسوسی ایٹس اندراجات کرتے ہیں؛ انہیں صرف مالک یا پارٹنر منظور کر سکتا ہے، اور کوئی بھی اپنا درج کردہ اندراج خود منظور نہیں کر سکتا۔',

    // ── Landing page: blog and closing ──
    'From the blog': 'بلاگ سے',
    'Latest updates': 'تازہ ترین',
    'Your next brief starts here.': 'آپ کا اگلا مقدمہ یہیں سے شروع ہوتا ہے۔',
    'Create a free account in under a minute with Google or email, and ask your first question.':
        'گوگل یا ای میل سے ایک منٹ سے کم میں مفت اکاؤنٹ بنائیں، اور اپنا پہلا سوال پوچھیں۔',
    'About the project': 'منصوبے کے بارے میں',
    // Landing page: real coverage (district courts, PPC/Cr.P.C., Rules and Orders) and modules.
    "Sahiwal, Okara, Pakpattan, Kasur and Rawalpindi": "ساہیوال، اوکاڑہ، پاکپتن، قصور اور راولپنڈی",
    "Judgments from Sahiwal, Okara, Pakpattan, Kasur and Rawalpindi": "ساہیوال، اوکاڑہ، پاکپتن، قصور اور راولپنڈی کے فیصلے",
    "Federal and Punjab statutes": "وفاقی اور پنجاب کے قوانین",
    "Including the full Pakistan Penal Code and Code of Criminal Procedure": "بشمول مکمل مجموعہ تعزیراتِ پاکستان اور ضابطہ فوجداری",
    "Acts, ordinances and codes, including the full PPC and Cr.P.C.": "ایکٹ، آرڈیننس اور مجموعے، بشمول مکمل تعزیراتِ پاکستان اور ضابطہ فوجداری",
    "LHC Rules and Orders": "لاہور ہائی کورٹ رولز اینڈ آرڈرز",
    "Instructions to the civil and criminal courts of Punjab": "پنجاب کی دیوانی اور فوجداری عدالتوں کے لیے ہدایات",
    "What Justice AI has read": "جسٹس اے آئی نے کیا پڑھا ہے",
    "{judgments} judgments and {statutes} statutes, from the official record.": "{judgments} فیصلے اور {statutes} قوانین، سرکاری ریکارڈ سے۔",
    "Every answer is drawn from this collection, and every source opens the court’s or the government’s own document.": "ہر جواب اسی ذخیرے سے لیا جاتا ہے، اور ہر حوالہ عدالت یا حکومت کی اپنی دستاویز کھولتا ہے۔",
    "Plus profiles of {n} sitting and former judges.": "اس کے علاوہ {n} موجودہ اور سابق جج صاحبان کے پروفائل۔",
    "judgments": "فیصلے",
    "Judgments from five Punjab district courts": "پنجاب کی پانچ ضلعی عدالتوں کے فیصلے",
    "Ask in English or Urdu and get an answer grounded in real judgments of the Supreme Court, the High Courts and Punjab district courts, with every source linked. Then run your files, fees and hearings from the same secure workspace.": "انگریزی یا اردو میں سوال پوچھیں اور سپریم کورٹ، ہائی کورٹس اور پنجاب کی ضلعی عدالتوں کے حقیقی فیصلوں پر مبنی جواب پائیں، ہر حوالے کے لنک کے ساتھ۔ پھر اپنی فائلیں، فیسیں اور پیشیاں اسی محفوظ ورک اسپیس سے چلائیں۔",
    "Research, documents, hearings and accounts share the same clients and cases, so nothing is typed twice.": "تحقیق، دستاویزات، پیشیاں اور حسابات ایک ہی کلائنٹس اور مقدمات سے جڑے ہیں، اس لیے کچھ بھی دوبارہ درج نہیں کرنا پڑتا۔",
    "Browse federal and Punjab laws by category and open the official text. Keep court forms and your office’s own documents on the same shelf.": "وفاقی اور پنجاب کے قوانین زمرہ وار دیکھیں اور سرکاری متن کھولیں۔ عدالتی فارم اور اپنے دفتر کی دستاویزات بھی اسی جگہ رکھیں۔",
    "Federal & Punjab laws": "وفاقی اور پنجاب کے قوانین",
    "Urdu court forms": "اردو عدالتی فارم",
    "Clients, cases and your team": "کلائنٹس، مقدمات اور آپ کی ٹیم",
    "One file per client with their cases, documents, hearings and balance — shared with partners, associates and clerks, each with the actions that suit their role.": "ہر کلائنٹ کی ایک فائل جس میں اس کے مقدمات، دستاویزات، پیشیاں اور واجب الادا رقم ہو — پارٹنرز، ایسوسی ایٹس اور کلرکوں کے ساتھ مشترک، ہر ایک کو اس کے کردار کے مطابق اختیارات کے ساتھ۔",
    "Judgments of the Supreme Court of Pakistan ({sc}), the Lahore High Court ({lhc}), the Islamabad High Court ({ihc}) and five Punjab district courts ({district}: Sahiwal, Okara, Pakpattan, Kasur and Rawalpindi); {federal} federal statutes, including the full PPC and Cr.P.C.; {punjab} Punjab statutes; the Lahore High Court Rules and Orders; and profiles of {judges} judges.": "سپریم کورٹ آف پاکستان ({sc})، لاہور ہائی کورٹ ({lhc})، اسلام آباد ہائی کورٹ ({ihc}) اور پنجاب کی پانچ ضلعی عدالتوں ({district}: ساہیوال، اوکاڑہ، پاکپتن، قصور اور راولپنڈی) کے فیصلے؛ {federal} وفاقی قوانین، بشمول مکمل تعزیراتِ پاکستان اور ضابطہ فوجداری؛ پنجاب کے {punjab} قوانین؛ لاہور ہائی کورٹ رولز اینڈ آرڈرز؛ اور {judges} جج صاحبان کے پروفائل۔",
    "Will I be reminded of my hearings?": "کیا مجھے اپنی پیشیوں کی یاددہانی ملے گی؟",
    "Yes. The case diary sends WhatsApp and email reminders two days and one day before every hearing, and stops once the hearing is marked completed.": "جی ہاں۔ کیس ڈائری ہر پیشی سے دو دن اور ایک دن پہلے واٹس ایپ اور ای میل پر یاددہانی بھیجتی ہے، اور پیشی مکمل ہونے پر یاددہانیاں بند ہو جاتی ہیں۔",
    // Landing page and the Features / How it works / Security / FAQ pages.
    "Past judgments of the trial and appellate courts": "ٹرائل اور اپیلٹ عدالتوں کے سابقہ فیصلے",
    "Ask a question and get a clear answer built only from past judgments and statutes, each one cited and linked.": "سوال پوچھیں اور صرف سابقہ فیصلوں اور قوانین پر مبنی واضح جواب پائیں، ہر حوالہ درج اور لنک کے ساتھ۔",
    "Type or speak in English, Urdu or Roman Urdu. Citations stay exactly as the court reported them.": "انگریزی، اردو یا رومن اردو میں لکھیں یا بولیں۔ حوالے بالکل ویسے ہی رہتے ہیں جیسے عدالت نے رپورٹ کیے۔",
    "Federal and Punjab laws by category, Urdu court forms and your office’s own documents on one shelf.": "وفاقی اور پنجاب کے قوانین زمرہ وار، اردو عدالتی فارم اور آپ کے دفتر کی اپنی دستاویزات ایک ہی جگہ۔",
    "Hearings and case notes in one diary, with WhatsApp and email reminders before every date.": "پیشیاں اور کیس نوٹس ایک ڈائری میں، ہر تاریخ سے پہلے واٹس ایپ اور ای میل یاددہانی کے ساتھ۔",
    "One file per client with their cases, documents, hearings and balance, shared with your team.": "ہر کلائنٹ کی ایک فائل جس میں اس کے مقدمات، دستاویزات، پیشیاں اور بقایا رقم ہو، آپ کی ٹیم کے ساتھ مشترک۔",
    "Every petition, order and piece of evidence encrypted before storage and visible only to your firm.": "ہر درخواست، حکم اور ثبوت محفوظ ہونے سے پہلے اِنکرپٹ، اور صرف آپ کی فرم کو نظر آنے والا۔",
    "Fees, expenses and payments in rupees, approved by a partner before they count.": "فیسیں، اخراجات اور ادائیگیاں روپوں میں، شمار ہونے سے پہلے پارٹنر کی منظوری کے ساتھ۔",
    "In English, Urdu or Roman Urdu — a section, a legal issue or your client’s facts.": "انگریزی، اردو یا رومن اردو میں — کوئی دفعہ، قانونی نکتہ یا آپ کے کلائنٹ کے حقائق۔",
    "Justice AI works out what you mean and searches past judgments and statutes by keyword and by meaning.": "جسٹس اے آئی آپ کا مطلب سمجھتا ہے اور سابقہ فیصلوں اور قوانین میں لفظ اور مفہوم دونوں سے تلاش کرتا ہے۔",
    "A reviewer step keeps only judgments that genuinely address your issue.": "ایک جانچ کا مرحلہ صرف وہی فیصلے رکھتا ہے جو واقعی آپ کے نکتے سے متعلق ہوں۔",
    "A clear answer, streamed live, with every source one click away.": "واضح جواب، براہِ راست لکھا جاتا ہوا، ہر ماخذ ایک کلک کے فاصلے پر۔",
    "Vault files are encrypted inside Justice AI before they are stored.": "والٹ کی فائلیں محفوظ ہونے سے پہلے جسٹس اے آئی کے اندر ہی اِنکرپٹ ہو جاتی ہیں۔",
    "One person records a fee; a partner approves it. Nobody changes the books alone.": "ایک شخص فیس درج کرتا ہے، پارٹنر منظور کرتا ہے۔ کوئی اکیلا حساب تبدیل نہیں کر سکتا۔",
    "The legal workspace for Pakistani advocates": "پاکستانی وکلاء کے لیے قانونی ورک اسپیس",
    "Ask in English or Urdu and get an answer grounded in past judgments of the Supreme Court, the High Courts and Punjab district courts, with every source linked. Then run your files, fees and hearings from the same secure workspace.": "انگریزی یا اردو میں سوال پوچھیں اور سپریم کورٹ، ہائی کورٹس اور پنجاب کی ضلعی عدالتوں کے سابقہ فیصلوں پر مبنی جواب پائیں، ہر حوالے کے لنک کے ساتھ۔ پھر اپنی فائلیں، فیسیں اور پیشیاں اسی محفوظ ورک اسپیس سے چلائیں۔",
    "Every citation checked against the retrieved judgment": "ہر حوالہ حاصل شدہ فیصلے سے جانچا جاتا ہے",
    "Searched across all courts": "تمام عدالتوں میں تلاش",
    "Voice questions in Urdu, English or Roman Urdu": "اردو، انگریزی یا رومن اردو میں آواز سے سوال",
    "Built on the official record": "سرکاری ریکارڈ پر مبنی",
    "Answers come from past judgments and the statute book, never from memory.": "جوابات سابقہ فیصلوں اور قانون کی کتاب سے آتے ہیں، کبھی یادداشت سے نہیں۔",
    "Justice AI reads the courts’ own reported judgments and the official text of the law. Every source in an answer opens the court’s or the government’s document.": "جسٹس اے آئی عدالتوں کے اپنے رپورٹ شدہ فیصلے اور قانون کا سرکاری متن پڑھتا ہے۔ جواب کا ہر ماخذ عدالت یا حکومت کی دستاویز کھولتا ہے۔",
    "Plus profiles of sitting and former judges.": "اس کے علاوہ موجودہ اور سابق جج صاحبان کے پروفائل۔",
    "Explore the features": "خصوصیات دیکھیں",
    "See the full process": "مکمل طریقۂ کار دیکھیں",
    "Documents are protected at rest, access is limited to your firm, money records need a second approver, and research answers are never invented.": "دستاویزات محفوظ حالت میں رہتی ہیں، رسائی صرف آپ کی فرم تک محدود ہے، مالی اندراجات کے لیے دوسری منظوری درکار ہے، اور تحقیقی جوابات کبھی گھڑے نہیں جاتے۔",
    "Only your firm can open your files": "آپ کی فائلیں صرف آپ کی فرم کھول سکتی ہے",
    "Every access is logged": "ہر رسائی درج ہوتی ہے",
    "Honest answers: when the law reports don’t cover a point, it says so": "دیانت دار جوابات: جب لاء رپورٹس کسی نکتے کا احاطہ نہ کریں تو یہ صاف بتا دیتا ہے",
    "Read about security": "سکیورٹی کے بارے میں پڑھیں",
    "Justice AI works out what you mean, searches past judgments and statutes, checks that what it found really answers the question, and writes a clear answer with the authorities cited as it goes.": "جسٹس اے آئی آپ کا مطلب سمجھتا ہے، سابقہ فیصلوں اور قوانین میں تلاش کرتا ہے، جانچتا ہے کہ جو ملا وہ واقعی سوال کا جواب ہے، اور نظائر کے حوالوں کے ساتھ واضح جواب لکھتا ہے۔",
    "Ask in the language your client speaks, typed or spoken. Answers can be written in Urdu, with case names, citations and section numbers kept in English exactly as reported.": "اسی زبان میں پوچھیں جو آپ کا کلائنٹ بولتا ہے، لکھ کر یا بول کر۔ جواب اردو میں لکھے جا سکتے ہیں، جن میں مقدمات کے نام، حوالے اور دفعات کے نمبر انگریزی میں بالکل ویسے ہی رہتے ہیں جیسے رپورٹ ہوئے۔",
    "Questions in English, Urdu or Roman Urdu": "انگریزی، اردو یا رومن اردو میں سوالات",
    "Answers in English or Urdu, your choice": "جواب انگریزی یا اردو میں، آپ کی مرضی",
    "Voice questions from the microphone button": "مائیکروفون بٹن سے آواز میں سوال",
    "Ask a document, not the internet.": "انٹرنیٹ سے نہیں، دستاویز سے پوچھیں۔",
    "Upload an FIR, a judgment or a contract and ask questions answered only from that document. Nothing outside the file is used.": "ایف آئی آر، فیصلہ یا معاہدہ اپ لوڈ کریں اور ایسے سوال پوچھیں جن کا جواب صرف اسی دستاویز سے دیا جائے۔ فائل سے باہر کچھ استعمال نہیں ہوتا۔",
    "PDF documents, private to your account": "پی ڈی ایف دستاویزات، صرف آپ کے اکاؤنٹ تک محدود",
    "Answers quote the page they come from": "جواب میں وہ صفحہ درج ہوتا ہے جہاں سے بات لی گئی",
    "Ask follow-ups in the same conversation": "اسی گفتگو میں ضمنی سوال پوچھیں",
    "Summarise the grounds of appeal": "اپیل کی بنیادوں کا خلاصہ کریں",
    "The statute book and your forms, on one shelf.": "قانون کی کتاب اور آپ کے فارم، ایک ہی شیلف پر۔",
    "Browse federal and Punjab laws by category and open the official text. Keep Urdu court forms and your office’s own documents next to them.": "وفاقی اور پنجاب کے قوانین زمرہ وار دیکھیں اور سرکاری متن کھولیں۔ اردو عدالتی فارم اور اپنے دفتر کی دستاویزات بھی ساتھ رکھیں۔",
    "Federal and Punjab laws, including the full PPC and Cr.P.C.": "وفاقی اور پنجاب کے قوانین، بشمول مکمل تعزیراتِ پاکستان اور ضابطہ فوجداری",
    "The Lahore High Court Rules and Orders": "لاہور ہائی کورٹ رولز اینڈ آرڈرز",
    "Add your own resources for the whole firm": "پوری فرم کے لیے اپنے وسائل شامل کریں",
    "Your office documents": "آپ کے دفتر کی دستاویزات",
    "Clients, cases and your team.": "کلائنٹس، مقدمات اور آپ کی ٹیم۔",
    "Invite colleagues by email; they join with consent": "ساتھیوں کو ای میل سے مدعو کریں؛ وہ رضامندی سے شامل ہوتے ہیں",
    "Owners and partners approve; associates and clerks record": "مالک اور پارٹنر منظور کرتے ہیں؛ ایسوسی ایٹ اور کلرک درج کرتے ہیں",
    "Solo advocates can allow self-approval, marked as such": "تنہا پریکٹس کرنے والے وکیل خود منظوری کی اجازت دے سکتے ہیں، جو الگ سے نشان زد ہوتی ہے",
    "Each answer passes through four stages. You see them happen live, and you can open every source it relied on.": "ہر جواب چار مراحل سے گزرتا ہے۔ آپ انہیں براہِ راست ہوتا دیکھتے ہیں، اور ہر وہ ماخذ کھول سکتے ہیں جس پر اس نے انحصار کیا۔",
    "Verified sign-in": "تصدیق شدہ سائن اِن",
    "Accounts are confirmed by an email code or Google sign-in, and WhatsApp numbers by a one-time code.": "اکاؤنٹ کی تصدیق ای میل کوڈ یا گوگل سائن اِن سے، اور واٹس ایپ نمبر کی تصدیق یک بارگی کوڈ سے ہوتی ہے۔",
    "Private document analysis": "نجی دستاویزی تجزیہ",
    "A PDF you upload for analysis is visible to you alone and is never used to answer anyone else.": "تجزیے کے لیے اپ لوڈ کی گئی پی ڈی ایف صرف آپ کو نظر آتی ہے اور کسی اور کے جواب میں کبھی استعمال نہیں ہوتی۔",
    "Cloud storage you control": "کلاؤڈ اسٹوریج آپ کے اختیار میں",
    "Encrypted files live on Cloudflare R2 or any S3-compatible provider of your choosing.": "اِنکرپٹڈ فائلیں Cloudflare R2 یا آپ کی پسند کے کسی بھی S3 ہم آہنگ فراہم کنندہ پر رہتی ہیں۔",
    "Past judgments of the Supreme Court of Pakistan, the Lahore High Court, the Islamabad High Court and Punjab district courts; federal and Punjab statutes, including the full PPC and Cr.P.C.; the Lahore High Court Rules and Orders; and profiles of sitting and former judges.": "سپریم کورٹ آف پاکستان، لاہور ہائی کورٹ، اسلام آباد ہائی کورٹ اور پنجاب کی ضلعی عدالتوں کے سابقہ فیصلے؛ وفاقی اور پنجاب کے قوانین، بشمول مکمل تعزیراتِ پاکستان اور ضابطہ فوجداری؛ لاہور ہائی کورٹ رولز اینڈ آرڈرز؛ اور موجودہ اور سابق جج صاحبان کے پروفائل۔",
    "Is it free?": "کیا یہ مفت ہے؟",
    "Yes. Create an account with Google or email and start researching; there is no charge to use the workspace.": "جی ہاں۔ گوگل یا ای میل سے اکاؤنٹ بنائیں اور تحقیق شروع کریں؛ ورک اسپیس کے استعمال کی کوئی فیس نہیں۔",
    // Landing page: example questions, principles, security grid, previews.
    "Grounds for post-arrest bail under Section 497 Cr.P.C.": "دفعہ 497 ضابطہ فوجداری کے تحت بعد از گرفتاری ضمانت کی بنیادیں",
    "Procedure for khula in the Family Court": "فیملی کورٹ میں خلع کا طریقۂ کار",
    "Maintenance for children after divorce": "طلاق کے بعد بچوں کا نان نفقہ",
    "Quashing an FIR under Section 561-A Cr.P.C.": "دفعہ 561-A ضابطہ فوجداری کے تحت ایف آئی آر کا اخراج",
    "Limitation for filing a civil revision": "سول نظرِ ثانی دائر کرنے کی میعاد",
    "Court hours of the civil courts in Punjab": "پنجاب کی دیوانی عدالتوں کے اوقاتِ کار",
    "Grounded": "مستند",
    "Every answer is built from past judgments and the official text of the law — never from the model’s memory.": "ہر جواب سابقہ فیصلوں اور قانون کے سرکاری متن سے بنتا ہے — کبھی ماڈل کی یادداشت سے نہیں۔",
    "A reviewer step reads each judgment it found and keeps only the ones that truly answer your question.": "جانچ کا ایک مرحلہ ہر ملنے والا فیصلہ پڑھتا ہے اور صرف وہی رکھتا ہے جو واقعی آپ کے سوال کا جواب دیتے ہیں۔",
    "Cited": "باحوالہ",
    "Every source is numbered in the answer and opens the court’s or the government’s own document.": "جواب میں ہر ماخذ نمبر شدہ ہے اور عدالت یا حکومت کی اپنی دستاویز کھولتا ہے۔",
    "Ask in English or Urdu and get an answer grounded in past judgments, with every source linked. Then run your files, fees and hearings from the same secure workspace.": "انگریزی یا اردو میں سوال پوچھیں اور سابقہ فیصلوں پر مبنی جواب پائیں، ہر حوالے کے لنک کے ساتھ۔ پھر اپنی فائلیں، فیسیں اور پیشیاں اسی محفوظ ورک اسپیس سے چلائیں۔",
    "Ask the way you would ask a senior colleague. Justice AI works out what you mean, searches past judgments and statutes, checks what it found, and writes a clear answer with the authorities cited as it goes.": "ویسے ہی پوچھیں جیسے کسی سینئر ساتھی سے پوچھتے ہیں۔ جسٹس اے آئی آپ کا مطلب سمجھتا ہے، سابقہ فیصلوں اور قوانین میں تلاش کرتا ہے، ملنے والے مواد کی جانچ کرتا ہے، اور نظائر کے حوالوں کے ساتھ واضح جواب لکھتا ہے۔",
    "Integrity checked": "سالمیت کی جانچ شدہ",
    "Hira Saleem uploaded": "حرا سلیم نے اپ لوڈ کیا",
    "Imran Ali viewed": "عمران علی نے دیکھا",
    "Ayesha Khan downloaded": "عائشہ خان نے ڈاؤن لوڈ کیا",
    "Maker-checker approval": "میکر چیکر منظوری",
    "“The retrieved judgments do not address this point.” — said plainly, instead of inventing an authority.": "”حاصل شدہ فیصلے اس نکتے پر بات نہیں کرتے۔“ — صاف الفاظ میں، کوئی نظیر گھڑنے کے بجائے۔",
    "Answer in Urdu": "اردو میں جواب",
    "Ready": "تیار",
    "Private": "نجی",
    "Sections 420, 468 and 471 PPC are invoked in the FIR, registered at Police Station Sadar.": "ایف آئی آر میں دفعات 420، 468 اور 471 تعزیراتِ پاکستان لگائی گئی ہیں، جو تھانہ صدر میں درج ہوئی۔",
    "page {n}": "صفحہ {n}",
    "Ayesha Khan": "عائشہ خان",
    "Imran Ali": "عمران علی",
    "Hira Saleem": "حرا سلیم",
    "Past judgments": "سابقہ فیصلے",
    "Official text": "سرکاری متن",
    "Court rules": "عدالتی قواعد",
    // Live demo and showcase.
    "See it in action": "اسے عمل میں دیکھیں",
    "The whole practice, one screen at a time.": "پوری پریکٹس، ایک وقت میں ایک اسکرین۔",
    "Real screens from Justice AI. Pick a module, or let them play.": "جسٹس اے آئی کی اصل اسکرینیں۔ کوئی ماڈیول چنیں، یا انہیں خود چلنے دیں۔",
    "Researching…": "تحقیق جاری ہے…",
    "A question in English or Urdu, the research steps as they happen, and an answer with every source linked.": "انگریزی یا اردو میں سوال، تحقیق کے مراحل جیسے جیسے ہوتے ہیں، اور ہر ماخذ کے لنک کے ساتھ جواب۔",
    "Today’s hearings, outstanding fees, entries waiting for your approval and recent research, on one screen.": "آج کی پیشیاں، واجب الادا فیسیں، آپ کی منظوری کے منتظر اندراجات اور حالیہ تحقیق، ایک ہی اسکرین پر۔",
    "Every hearing with its court, time and case number — and a WhatsApp reminder before each date.": "ہر پیشی اپنی عدالت، وقت اور کیس نمبر کے ساتھ — اور ہر تاریخ سے پہلے واٹس ایپ یاددہانی۔",
    "Fees, expenses and payments per client and case. A partner approves each entry before it counts.": "ہر کلائنٹ اور مقدمے کے لحاظ سے فیسیں، اخراجات اور ادائیگیاں۔ شمار ہونے سے پہلے پارٹنر ہر اندراج منظور کرتا ہے۔",
    "Petitions, orders and evidence filed under the right client and case, encrypted before storage.": "درخواستیں، احکام اور ثبوت درست کلائنٹ اور مقدمے کے تحت، محفوظ ہونے سے پہلے اِنکرپٹڈ۔",
    "Upload an FIR or a judgment and ask questions answered only from that document.": "ایف آئی آر یا فیصلہ اپ لوڈ کریں اور ایسے سوال پوچھیں جن کا جواب صرف اسی دستاویز سے دیا جائے۔",
    // Security, FAQ and About pages.
    "Uploaded": "اپ لوڈ",
    "A file is added under its client and case, from the vault or straight from a case file.": "فائل اس کے کلائنٹ اور مقدمے کے تحت شامل کی جاتی ہے، والٹ سے یا سیدھی کیس فائل سے۔",
    "Encrypted in the app": "ایپ کے اندر اِنکرپٹ",
    "Justice AI encrypts it with AES-256-GCM before it leaves the server. The key never goes to storage.": "سرور سے نکلنے سے پہلے جسٹس اے آئی اسے AES-256-GCM سے اِنکرپٹ کرتا ہے۔ کلید کبھی اسٹوریج تک نہیں جاتی۔",
    "Stored scrambled": "اِنکرپٹڈ حالت میں محفوظ",
    "Only ciphertext reaches Cloudflare R2 or your S3-compatible bucket. The provider cannot read it.": "Cloudflare R2 یا آپ کے S3 ہم آہنگ بکٹ تک صرف اِنکرپٹڈ ڈیٹا پہنچتا ہے۔ فراہم کنندہ اسے پڑھ نہیں سکتا۔",
    "Checked when opened": "کھولتے وقت جانچ",
    "On every open the file is decrypted and its integrity verified. A modified file is refused, never served.": "ہر بار کھولنے پر فائل ڈی کرپٹ ہوتی ہے اور اس کی سالمیت جانچی جاتی ہے۔ تبدیل شدہ فائل مسترد کر دی جاتی ہے، کبھی پیش نہیں کی جاتی۔",
    "Money": "رقم",
    "Locked once approved": "منظوری کے بعد مقفل",
    "Approved entries cannot be edited. A mistake is corrected by voiding the entry with a reason, which stays on record.": "منظور شدہ اندراجات میں ترمیم نہیں ہو سکتی۔ غلطی کی اصلاح وجہ درج کر کے اندراج کالعدم کرنے سے ہوتی ہے، جو ریکارڈ پر رہتی ہے۔",
    "Owner": "مالک",
    "Partner": "پارٹنر",
    "Research, case files and the vault": "تحقیق، کیس فائلیں اور والٹ",
    "Record fees, expenses and payments": "فیسیں، اخراجات اور ادائیگیاں درج کرنا",
    "Approve or reject billing entries": "بلنگ اندراجات منظور یا مسترد کرنا",
    "Delete a vault document": "والٹ کی دستاویز حذف کرنا",
    "View the vault activity log": "والٹ کا سرگرمی ریکارڈ دیکھنا",
    "Invite members and set roles": "اراکین کو مدعو کرنا اور کردار مقرر کرنا",
    "Change firm settings": "فرم کی ترتیبات بدلنا",
    "Own uploads": "صرف اپنی اپ لوڈز",
    "In practice": "عملی طور پر",
    "Protection you can see on every file and every rupee.": "تحفظ جو آپ ہر فائل اور ہر روپے پر دیکھ سکتے ہیں۔",
    "Open any document and you see its encryption and integrity status. Open the log and you see who touched it. Open the books and you see who recorded and who approved.": "کوئی بھی دستاویز کھولیں تو اس کی اِنکرپشن اور سالمیت کی حالت نظر آتی ہے۔ ریکارڈ کھولیں تو معلوم ہوتا ہے کس نے اسے چھوا۔ حساب کھولیں تو نظر آتا ہے کس نے درج کیا اور کس نے منظور کیا۔",
    "Safeguards": "حفاظتی اقدامات",
    "Documents, money and research, each protected in its own way.": "دستاویزات، رقم اور تحقیق، ہر ایک اپنے طریقے سے محفوظ۔",
    "Roles": "کردار",
    "Who can do what in your firm.": "آپ کی فرم میں کون کیا کر سکتا ہے۔",
    "Everyone works from the same client files; each role sees the actions that suit it. Nobody can approve an entry they recorded themselves.": "سب ایک ہی کلائنٹ فائلوں پر کام کرتے ہیں؛ ہر کردار کو اس کے مطابق اختیارات نظر آتے ہیں۔ کوئی بھی اپنا درج کردہ اندراج خود منظور نہیں کر سکتا۔",
    "Action": "عمل",
    "What happens when the law reports don’t cover my question?": "جب لاء رپورٹس میرے سوال کا احاطہ نہ کریں تو کیا ہوتا ہے؟",
    "The answer says so plainly. Justice AI never fills a gap with an invented authority; it tells you the retrieved judgments do not address the point and suggests how to narrow or rephrase the question.": "جواب صاف الفاظ میں یہی بتاتا ہے۔ جسٹس اے آئی کبھی خلا کو گھڑی ہوئی نظیر سے نہیں بھرتا؛ یہ بتاتا ہے کہ حاصل شدہ فیصلے اس نکتے پر بات نہیں کرتے اور سوال کو محدود یا دوبارہ ترتیب دینے کا مشورہ دیتا ہے۔",
    "Urdu and voice": "اردو اور آواز",
    "Can I ask by voice?": "کیا میں آواز سے پوچھ سکتا ہوں؟",
    "Yes. Press the microphone button and ask in Urdu, English or Roman Urdu; the question is transcribed and researched like any typed question.": "جی ہاں۔ مائیکروفون بٹن دبائیں اور اردو، انگریزی یا رومن اردو میں پوچھیں؛ سوال تحریر میں بدل کر ویسے ہی تحقیق کیا جاتا ہے جیسے لکھا ہوا سوال۔",
    "Practice tools": "پریکٹس کے اوزار",
    "How do I invite my team?": "میں اپنی ٹیم کو کیسے مدعو کروں؟",
    "From the Team page the firm owner invites colleagues by email as partner, associate or clerk. They accept the invitation with their own account, and the owner can change roles later.": "ٹیم کے صفحے سے فرم کا مالک ساتھیوں کو ای میل کے ذریعے پارٹنر، ایسوسی ایٹ یا کلرک کے طور پر مدعو کرتا ہے۔ وہ اپنے اکاؤنٹ سے دعوت قبول کرتے ہیں، اور مالک بعد میں کردار بدل سکتا ہے۔",
    "Security & privacy": "سکیورٹی اور رازداری",
    "Is a document I upload for analysis used to answer other people?": "کیا تجزیے کے لیے اپ لوڈ کی گئی دستاویز دوسروں کے جوابات میں استعمال ہوتی ہے؟",
    "No. A PDF you upload for analysis is visible to you alone and is used only to answer your own questions about it.": "نہیں۔ تجزیے کے لیے اپ لوڈ کی گئی پی ڈی ایف صرف آپ کو نظر آتی ہے اور صرف اس کے بارے میں آپ کے اپنے سوالات کے جواب میں استعمال ہوتی ہے۔",
    "Still have a question?": "کوئی سوال باقی ہے؟",
    "The About page explains how answers are made and what is in the collection.": "ہمارے بارے میں کا صفحہ بتاتا ہے کہ جوابات کیسے بنتے ہیں اور ذخیرے میں کیا شامل ہے۔",
    "Judge profiles": "جج صاحبان کے پروفائل",
    "Sitting and former judges of the superior courts": "اعلیٰ عدالتوں کے موجودہ اور سابق جج صاحبان",
    "Justice AI is a legal workspace for Pakistani advocates, law firms and students. It brings past judgments of the superior and district courts and the federal and Punjab statutes into one place you can question in English or Urdu — and around that research it provides the tools a practice runs on: an encrypted document vault, maker-checker billing and a case diary with reminders.": "جسٹس اے آئی پاکستانی وکلاء، لاء فرموں اور طلبہ کے لیے ایک قانونی ورک اسپیس ہے۔ یہ اعلیٰ اور ضلعی عدالتوں کے سابقہ فیصلوں اور وفاقی اور پنجاب کے قوانین کو ایک جگہ جمع کرتا ہے جن سے آپ انگریزی یا اردو میں سوال کر سکتے ہیں — اور اس تحقیق کے ساتھ وہ اوزار بھی فراہم کرتا ہے جن پر پریکٹس چلتی ہے: اِنکرپٹڈ دستاویزی والٹ، میکر چیکر بلنگ اور یاددہانیوں والی کیس ڈائری۔",
    "Eight modules, one workspace.": "آٹھ ماڈیول، ایک ورک اسپیس۔",
    "Principles": "اصول",
    "What we hold ourselves to.": "جن اصولوں کے ہم پابند ہیں۔",
    // Front door, client portal, Find a lawyer, sharing and public profile.
    "I’m a lawyer or munshi": "میں وکیل یا منشی ہوں",
    "Manage your cases, hearing dates, clients and fees in one place.": "اپنے مقدمات، پیشیوں کی تاریخیں، کلائنٹس اور فیسیں ایک جگہ سنبھالیں۔",
    "My lawyer shared a case with me": "میرے وکیل نے مجھ سے کیس شیئر کیا ہے",
    "See your hearing dates, fees and receipts. Sign in with your email address.": "اپنی پیشیوں کی تاریخیں، فیسیں اور رسیدیں دیکھیں۔ اپنے ای میل ایڈریس سے سائن اِن کریں۔",
    "Find a lawyer": "وکیل تلاش کریں",
    "Search listed lawyers by city and area of law. Free, no account needed.": "شہر اور شعبۂ قانون کے لحاظ سے درج وکلاء تلاش کریں۔ مفت، اکاؤنٹ کی ضرورت نہیں۔",
    "How can we help you today?": "آج ہم آپ کی کیا مدد کر سکتے ہیں؟",
    "Choose the door that fits you.": "وہ راستہ چنیں جو آپ کے لیے ہے۔",
    "New here as a lawyer?": "بطور وکیل نئے ہیں؟",
    "Create a free account": "مفت اکاؤنٹ بنائیں",
    "Sign out": "سائن آؤٹ",
    "See the case your lawyer shared": "وہ کیس دیکھیں جو آپ کے وکیل نے شیئر کیا",
    "Enter the code we emailed": "وہ کوڈ درج کریں جو ہم نے ای میل کیا",
    "Sign in with the email address your lawyer used to share the case. We will send you a one-time code — no password needed.": "اسی ای میل ایڈریس سے سائن اِن کریں جس پر آپ کے وکیل نے کیس شیئر کیا۔ ہم آپ کو یک بارگی کوڈ بھیجیں گے — پاس ورڈ کی ضرورت نہیں۔",
    "A 6-digit code was sent to": "6 ہندسوں کا کوڈ بھیجا گیا ہے:",
    "It works for 10 minutes.": "یہ 10 منٹ تک کارآمد ہے۔",
    "Send me a code": "مجھے کوڈ بھیجیں",
    "Open my cases": "میرے مقدمات کھولیں",
    "Resend in {n}s": "{n} سیکنڈ میں دوبارہ بھیجیں",
    "Only the cases your lawyer has shared with this email are shown. Your lawyer can withdraw access at any time.": "صرف وہی مقدمات دکھائے جاتے ہیں جو آپ کے وکیل نے اس ای میل سے شیئر کیے ہیں۔ آپ کا وکیل کسی بھی وقت رسائی واپس لے سکتا ہے۔",
    "No shared cases right now": "اس وقت کوئی شیئر شدہ کیس نہیں",
    "When your lawyer shares a case with {email}, it will appear here.": "جب آپ کا وکیل {email} سے کوئی کیس شیئر کرے گا تو وہ یہاں نظر آئے گا۔",
    "Your cases": "آپ کے مقدمات",
    "Next hearing": "اگلی پیشی",
    "Fees": "فیسیں",
    "Expenses": "اخراجات",
    "Paid": "ادا شدہ",
    "Hearing dates": "پیشیوں کی تاریخیں",
    "No hearing dates have been entered for this case yet.": "اس کیس کی کوئی پیشی ابھی درج نہیں کی گئی۔",
    "Fees and receipts": "فیسیں اور رسیدیں",
    "No fees or payments have been recorded for this case yet.": "اس کیس کی کوئی فیس یا ادائیگی ابھی درج نہیں کی گئی۔",
    "Ref": "حوالہ",
    "Lawyers listed on Justice AI.": "جسٹس اے آئی پر درج وکلاء۔",
    "Search by city and area of law. Every lawyer here keeps their cases, hearings and accounts on Justice AI and has chosen to be listed.": "شہر اور شعبۂ قانون کے لحاظ سے تلاش کریں۔ یہاں موجود ہر وکیل اپنے مقدمات، پیشیاں اور حسابات جسٹس اے آئی پر رکھتا ہے اور اس نے خود فہرست میں شامل ہونے کا انتخاب کیا ہے۔",
    "Search by name, court or specialty…": "نام، عدالت یا شعبے سے تلاش کریں…",
    "All cities": "تمام شہر",
    "All areas of law": "قانون کے تمام شعبے",
    "No listed lawyers match yet": "ابھی کوئی درج وکیل نہیں ملا",
    "Try another city or area of law. Lawyers appear here once they complete their public profile on Justice AI.": "کوئی اور شہر یا شعبہ آزمائیں۔ وکلاء یہاں تب نظر آتے ہیں جب وہ جسٹس اے آئی پر اپنی عوامی پروفائل مکمل کر لیں۔",
    "1 lawyer": "1 وکیل",
    "{n} lawyers": "{n} وکلاء",
    "{n} yrs": "{n} سال",
    "All lawyers": "تمام وکلاء",
    "{n} years of practice": "{n} سال کی پریکٹس",
    "Courts": "عدالتیں",
    "Languages": "زبانیں",
    "On Justice AI since": "جسٹس اے آئی پر از",
    "Contact": "رابطہ",
    "Reach the lawyer directly. Justice AI does not take part in the engagement.": "وکیل سے براہِ راست رابطہ کریں۔ جسٹس اے آئی اس معاملے میں فریق نہیں ہوتا۔",
    "Message on WhatsApp": "واٹس ایپ پر پیغام بھیجیں",
    "Share with client": "کلائنٹ سے شیئر کریں",
    "Shared. We emailed {email} a link to the client portal.": "شیئر ہو گیا۔ ہم نے {email} کو کلائنٹ پورٹل کا لنک ای میل کر دیا ہے۔",
    "Remove this client’s access to the case?": "اس کلائنٹ کی اس کیس تک رسائی ختم کر دیں؟",
    "The client signs in at the client portal with this email and a one-time code — no password. They see the hearing dates, approved fees and payments of this case only.": "کلائنٹ اسی ای میل اور یک بارگی کوڈ سے کلائنٹ پورٹل پر سائن اِن کرتا ہے — پاس ورڈ نہیں۔ اسے صرف اسی کیس کی پیشیوں کی تاریخیں، منظور شدہ فیسیں اور ادائیگیاں نظر آتی ہیں۔",
    "Share": "شیئر کریں",
    "Who can see this case": "یہ کیس کون دیکھ سکتا ہے",
    "Not shared with anyone yet.": "ابھی کسی سے شیئر نہیں کیا گیا۔",
    "Shared {date}": "{date} کو شیئر کیا گیا",
    "Remove access": "رسائی ختم کریں",
    "Your name": "آپ کا نام",
    "At least one area of law": "قانون کا کم از کم ایک شعبہ",
    "A short introduction (40+ characters)": "مختصر تعارف (کم از کم 40 حروف)",
    "A phone number or email": "فون نمبر یا ای میل",
    "Public profile — Find a lawyer": "عوامی پروفائل — وکیل تلاش کریں",
    "Listed": "فہرست میں شامل",
    "Not listed": "فہرست میں شامل نہیں",
    "Clients looking for a lawyer can find you by city and area of law. Your name, city, areas, introduction and contact details are shown; your cases and clients never are.": "وکیل کی تلاش میں کلائنٹس آپ کو شہر اور شعبۂ قانون سے ڈھونڈ سکتے ہیں۔ آپ کا نام، شہر، شعبے، تعارف اور رابطے کی تفصیل دکھائی جاتی ہے؛ آپ کے مقدمات اور کلائنٹس کبھی نہیں۔",
    "Areas of law": "قانون کے شعبے",
    "Or type your own, separated by commas": "یا اپنے شعبے لکھیں، کوما سے الگ کر کے",
    "Introduction": "تعارف",
    "Who you are, what you handle, and where you appear. 2–4 sentences.": "آپ کون ہیں، کس قسم کے مقدمات دیکھتے ہیں، اور کہاں پیش ہوتے ہیں۔ 2 سے 4 جملے۔",
    "Years of practice": "پریکٹس کے سال",
    "Courts you appear in": "جن عدالتوں میں آپ پیش ہوتے ہیں",
    "Lahore High Court, Sessions Court Lahore": "لاہور ہائی کورٹ، سیشن کورٹ لاہور",
    "Urdu, English, Punjabi": "اردو، انگریزی، پنجابی",
    "Before you can be listed": "فہرست میں آنے سے پہلے",
    "List me in Find a lawyer": "مجھے \"وکیل تلاش کریں\" میں شامل کریں",
    "Press Edit profile to change these.": "یہ بدلنے کے لیے پروفائل میں ترمیم دبائیں۔",
    "Criminal": "فوجداری",
    "Family": "خاندانی",
    "Civil": "دیوانی",
    "Property": "جائیداد",
    "Corporate": "کارپوریٹ",
    "Tax": "ٹیکس",
    "Labour": "لیبر",
    "Banking": "بینکنگ",
    "Constitutional": "آئینی",
    "Immigration": "امیگریشن",
    "Intellectual property": "املاکِ دانش",
    "Service": "سروس",
    "Client case": "کلائنٹ کا کیس",
    "Linking the hearing to a case shows it to the client if you share that case.": "پیشی کو کیس سے جوڑنے پر، اگر آپ وہ کیس شیئر کریں تو یہ کلائنٹ کو نظر آتی ہے۔",
    "Not linked to a case": "کسی کیس سے منسلک نہیں",
    "For clients": "کلائنٹس کے لیے",
    "cash": "نقد",
    "bank_transfer": "بینک ٹرانسفر",
    "cheque": "چیک",
    "online": "آن لائن",
    "other": "دیگر",
};
