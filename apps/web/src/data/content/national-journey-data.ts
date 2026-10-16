export interface NationalQuestionOption {
  id: 'A' | 'B' | 'C';
  text: string;
  isCorrect: boolean;
}

export interface NationalQuestion {
  id: string;
  prompt: string;
  options: NationalQuestionOption[];
  factEn: string;
  factAr: string;
}

export interface NationalJourneyStage {
  id: string;
  stageNumber: number;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  missionEn: string;
  missionAr: string;
  badgeTitleEn: string;
  badgeTitleAr: string;
  badgeIcon: 'history' | 'cities' | 'nature' | 'heritage';
  accentColor: string;
  questions: NationalQuestion[];
}

export interface PledgePromptConfig {
  id: 'dream' | 'promise' | 'pride';
  numberLabel: string;
  titleEn: string;
  questionAr: string;
  questionEn: string;
  placeholderEn: string;
  suggestions: Array<{
    labelAr: string;
    textEn: string;
  }>;
}

export const NATIONAL_INITIATIVE_META = {
  slug: 'national-pride',
  initiativeTitleAr: 'مبادرة في القلب وطن وقيادة',
  initiativeTitleEn: 'In Our Hearts: Homeland & Leadership',
  mainTitleAr: 'رحلة المجد',
  mainTitleEn: 'Journey of Glory',
  mottoEn: 'A heart full of loyalty. A voice full of pride. A future full of promise.',
  mottoAr: 'قلبٌ يعتز، وصوتٌ يفخر، ومستقبلٌ نصنعه بالعلم والعمل.',
  audioTrackUrl: '/audio/saudi-national-melody.mp3',
} as const;

export const NATIONAL_JOURNEY_STAGES: NationalJourneyStage[] = [
  {
    id: 'history',
    stageNumber: 1,
    titleEn: 'Journey 1: The History of Saudi Arabia',
    titleAr: 'المرحلة الأولى: تاريخ المملكة العربية السعودية',
    subtitleEn: 'Discover the deep roots and glorious history of our homeland!',
    subtitleAr: 'اكتشفي الجذور الراسخة والتاريخ المجيد لوطننا الغالي!',
    missionEn: 'Answer all five questions and earn the History Pioneer badge!',
    missionAr: 'أجيبي عن الأسئلة الخمسة لتحصلي على وسام رائدة التاريخ!',
    badgeTitleEn: 'History Pioneer',
    badgeTitleAr: 'رائدة التاريخ',
    badgeIcon: 'history',
    accentColor: 'from-emerald-600 to-teal-700',
    questions: [
      {
        id: 'h-q1',
        prompt: 'When was the First Saudi State established?',
        options: [
          { id: 'A', text: '1727', isCorrect: true },
          { id: 'B', text: '1902', isCorrect: false },
          { id: 'C', text: '1932', isCorrect: false },
        ],
        factEn: 'The First Saudi State was founded in 1727, celebrated annually as Saudi Founding Day on February 22.',
        factAr: 'تأسست الدولة السعودية الأولى عام 1727م، ونحتفي بذكراها سنوياً في «يوم التأسيس» الموافق 22 فبراير.',
      },
      {
        id: 'h-q2',
        prompt: 'Who founded the First Saudi State?',
        options: [
          { id: 'A', text: 'King Abdulaziz', isCorrect: false },
          { id: 'B', text: 'Imam Muhammad bin Saud', isCorrect: true },
          { id: 'C', text: 'King Salman', isCorrect: false },
        ],
        factEn: 'Imam Muhammad bin Saud established the First Saudi State in Diriyah, laying the foundation for unity and stability.',
        factAr: 'أسس الإمام محمد بن سعود الدولة السعودية الأولى وعاصمتها الدرعية، واضعاً ركائز الوحدة والاستقرار.',
      },
      {
        id: 'h-q3',
        prompt: 'Who unified the Kingdom of Saudi Arabia?',
        options: [
          { id: 'A', text: 'King Faisal', isCorrect: false },
          { id: 'B', text: 'King Abdulaziz', isCorrect: true },
          { id: 'C', text: 'King Saud', isCorrect: false },
        ],
        factEn: 'King Abdulaziz bin Abdulrahman Al Saud unified the Kingdom in 1932 after an epic 30-year journey.',
        factAr: 'وحّد الملك عبدالعزيز بن عبدالرحمن آل سعود -طيب الله ثراه- المملكة عام 1932م بعد ملحمة بطولية خالدة.',
      },
      {
        id: 'h-q4',
        prompt: 'When is Saudi National Day celebrated?',
        options: [
          { id: 'A', text: 'September 23', isCorrect: true },
          { id: 'B', text: 'February 22', isCorrect: false },
          { id: 'C', text: 'December 2', isCorrect: false },
        ],
        factEn: 'Saudi National Day is celebrated every year on September 23 to commemorate the unification of the Kingdom.',
        factAr: 'نحتفي باليوم الوطني السعودي في 23 سبتمبر من كل عام تخليداً لذكرى توحيد المملكة العربية السعودية.',
      },
      {
        id: 'h-q5',
        prompt: 'What is the capital city of Saudi Arabia?',
        options: [
          { id: 'A', text: 'Jeddah', isCorrect: false },
          { id: 'B', text: 'Makkah', isCorrect: false },
          { id: 'C', text: 'Riyadh', isCorrect: true },
        ],
        factEn: 'Riyadh is the capital and largest city of Saudi Arabia, and the host city for World Expo 2030.',
        factAr: 'الرياض هي عاصمة المملكة العربية السعودية وقلبها النابض، ومستضيفة معرض إكسبو الدولي 2030.',
      },
    ],
  },
  {
    id: 'cities',
    stageNumber: 2,
    titleEn: 'Journey 2: Cities of Saudi Arabia',
    titleAr: 'المرحلة الثانية: مدن المملكة العربية السعودية',
    subtitleEn: 'Discover the cities that tell the story of our homeland!',
    subtitleAr: 'تعرّفي على المدن العريقة التي تروي حكاية وطننا العظيم!',
    missionEn: 'Complete this journey to earn the Cities Explorer badge!',
    missionAr: 'أتمّي هذه المرحلة لتحصلي على وسام سفيرة المدن!',
    badgeTitleEn: 'Cities Explorer',
    badgeTitleAr: 'سفيرة المدن',
    badgeIcon: 'cities',
    accentColor: 'from-teal-600 to-cyan-700',
    questions: [
      {
        id: 'c-q1',
        prompt: 'Which city is home to the Holy Kaaba?',
        options: [
          { id: 'A', text: 'Makkah', isCorrect: true },
          { id: 'B', text: 'Madinah', isCorrect: false },
          { id: 'C', text: 'Dammam', isCorrect: false },
        ],
        factEn: 'Makkah Al-Mukarramah is the holiest city in Islam and the direction of prayer (Qiblah) for Muslims worldwide.',
        factAr: 'مكة المكرمة هي أقدس بقاع الأرض ومهبط الوحي وقبلة المسلمين في أنحاء العالم.',
      },
      {
        id: 'c-q2',
        prompt: "Which blessed city is home to the Prophet's Mosque (Al-Masjid An-Nabawi)?",
        options: [
          { id: 'A', text: 'Madinah', isCorrect: true },
          { id: 'B', text: 'Abha', isCorrect: false },
          { id: 'C', text: 'Tabuk', isCorrect: false },
        ],
        factEn: 'Al-Madinah Al-Munawwarah is the second holiest city in Islam and the cradle of Islamic civilization.',
        factAr: 'المدينة المنورة (طيبة الطيبة) تحتضن المسجد النبوي الشريف وهي ثاني أقدس المدن في الإسلام.',
      },
      {
        id: 'c-q3',
        prompt: 'Which Saudi city is famous for its historic Al-Balad district?',
        options: [
          { id: 'A', text: 'Tabuk', isCorrect: false },
          { id: 'B', text: 'Jazan', isCorrect: false },
          { id: 'C', text: 'Jeddah', isCorrect: true },
        ],
        factEn: 'Historic Jeddah (Al-Balad) is a UNESCO World Heritage site known for its distinctive coral-stone architecture and Rawasheen.',
        factAr: 'تشتهر جدة بمنطقة «البلد» التاريخية المسجلة في اليونسكو برواشينها الحجازية العريقة على ساحل البحر الأحمر.',
      },
      {
        id: 'c-q4',
        prompt: 'Which city is famous for its cool weather, mountains, and beautiful scenery?',
        options: [
          { id: 'A', text: 'Abha', isCorrect: true },
          { id: 'B', text: 'Riyadh', isCorrect: false },
          { id: 'C', text: 'Jubail', isCorrect: false },
        ],
        factEn: 'Abha, the Bride of the Mountain in the Asir region, is famous for its misty peaks, green terraces, and pleasant climate.',
        factAr: 'تُلقب أبها بـ«عروس الجبل» في منطقة عسير، وتتميز بطبيعتها الخضراء وضبابها الذي يعانق قمم الجبال.',
      },
      {
        id: 'c-q5',
        prompt: 'Which Saudi city is famous for the ancient archaeological site of Hegra (Al-Hijr)?',
        options: [
          { id: 'A', text: 'Taif', isCorrect: false },
          { id: 'B', text: 'AlUla', isCorrect: true },
          { id: 'C', text: 'Yanbu', isCorrect: false },
        ],
        factEn: 'AlUla is home to Hegra (Al-Hijr), Saudi Arabia’s first UNESCO World Heritage site with breathtaking rock-cut monuments.',
        factAr: 'تحتضن العُلا موقع «الحِجر» الأثري، وهو أول موقع سعودي يُدرج في قائمة التراث العالمي لليونسكو.',
      },
    ],
  },
  {
    id: 'nature',
    stageNumber: 3,
    titleEn: 'Journey 3: The Land and Nature of Saudi Arabia',
    titleAr: 'المرحلة الثالثة: أرض المملكة وطبيعتها الساحرة',
    subtitleEn: 'Explore the deserts, mountains, seas, and natural wonders of our homeland!',
    subtitleAr: 'استكشفي الصحاري، الجبال، البحار، والروائع الطبيعية في وطننا!',
    missionEn: 'Answer all five questions and earn the Nature Explorer badge!',
    missionAr: 'أجيبي عن الأسئلة الخمسة لتحصلي على وسام مستكشفة الطبيعة!',
    badgeTitleEn: 'Nature Explorer',
    badgeTitleAr: 'مستكشفة الطبيعة',
    badgeIcon: 'nature',
    accentColor: 'from-amber-500 to-emerald-700',
    questions: [
      {
        id: 'n-q1',
        prompt: 'What is the largest continuous sand desert in Saudi Arabia?',
        options: [
          { id: 'A', text: 'The Sahara Desert', isCorrect: false },
          { id: 'B', text: 'The Empty Quarter', isCorrect: true },
          { id: 'C', text: 'The Gobi Desert', isCorrect: false },
        ],
        factEn: 'The Empty Quarter (Rub’ al Khali) is the largest contiguous sand desert in the world, famous for its golden dunes.',
        factAr: 'الربع الخالي هو أكبر صحراء رملية متصلة في العالم، ويمتاز بكثبانه الذهبية الساحرة.',
      },
      {
        id: 'n-q2',
        prompt: 'Which sea lies to the west of Saudi Arabia?',
        options: [
          { id: 'A', text: 'The Red Sea', isCorrect: true },
          { id: 'B', text: 'The Mediterranean Sea', isCorrect: false },
          { id: 'C', text: 'The Arabian Sea', isCorrect: false },
        ],
        factEn: 'The Red Sea lies to the west of the Kingdom and hosts some of the world’s most vibrant coral reefs.',
        factAr: 'يحد المملكة غرباً البحر الأحمر، الذي يضم واحداً من أجمل الأنظمة البيئية والشعاب المرجانية في العالم.',
      },
      {
        id: 'n-q3',
        prompt: 'Which mountain range is famous in southwestern Saudi Arabia?',
        options: [
          { id: 'A', text: 'The Alps', isCorrect: false },
          { id: 'B', text: 'The Andes', isCorrect: false },
          { id: 'C', text: 'The Sarawat Mountains', isCorrect: true },
        ],
        factEn: 'The Sarawat Mountains run along the western coast, featuring majestic peaks and Juniper forests.',
        factAr: 'تمتد سلسلة جبال السروات الشامخة في غرب وجنوب غرب المملكة وتكسوها غابات العرعر الخضراء.',
      },
      {
        id: 'n-q4',
        prompt: 'Which gulf lies to the east of Saudi Arabia?',
        options: [
          { id: 'A', text: 'The Gulf of Aden', isCorrect: false },
          { id: 'B', text: 'The Arabian Gulf', isCorrect: true },
          { id: 'C', text: 'The Gulf of Mexico', isCorrect: false },
        ],
        factEn: 'The Arabian Gulf borders Saudi Arabia to the east, a vital hub for global energy, trade, and pearl heritage.',
        factAr: 'يطل شرق المملكة على الخليج العربي، الذي يمثل شرياناً اقتصادياً وتاريخياً عريقاً.',
      },
      {
        id: 'n-q5',
        prompt: 'What is Farasan Islands famous for?',
        options: [
          { id: 'A', text: 'Coral reefs and marine life', isCorrect: true },
          { id: 'B', text: 'Snow-covered mountains', isCorrect: false },
          { id: 'C', text: 'Large freshwater lakes', isCorrect: false },
        ],
        factEn: 'The Farasan Islands in Jazan are a UNESCO Biosphere Reserve famous for pristine coral reefs and Arabian gazelles.',
        factAr: 'تشتهر جزر فرسان في جازان بشعابها المرجانية البكر وحياتها البحرية النادرة ومحمية الغزال العربي.',
      },
    ],
  },
  {
    id: 'heritage',
    stageNumber: 4,
    titleEn: 'Journey 4: Our Precious Heritage',
    titleAr: 'المرحلة الرابعة: تراثنا الأصيل وعاداتنا العريقة',
    subtitleEn: 'Discover the traditions, crafts, and customs that make Saudi Arabia unique!',
    subtitleAr: 'اكتشفي التقاليد والحرف اليدوية والقيم الأصيلة التي تميّز وطننا!',
    missionEn: 'Discover the treasures of Saudi heritage and earn the Heritage Guardian badge!',
    missionAr: 'اكتشفي كنوز التراث السعودي لتحصلي على وسام حارسة التراث!',
    badgeTitleEn: 'Heritage Guardian',
    badgeTitleAr: 'حارسة التراث',
    badgeIcon: 'heritage',
    accentColor: 'from-amber-600 to-yellow-700',
    questions: [
      {
        id: 'he-q1',
        prompt: 'What is a traditional Saudi symbol of hospitality?',
        options: [
          { id: 'A', text: 'Serving coffee and dates', isCorrect: true },
          { id: 'B', text: 'Serving ice cream', isCorrect: false },
          { id: 'C', text: 'Serving sandwiches', isCorrect: false },
        ],
        factEn: 'Serving Saudi coffee and dates is the timeless emblem of generosity and warm welcome across every region of the Kingdom.',
        factAr: 'تقديم القهوة السعودية والتمر هو الرمز الأصيل للكرم والحفاوة والترحيب بالضيف في كل بيت سعودي.',
      },
      {
        id: 'he-q2',
        prompt: 'Which traditional craft uses colorful geometric patterns woven into fabric?',
        options: [
          { id: 'A', text: 'Pottery', isCorrect: false },
          { id: 'B', text: 'Al-Sadu weaving', isCorrect: true },
          { id: 'C', text: 'Glassmaking', isCorrect: false },
        ],
        factEn: 'Al-Sadu traditional weaving is inscribed on UNESCO’s Intangible Cultural Heritage list, showcasing Bedouin creativity.',
        factAr: 'حياكة «السدو» التقليدية بنقوشها الهندسية البديعة مسجلة في قائمة اليونسكو للتراث الثقافي غير المادي.',
      },
      {
        id: 'he-q3',
        prompt: 'What is the traditional Saudi folk dance often performed at national celebrations?',
        options: [
          { id: 'A', text: 'Ballet', isCorrect: false },
          { id: 'B', text: 'Tango', isCorrect: false },
          { id: 'C', text: 'Ardah', isCorrect: true },
        ],
        factEn: 'The Saudi Ardah combines poetry, drums, and swords, symbolizing pride, unity, and national dignity.',
        factAr: 'العرضة السعودية هي رقصة العز والفخر والوحدة الوطنية في المناسبات الكبرى، وهي مسجلة في التراث العالمي.',
      },
      {
        id: 'he-q4',
        prompt: 'What is traditionally used to serve Saudi Arabic coffee?',
        options: [
          { id: 'A', text: 'A dallah', isCorrect: true },
          { id: 'B', text: 'A teapot', isCorrect: false },
          { id: 'C', text: 'A water bottle', isCorrect: false },
        ],
        factEn: 'The traditional golden Dallah and Finjan are iconic symbols of Saudi hospitality and heritage.',
        factAr: 'تُقدَّم القهوة السعودية الأصيلة في «الدلّة» والفنجان، وهما رمزان عريقان للكرم والأصالة.',
      },
      {
        id: 'he-q5',
        prompt: 'What do traditional Saudi customs teach us to value?',
        options: [
          { id: 'A', text: 'Competition only', isCorrect: false },
          { id: 'B', text: 'Hospitality and respect', isCorrect: true },
          { id: 'C', text: 'Wealth above everything', isCorrect: false },
        ],
        factEn: 'Saudi values are built upon hospitality, generosity, honoring parents, respect, and helping others.',
        factAr: 'تربّينا عاداتنا السعودية الأصيلة على الكرم، الشهامة، الاحترام، بر الوالدين، والوفاء للوطن وقيادته.',
      },
    ],
  },
];

export const FINAL_CHAPTER_PROMPTS: PledgePromptConfig[] = [
  {
    id: 'dream',
    numberLabel: '01',
    titleEn: 'My Dream for Saudi Arabia',
    questionAr: 'ما الحلم الذي تتمنين أن يتحقق لوطنك؟',
    questionEn: 'What dream do you hope to see come true for your homeland?',
    placeholderEn: 'Write your dream for Saudi Arabia in English (or tap a card below)...',
    suggestions: [
      {
        labelAr: 'ريادة عالمية في العلوم والتقنية',
        textEn: 'I dream of seeing Saudi Arabia lead the world in science, innovation, and green technology under Vision 2030.',
      },
      {
        labelAr: 'وجهة أولى للسلام والثقافة والمعرفة',
        textEn: 'My dream is for my homeland to always shine as a global beacon of peace, knowledge, and cultural heritage.',
      },
      {
        labelAr: 'نهضة طبية وتعليمية تبهر العالم',
        textEn: 'I hope to see Saudi universities, hospitals, and smart cities become the most advanced in the world.',
      },
    ],
  },
  {
    id: 'promise',
    numberLabel: '02',
    titleEn: 'My Promise in Action',
    questionAr: 'ما العمل الذي ستبدئين به لتسهمي في مستقبل وطنك؟',
    questionEn: 'What action will you start today to contribute to your homeland’s future?',
    placeholderEn: 'Write your personal promise in action...',
    suggestions: [
      {
        labelAr: 'التفوق الدراسي وإتقان اللغة الإنجليزية',
        textEn: 'I will work hard in my studies and master the English language to represent Saudi Arabia proudly to the world.',
      },
      {
        labelAr: 'الابتكار وخدمة المجتمع والحفاظ على البيئة',
        textEn: 'I promise to develop my skills, protect our environment, and volunteer to serve my school and community.',
      },
      {
        labelAr: 'تحويل العلم إلى إنجازات ترفع راية الوطن',
        textEn: 'I will turn my knowledge into real achievements and uphold our noble Saudi values of respect and responsibility.',
      },
    ],
  },
  {
    id: 'pride',
    numberLabel: '03',
    titleEn: 'A Message of Pride',
    questionAr: 'اكتبي رسالة قصيرة تعبّرين فيها عن اعتزازك بالملك سلمان وولي العهد الأمير محمد بن سلمان، وتطلعاتك لمستقبل المملكة.',
    questionEn: 'Write a short message expressing your pride in King Salman and Crown Prince Mohammed bin Salman, and your hopes for the Kingdom.',
    placeholderEn: 'Write your message of loyalty and pride...',
    suggestions: [
      {
        labelAr: 'فخر وولاء لخادم الحرمين الشريفين وولي عهده الأمين',
        textEn: 'We are deeply proud of King Salman and Crown Prince Mohammed bin Salman for inspiring us to dream big and build a prosperous future.',
      },
      {
        labelAr: 'عهد الوفاء لقيادتنا الرشيدة ورؤية 2030',
        textEn: 'Thank you to our wise leadership, King Salman and Crown Prince Mohammed bin Salman, for turning ambitious visions into reality.',
      },
      {
        labelAr: 'دعاء واعتزاز بوطن العز وقيادته الملهمة',
        textEn: 'With loyalty and gratitude to King Salman and Crown Prince Mohammed bin Salman, we march confidently toward a bright Saudi future.',
      },
    ],
  },
];

export const IMMORTAL_PLEDGE_STATEMENT = {
  titleEn: "I Am Part of Saudi Arabia's Story",
  titleAr: 'أنا جزءٌ من حكاية وطني',
  bodyEn:
    "I carry my homeland's identity with pride. I honor its leadership through respect and responsibility. I will turn my knowledge into achievement and my dreams into meaningful contributions to Saudi Arabia's future.",
  bodyAr:
    'أحمل هوية وطني بفخر، وأعبّر عن اعتزازي بقيادته بالاحترام والمسؤولية، وأحوّل علمي إلى إنجاز، وأحلامي إلى إسهامات تصنع مستقبل المملكة.',
  certificateTitleEn: 'Saudi Homeland Ambassador',
  certificateTitleAr: 'سفيرة الوطن',
  certificateReasonEn:
    'For completing Journey of Glory and expressing pride, belonging, and commitment to the future of Saudi Arabia.',
  certificateReasonAr:
    'لإتمام رحلة المجد والتعبير عن الاعتزاز والانتماء والالتزام بالمساهمة في مستقبل المملكة العربية السعودية.',
} as const;
