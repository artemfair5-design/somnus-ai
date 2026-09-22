'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ONBOARDING_KEY = 'somnus_onboarding_done';

export function isOnboardingDone(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function markOnboardingDone(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_KEY, '1');
}

const SLIDES = [
  {
    icon: Moon,
    emoji: '🌙',
    title: 'Надиктуй сон утром',
    description: 'Голосом или текстом — за 30 секунд. AI разберёт по Юнгу, Фромму, Холлису. Без эзотерики, по-научному.',
    accent: 'from-amber-200/30 to-violet-400/30',
  },
  {
    icon: Sparkles,
    emoji: '✨',
    title: 'Получи глубокий анализ',
    description: 'Эмоции, архетипы, связь с дневными событиями. И долгосрочные паттерны за 3, 6, 12 месяцев.',
    accent: 'from-violet-400/30 to-cyan-300/30',
  },
  {
    icon: Lock,
    emoji: '🔒',
    title: 'Всё зашифровано',
    description: 'End-to-end шифрование AES-256. Ключ есть только у тебя. Даже мы не видим твои сны.',
    accent: 'from-cyan-300/30 to-emerald-300/30',
  },
];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const Icon = slide.icon;

  const next = () => {
    if (isLast) {
      markOnboardingDone();
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const skip = () => {
    markOnboardingDone();
    onComplete();
  };

  return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="flex justify-end">
        <button
          onClick={skip}
          className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          Пропустить
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <div
              className={`inline-flex items-center justify-center w-28 h-28 rounded-3xl bg-gradient-to-br ${slide.accent} border border-white/10 mb-8 text-6xl`}
            >
              {slide.emoji}
            </div>
            <h2 className="font-serif text-3xl mb-4">{slide.title}</h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="max-w-md mx-auto w-full space-y-4">
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-8 bg-amber-200' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
        <Button onClick={next} size="lg" className="w-full gap-2">
          {isLast ? 'Начать' : 'Дальше'}
          {!isLast && <ArrowRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
