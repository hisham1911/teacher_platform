import type { ReadingPassage } from './types';

export const readingPassages: ReadingPassage[] = [
  {
    slug: 'my-daily-routine',
    titleEn: 'My Daily Routine',
    titleAr: 'روتيني اليومي',
    level: 'easy',
    text: `Every morning, I wake up at 6:30 AM. First, I brush my teeth and wash my face. Then, I have breakfast with my family. I usually eat bread with cheese and drink milk.

At 7:30, I go to school by bus. My school starts at 8:00 AM. I study many subjects like English, Math, and Science. My favorite subject is English because I love learning new words.

After school, I come home at 2:00 PM. I eat lunch and then rest for an hour. In the evening, I do my homework and read a book before I go to sleep at 10:00 PM.`,
    questions: [
      {
        id: 'dr-1',
        prompt: 'What time does the writer wake up?',
        options: [
          { text: '6:30 AM', isCorrect: true },
          { text: '7:30 AM', isCorrect: false },
          { text: '8:00 AM', isCorrect: false },
          { text: '10:00 PM', isCorrect: false },
        ],
      },
      {
        id: 'dr-2',
        prompt: 'How does the writer go to school?',
        options: [
          { text: 'By bus', isCorrect: true },
          { text: 'By car', isCorrect: false },
          { text: 'On foot', isCorrect: false },
          { text: 'By bicycle', isCorrect: false },
        ],
      },
      {
        id: 'dr-3',
        prompt: "What is the writer's favorite subject?",
        options: [
          { text: 'English', isCorrect: true },
          { text: 'Math', isCorrect: false },
          { text: 'Science', isCorrect: false },
          { text: 'Arabic', isCorrect: false },
        ],
      },
      {
        id: 'dr-4',
        prompt: 'What does the writer do before sleeping?',
        options: [
          { text: 'Does homework and reads a book', isCorrect: true },
          { text: 'Watches TV', isCorrect: false },
          { text: 'Plays games', isCorrect: false },
          { text: 'Eats dinner', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'healthy-habits',
    titleEn: 'Healthy Habits for Students',
    titleAr: 'عادات صحية للطلاب',
    level: 'easy',
    text: `Good health is very important for every student. To stay strong and active, you need to eat healthy food, drink plenty of water, and get enough sleep every night.

Eating fresh fruits and vegetables gives your brain the energy it needs to focus in class. You should also drink at least six glasses of water a day. Exercise, like walking or playing sports, helps you feel happy and relaxed.`,
    questions: [
      {
        id: 'hh-1',
        prompt: 'Why are fresh fruits and vegetables important for students?',
        options: [
          { text: 'They give the brain energy to focus', isCorrect: true },
          { text: 'They make you sleep quickly', isCorrect: false },
          { text: 'They replace water', isCorrect: false },
          { text: 'They help you write faster', isCorrect: false },
        ],
      },
      {
        id: 'hh-2',
        prompt: 'How many glasses of water should a student drink each day?',
        options: [
          { text: 'At least six glasses', isCorrect: true },
          { text: 'Only one glass', isCorrect: false },
          { text: 'Ten bottles', isCorrect: false },
          { text: 'Two glasses', isCorrect: false },
        ],
      },
      {
        id: 'hh-3',
        prompt: 'What does exercise help you feel?',
        options: [
          { text: 'Happy and relaxed', isCorrect: true },
          { text: 'Tired and bored', isCorrect: false },
          { text: 'Angry', isCorrect: false },
          { text: 'Sleepy all day', isCorrect: false },
        ],
      },
    ],
  },
  {
    slug: 'technology-in-learning',
    titleEn: 'Technology in Learning',
    titleAr: 'التكنولوجيا في التعلم',
    level: 'medium',
    text: `Technology has changed modern classrooms in amazing ways. Today, students can use tablets and laptops to search for information instantly. Digital platforms and interactive quizzes allow learners to practice at their own speed.

Teachers can also share video lessons and helpful quizzes with students at home. Technology makes education more exciting, interactive, and accessible for everyone.`,
    questions: [
      {
        id: 'tl-1',
        prompt: 'How do digital platforms help learners?',
        options: [
          { text: 'They allow learners to practice at their own speed', isCorrect: true },
          { text: 'They cancel all homework', isCorrect: false },
          { text: 'They replace teachers completely', isCorrect: false },
          { text: 'They make exams much longer', isCorrect: false },
        ],
      },
      {
        id: 'tl-2',
        prompt: 'What can teachers share with students at home?',
        options: [
          { text: 'Video lessons and helpful quizzes', isCorrect: true },
          { text: 'Heavy books only', isCorrect: false },
          { text: 'Paper cards only', isCorrect: false },
          { text: 'Nothing online', isCorrect: false },
        ],
      },
      {
        id: 'tl-3',
        prompt: 'Which word best describes modern technology in education?',
        options: [
          { text: 'Interactive and exciting', isCorrect: true },
          { text: 'Boring and slow', isCorrect: false },
          { text: 'Complicated and useless', isCorrect: false },
          { text: 'Silent', isCorrect: false },
        ],
      },
    ],
  },
];
