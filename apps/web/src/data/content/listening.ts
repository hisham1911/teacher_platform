import type { ListeningActivity } from './types';

export const listeningActivities: ListeningActivity[] = [
  {
    slug: 'introducing-yourself',
    titleEn: 'Introducing Yourself',
    titleAr: 'تقديم نفسك',
    level: 'easy',
    mediaUrl: '',
    audioUrl: '/content/audio/introducing-yourself.mp3',
    audioScript: `Sarah: Hello! My name is Sarah. I am from Saudi Arabia. Nice to meet you!
Alex: Hi Sarah! My name is Alex. It is very nice to meet you too. Where are you from in Saudi Arabia?
Sarah: I am from Riyadh. Welcome to our school!`,
    questions: [
      {
        id: 'li-1',
        prompt: 'What is the polite phrase when meeting someone for the first time?',
        options: [
          { text: 'Goodbye', isCorrect: false },
          { text: 'Nice to meet you', isCorrect: true },
          { text: 'How old are you?', isCorrect: false },
          { text: 'Where is the door?', isCorrect: false },
        ],
      },
      {
        id: 'li-2',
        prompt: 'Where is Sarah from?',
        options: [
          { text: 'London', isCorrect: false },
          { text: 'Dubai', isCorrect: false },
          { text: 'Riyadh', isCorrect: true },
          { text: 'Cairo', isCorrect: false },
        ],
      },
      {
        id: 'li-3',
        prompt: '"I am FROM Saudi Arabia" — what does the preposition FROM indicate?',
        options: [
          { text: 'مكان الأصل أو الموطن', isCorrect: true },
          { text: 'الوجهة المستقبلية', isCorrect: false },
          { text: 'الوقت والزمان', isCorrect: false },
          { text: 'وسيلة المواصلات', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'asking-for-directions',
    titleEn: 'Asking for Directions',
    titleAr: 'السؤال عن الاتجاهات',
    level: 'easy',
    mediaUrl: '',
    audioUrl: '/content/audio/asking-for-directions.mp3',
    audioScript: `Visitor: Excuse me! Could you please tell me how to get to the city library?
Local Guide: Sure! Go straight ahead, then turn right at the traffic lights. Walk for two minutes, and the library will be on your left next to the park.
Visitor: Thank you very much!
Local Guide: You are welcome!`,
    questions: [
      {
        id: 'dir-1',
        prompt: 'Which polite question is used to ask for directions?',
        options: [
          { text: 'Tell me direction quickly!', isCorrect: false },
          { text: 'Where is library now?', isCorrect: false },
          { text: 'Could you please tell me how to get to the library?', isCorrect: true },
          { text: 'Give me map immediately!', isCorrect: false },
        ],
      },
      {
        id: 'dir-2',
        prompt: 'What direction should the visitor turn at the traffic lights?',
        options: [
          { text: 'Turn left', isCorrect: false },
          { text: 'Turn right', isCorrect: true },
          { text: 'Turn around', isCorrect: false },
          { text: 'Stop', isCorrect: false },
        ],
      },
      {
        id: 'dir-3',
        prompt: 'Where is the library located?',
        options: [
          { text: 'Next to the park', isCorrect: true },
          { text: 'Inside the mall', isCorrect: false },
          { text: 'Across the airport', isCorrect: false },
          { text: 'Under the bridge', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'ordering-food',
    titleEn: 'Ordering Food at a Restaurant',
    titleAr: 'طلب الطعام في المطعم',
    level: 'medium',
    mediaUrl: '',
    audioUrl: '/content/audio/ordering-food.mp3',
    audioScript: `Waiter: Good evening! Welcome to the Green Garden Restaurant. May I take your order?
Customer: Good evening! Yes, please. Could I have the grilled chicken with vegetables?
Waiter: Excellent choice. And what would you like to drink?
Customer: Just a glass of fresh orange juice with no ice, please.
Waiter: Certainly! Your order will be ready in ten minutes.`,
    questions: [
      {
        id: 'food-1',
        prompt: 'What does the waiter politely ask to begin the order?',
        options: [
          { text: 'Pay the bill please', isCorrect: false },
          { text: 'May I take your order?', isCorrect: true },
          { text: 'Why are you here?', isCorrect: false },
          { text: 'Eat your food quickly', isCorrect: false },
        ],
      },
      {
        id: 'food-2',
        prompt: 'What did the customer choose to eat?',
        options: [
          { text: 'Pizza with cheese', isCorrect: false },
          { text: 'Fish and rice', isCorrect: false },
          { text: 'Grilled chicken with vegetables', isCorrect: true },
          { text: 'Tomato soup', isCorrect: false },
        ],
      },
      {
        id: 'food-3',
        prompt: 'What drink did the customer order?',
        options: [
          { text: 'Fresh orange juice', isCorrect: true },
          { text: 'Hot coffee', isCorrect: false },
          { text: 'Cold soda', isCorrect: false },
          { text: 'Green tea', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'fluent-podcast-ep1',
    titleEn: 'Fluent English Podcast — Episode 1',
    titleAr: 'بودكاست إنجليزي طليق — الحلقة الأولى',
    level: 'easy',
    mediaUrl: '/content/videos/fluent-podcast-ep1.mp4',
    posterUrl: '/content/videos/posters/fluent-podcast-ep1.jpg',
    audioScript: `Presenter 1: Hi everyone! Welcome back.
Presenter 2: In today's episode, we share helpful phrases and tips for learning everyday spoken English naturally!`,
    questions: [
      {
        id: 'pod1-1',
        prompt: 'What is the podcast episode focused on?',
        options: [
          { text: 'Everyday spoken English', isCorrect: true },
          { text: 'Cooking Italian food', isCorrect: false },
          { text: 'History of airplanes', isCorrect: false },
          { text: 'Computer coding', isCorrect: false },
        ],
      },
      {
        id: 'pod1-2',
        prompt: 'What did the presenters say at the beginning of the podcast?',
        options: [
          { text: 'Hi everyone! Welcome back.', isCorrect: true },
          { text: 'Goodbye and see you next year.', isCorrect: false },
          { text: 'Please turn off the lights.', isCorrect: false },
          { text: 'We are closing today.', isCorrect: false },
        ],
      },
      {
        id: 'pod1-3',
        prompt: 'Which skill is improved most by listening to podcasts regularly?',
        options: [
          { text: 'Listening comprehension and pronunciation', isCorrect: true },
          { text: 'Handwriting speed', isCorrect: false },
          { text: 'Physical fitness', isCorrect: false },
          { text: 'Drawing skills', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'fluent-podcast-ep2',
    titleEn: 'Fluent English Podcast — Episode 2',
    titleAr: 'بودكاست إنجليزي طليق — الحلقة الثانية',
    level: 'medium',
    mediaUrl: '/content/videos/fluent-podcast-ep2.mp4',
    posterUrl: '/content/videos/posters/fluent-podcast-ep2.jpg',
    audioScript: `Host: Hi everyone! Welcome to our English podcast. Today we talk about communication and learning new vocabulary every day.`,
    questions: [
      {
        id: 'pod2-1',
        prompt: 'What is the main topic of this podcast dialogue?',
        options: [
          { text: 'Communication and daily vocabulary', isCorrect: true },
          { text: 'Buying a new smartphone', isCorrect: false },
          { text: 'Riding a bicycle in the rain', isCorrect: false },
          { text: 'Playing chess', isCorrect: false },
        ],
      },
      {
        id: 'pod2-2',
        prompt: 'Complete the sentence: "Welcome to our English ___"',
        options: [
          { text: 'podcast', isCorrect: true },
          { text: 'stadium', isCorrect: false },
          { text: 'airport', isCorrect: false },
          { text: 'kitchen', isCorrect: false },
        ],
      },
      {
        id: 'pod2-3',
        prompt: 'What advice does the podcast emphasize for learners?',
        options: [
          { text: 'Practice listening and learn words daily', isCorrect: true },
          { text: 'Stop speaking completely', isCorrect: false },
          { text: 'Never use English outside school', isCorrect: false },
          { text: 'Memorize the whole dictionary in one hour', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'prepositions-game',
    titleEn: 'Prepositions of Place Challenge',
    titleAr: 'تحدي حروف الجر المكانية',
    level: 'easy',
    mediaUrl: '/content/videos/prepositions-game.mp4',
    posterUrl: '/content/videos/posters/prepositions-game.jpg',
    audioScript: `Watch the colored cups game to master: in, on, under, behind, next to, between, near, in front of.`,
    questions: [
      {
        id: 'prep-1',
        prompt: 'Which preposition means "داخل الشيء" (inside something)?',
        options: [
          { text: 'in', isCorrect: true },
          { text: 'under', isCorrect: false },
          { text: 'behind', isCorrect: false },
          { text: 'between', isCorrect: false },
        ],
      },
      {
        id: 'prep-2',
        prompt: 'When something is "تحت الشيء", which word is used?',
        options: [
          { text: 'under', isCorrect: true },
          { text: 'on', isCorrect: false },
          { text: 'next to', isCorrect: false },
          { text: 'in front of', isCorrect: false },
        ],
      },
      {
        id: 'prep-3',
        prompt: 'The ball is ___ the two cups (بين الكوبين):',
        options: [
          { text: 'between', isCorrect: true },
          { text: 'near', isCorrect: false },
          { text: 'on', isCorrect: false },
          { text: 'in', isCorrect: false },
        ],
      },
      {
        id: 'prep-4',
        prompt: 'Which phrase means "بجانب" أو "بجوار"?',
        options: [
          { text: 'next to', isCorrect: true },
          { text: 'behind', isCorrect: false },
          { text: 'in', isCorrect: false },
          { text: 'under', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'daily-sentences',
    titleEn: 'Daily Sentences & Verb Patterns',
    titleAr: 'جمل الاستخدام اليومي وصيغ الأفعال',
    level: 'medium',
    mediaUrl: '/content/videos/daily-sentences.mp4',
    posterUrl: '/content/videos/posters/daily-sentences.jpg',
    audioScript: `Daily Use Sentences — Structure: Verb + Preposition + Gerund (-ing form).
Examples:
- I look forward to seeing you soon.
- She apologized for being late.
- They insisted on paying the bill.
- We dream of owning a house.
- He succeeded in passing the exam.`,
    questions: [
      {
        id: 'ds-1',
        prompt: 'Complete: "I look forward to ___ you soon."',
        options: [
          { text: 'seeing', isCorrect: true },
          { text: 'see', isCorrect: false },
          { text: 'saw', isCorrect: false },
          { text: 'seen', isCorrect: false },
        ],
      },
      {
        id: 'ds-2',
        prompt: 'Complete: "She apologized for ___ late."',
        options: [
          { text: 'being', isCorrect: true },
          { text: 'be', isCorrect: false },
          { text: 'was', isCorrect: false },
          { text: 'been', isCorrect: false },
        ],
      },
      {
        id: 'ds-3',
        prompt: 'What form of the verb follows a preposition in this structure?',
        options: [
          { text: 'Gerund (-ing form)', isCorrect: true },
          { text: 'Past simple (ed)', isCorrect: false },
          { text: 'Base verb only', isCorrect: false },
          { text: 'Infinitive with to', isCorrect: false },
        ],
      },
      {
        id: 'ds-4',
        prompt: 'Complete: "They insisted on ___ the bill."',
        options: [
          { text: 'paying', isCorrect: true },
          { text: 'pay', isCorrect: false },
          { text: 'paid', isCorrect: false },
          { text: 'pays', isCorrect: false },
        ],
      },
    ],
  },
];
