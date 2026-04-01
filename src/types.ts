export interface AgentInfo {
  id: string
  name: string
  emoji: string
  telegramBot: string | null
  model: string
  status: string
}

export interface StarterAgent {
  id: string
  name: string
  emoji: string
  tagline: string
  skills: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}
