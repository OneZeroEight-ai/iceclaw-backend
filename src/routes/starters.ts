import { Hono } from 'hono'
import type { StarterAgent } from '../types.js'

const app = new Hono()

const STARTERS: StarterAgent[] = [
  { id: 'executive-assistant', name: 'Executive Assistant', emoji: '👔', tagline: 'Manages your inbox, calendar, and daily briefings', skills: ['web-search', 'email-sender', 'calendar'] },
  { id: 'research-analyst', name: 'Research Analyst', emoji: '🔍', tagline: 'Deep research on any topic, with citations', skills: ['web-search', 'browser', 'summarize'] },
  { id: 'wisdom-judge', name: 'The Wisdom Judge', emoji: '⚖️', tagline: 'Strategic decisions through the Noble Eightfold Path', skills: ['web-search'] },
  { id: 'morning-briefer', name: 'Morning Briefer', emoji: '☀️', tagline: 'Daily briefing delivered to Telegram at 8am', skills: ['web-search', 'weather'] },
  { id: 'inbox-manager', name: 'Inbox Manager', emoji: '📬', tagline: 'Reads, prioritizes, and drafts email responses', skills: ['email-sender'] },
  { id: 'competitive-intel', name: 'Competitive Intel', emoji: '🕵️', tagline: 'Monitors competitors and surfaces insights weekly', skills: ['web-search', 'browser'] },
  { id: 'growth-strategist', name: 'Growth Strategist', emoji: '📈', tagline: 'GTM strategy, market analysis, growth planning', skills: ['web-search', 'browser'] },
  { id: 'legal-analyst', name: 'Legal Analyst', emoji: '📋', tagline: 'Contract review, compliance, regulatory research', skills: ['web-search', 'browser', 'summarize'] },
]

app.get('/starters', (c) => c.json(STARTERS))

export const starterRoutes = app
