'use client';

import { useMemo, useState } from 'react';
import styles from './FAQExplorer.module.css';

export type FAQItem = {
  category: string;
  question: string;
  answer: string;
};

const CATEGORIES = ['All', 'Account', 'Miners', 'Rewards', 'Wallet', 'Bonus', 'Referral', 'Security', 'Platform', 'Legal'];

export default function FAQExplorer({ items }: { items: FAQItem[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const categoryMatch = category === 'All' || item.category === category;
      if (!categoryMatch) return false;
      if (!q) return true;
      return `${item.category} ${item.question} ${item.answer}`.toLowerCase().includes(q);
    });
  }, [items, query, category]);

  return (
    <div className={styles.explorer}>
      <div className={styles.searchRow}>
        <label className={styles.searchBox}>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find your answer…"
            aria-label="Search frequently asked questions"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>
          ) : null}
        </label>
      </div>

      <div className={styles.filters} aria-label="FAQ categories">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className={category === item ? styles.active : ''}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className={styles.meta}>
        <span>{filtered.length} answer{filtered.length === 1 ? '' : 's'}</span>
        {query || category !== 'All' ? <span>Filtered from {items.length}</span> : <span>Browse every topic</span>}
      </div>

      {filtered.length ? (
        <div className={styles.list}>
          {filtered.map((item) => (
            <details key={`${item.category}:${item.question}`}>
              <summary>
                <span className={styles.category}>{item.category}</span>
                <span>{item.question}</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <strong>No matching answer yet.</strong>
          <p>Try another keyword or browse a different category. For account-specific issues, use the official Contact channel or signed-in Support Center.</p>
        </div>
      )}
    </div>
  );
}
