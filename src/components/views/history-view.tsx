'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Moon, Mic, Trash2, Filter, X, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DecryptedEntry, formatDate } from '@/lib/entries';

interface HistoryViewProps {
  entries: DecryptedEntry[];
  loading: boolean;
  onSelect: (e: DecryptedEntry) => void;
  onDelete: (id: string) => void;
}

export function HistoryView({ entries, loading, onSelect, onDelete }: HistoryViewProps) {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'dream' | 'anxiety'>('all');
  const [filterEmotion, setFilterEmotion] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Собираем все уникальные эмоции
  const allEmotions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      e.analysis?.emotions?.forEach((em) => set.add(em.name));
      if (e.topEmotion) set.add(e.topEmotion);
    });
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Поиск по тексту (расшифрованному на клиенте)
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchesText =
          e.content?.toLowerCase().includes(q) ||
          e.dayEvents?.toLowerCase().includes(q) ||
          e.analysis?.summary?.toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      // Фильтр по типу
      if (filterType !== 'all' && e.entryType !== filterType) return false;
      // Фильтр по эмоции
      if (filterEmotion !== 'all') {
        const hasEmotion = e.analysis?.emotions?.some((em) => em.name === filterEmotion)
          || e.topEmotion === filterEmotion;
        if (!hasEmotion) return false;
      }
      return true;
    });
  }, [entries, query, filterType, filterEmotion]);

  const hasActiveFilters = query || filterType !== 'all' || filterEmotion !== 'all';

  const clearFilters = () => {
    setQuery('');
    setFilterType('all');
    setFilterEmotion('all');
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-secondary/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl md:text-3xl">История</h1>
        <Badge variant="outline" className="text-xs">
          {filtered.length} / {entries.length}
        </Badge>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по содержимому…"
            className="pl-9 bg-background/40"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="icon"
          onClick={() => setShowFilters((s) => !s)}
          className="flex-shrink-0"
        >
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="grid grid-cols-2 gap-2"
        >
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="bg-background/40">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="dream">🌙 Сны</SelectItem>
              <SelectItem value="anxiety">💫 Тревоги</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEmotion} onValueChange={setFilterEmotion}>
            <SelectTrigger className="bg-background/40">
              <SelectValue placeholder="Эмоция" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все эмоции</SelectItem>
              {allEmotions.map((em) => (
                <SelectItem key={em} value={em}>{em}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 self-start">
          <X className="w-3 h-3" /> Сбросить фильтры
        </Button>
      )}

      {/* Entries */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center backdrop-blur-xl bg-card/40 border-white/10">
          <Moon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-1">
            {entries.length === 0 ? 'Пока пусто' : 'Ничего не найдено'}
          </p>
          <p className="text-xs text-muted-foreground/70">
            {entries.length === 0
              ? 'Запиши свой первый сон — он появится здесь'
              : 'Попробуй изменить запрос или сбросить фильтры'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <Card
                className="p-4 backdrop-blur-xl bg-card/40 border-white/10 hover:border-white/20 transition-all cursor-pointer group"
                onClick={() => onSelect(entry)}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{entry.entryType === 'dream' ? '🌙' : '💫'}</span>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </p>
                      {entry.editedAt && (
                        <p className="text-[10px] text-muted-foreground/60">
                          изменено {formatDate(entry.editedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.moodScore !== null && (
                      <span className="text-sm font-mono text-amber-200">{entry.moodScore}</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(entry.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-foreground/80 line-clamp-2 mb-2">
                  {entry.content}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.inputMethod === 'voice' && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Mic className="w-2.5 h-2.5" /> Голос
                    </Badge>
                  )}
                  {entry.topEmotion && (
                    <Badge variant="outline" className="text-[10px]">{entry.topEmotion}</Badge>
                  )}
                  {entry.analysis?.symbols?.[0] && (
                    <Badge variant="outline" className="text-[10px] text-violet-300">
                      {entry.analysis.symbols[0].archetype}
                    </Badge>
                  )}
                  <span className="text-[10px] text-emerald-300/60 flex items-center gap-1 ml-auto">
                    <Lock className="w-2.5 h-2.5" /> Зашифровано
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
