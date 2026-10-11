import type { ListeningActivity } from './types';

export const listeningActivities: ListeningActivity[] = [
  {
    slug: 'introducing-yourself',
    titleEn: 'Introducing Yourself',
    titleAr: 'تقديم نفسك',
    level: 'easy',
    mediaUrl: '',
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
];
