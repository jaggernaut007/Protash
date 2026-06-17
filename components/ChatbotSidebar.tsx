'use client';

import React, { useState, useEffect } from 'react';
import { useCode } from '@/context/CodeContext';
import { useSavedComponentContext } from '@/context/SavedComponentContext';
import SavedComponentsPanel from '@/components/SavedComponentsPanel';
import { SavedComponent } from '@/lib/useSavedComponents';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

type SuggestedAction = { title: string; prompt: string; category: string; mode?: 'simple' | 'detailed' };
const suggestedActions: SuggestedAction[] = [
  {
    title: 'Zen Vibes',
    category: 'Calm',
    prompt: 'Create a peaceful meditation app with calming colors, breathing guides, nature sounds, and a journal for my thoughts. I want it to feel like a sanctuary for relaxation.',
    mode: 'detailed',
  },
  {
    title: 'Creative Flow',
    category: 'Inspiration',
    prompt: 'Design an inspiration board with mood-based prompts, color palettes, and mood photography. Help me capture my creative energy throughout the day.',
    mode: 'detailed',
  },
  {
    title: 'Energy Tracker',
    category: 'Wellness',
    prompt: 'Build a fun way to track my daily energy levels with mood emojis, energy boosters, and motivational quotes. Make it playful and positive.',
    mode: 'detailed',
  },
  {
    title: 'Night Wind Down',
    category: 'Sleep',
    prompt: 'Create an evening routine app with ambient visuals, relaxation techniques, and a sleep timer. Help me transition peacefully to sleep.',
    mode: 'detailed',
  },
  {
    title: 'Adventure Builder',
    category: 'Exploration',
    prompt: 'Design an app that helps me plan spontaneous activities based on my mood. Show me local events, weather, and fun suggestions.',
    mode: 'detailed',
  },
];

export default function ChatbotSidebar() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'ai',
      content: 'Hey there! 👋 What\'s your mood today? Tell me how you\'re feeling and I\'ll help you create a personalized app that perfectly matches your vibe.',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const { code, setCode } = useCode();
  const [mode, setMode] = useState<'detailed' | 'simple'>('simple');
  const [isLoading, setIsLoading] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const { loadedComponentName, clearLoadedComponent } = useSavedComponentContext();

  // When a component is loaded from saved, add a system message
  useEffect(() => {
    if (loadedComponentName) {
      const loadMessage: Message = {
        id: `load_${Date.now()}`,
        role: 'ai',
        content: `✅ Loaded: "${loadedComponentName}". You can now request updates or modifications!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, loadMessage]);
      clearLoadedComponent();
    }
  }, [loadedComponentName, clearLoadedComponent]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
          currentComponentCode: code || null, // Pass current component for improvements
          mode,
        }),
      });

      if (!res.ok) throw new Error('Agent request failed');
      const data = await res.json();

      // Check if multi-agent system approved the component
      if (data.approved && data.reply) {
        // Show which agents were active
        if (data.skippedAgents && data.skippedAgents.length > 0) {
          const skipMessage: Message = {
            id: (Date.now()).toString(),
            role: 'ai',
            content: `ℹ️ Skipped: ${data.skippedAgents.join(', ')} (not required for this request)`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, skipMessage]);
        }

        // Show agent approval summary
        const summaryMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: data.summary,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, summaryMessage]);

        // Show each agent's feedback
        if (data.agentFeedback && Array.isArray(data.agentFeedback)) {
          data.agentFeedback.forEach((feedback: any, index: number) => {
            const feedbackMessage: Message = {
              id: `${Date.now() + index + 2}`,
              role: 'ai',
              content: `**${feedback.agentName}** ${feedback.approved ? '✅' : '❌'}: ${feedback.feedback}`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, feedbackMessage]);
          });
        }

        // Render on canvas
        setCode(data.reply);
      } else {
        // Component rejected by agents
        const rejectionMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: data.summary || 'Component rejected by agent review system.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, rejectionMessage]);

        // Show individual agent feedback for rejected components
        if (data.agentFeedback && Array.isArray(data.agentFeedback)) {
          data.agentFeedback.forEach((feedback: any, index: number) => {
            const feedbackMessage: Message = {
              id: `${Date.now() + index + 2}`,
              role: 'ai',
              content: `**${feedback.agentName}** ${feedback.approved ? '✅' : '❌'}: ${feedback.feedback}${
                feedback.suggestions?.length > 0 ? '\n\nSuggestions:\n' + feedback.suggestions.map((s: string) => `• ${s}`).join('\n') : ''
              }`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, feedbackMessage]);
          });
        }
      }
    } catch (err) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: 'I ran into an issue reaching the agent. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedAction = (sa: SuggestedAction) => {
    setInputValue(sa.prompt);
    if (sa.mode) setMode(sa.mode);
  };

  const handleNewChat = () => {
    // Reset component code
    setCode('');
    // Reset messages to initial state
    setMessages([
      {
        id: '1',
        role: 'ai',
        content: 'Hey there! 👋 What\'s your mood today? Tell me how you\'re feeling and I\'ll help you create a personalized app that perfectly matches your vibe.',
        timestamp: new Date(),
      },
    ]);
    // Clear input
    setInputValue('');
  };

  const handleLoadFromSaved = (component: SavedComponent) => {
    setCode(component.code);
    const loadMessage: Message = {
      id: `load_${Date.now()}`,
      role: 'ai',
      content: `✅ Loaded: "${component.name}". You can now request updates or modifications!`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, loadMessage]);
    setShowSavedPanel(false);
  };

  return (
    <div className="w-[400px] max-h-[85vh] glass-panel-lg flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-white/40 flex items-center justify-between gap-3 bg-white/40">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Ashley</h2>
          <p className="text-xs text-gray-600 mt-0.5">Your mood-based app creator</p>
        </div>
      </div>

      {/* Mode & Action Buttons */}
      <div className="px-6 pt-4 pb-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-lg border border-gray-300/50 bg-white/40 overflow-hidden">
          <button
            onClick={() => setMode('simple')}
            className={`px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'simple'
                ? 'bg-gray-900 text-white shadow-steel'
                : 'text-gray-700 hover:text-gray-900'
            }`}
            title="Keep it simple and clean"
          >
            Simple
          </button>
          <button
            onClick={() => setMode('detailed')}
            className={`px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === 'detailed'
                ? 'bg-gray-900 text-white shadow-steel'
                : 'text-gray-700 hover:text-gray-900'
            }`}
            title="Add all the features"
          >
            Detailed
          </button>
        </div>
        <button
          onClick={() => setShowSavedPanel(!showSavedPanel)}
          className="glass-button-secondary text-xs px-2.5 py-1.5"
          title="View saved components"
        >
          📋
        </button>
        <button
          onClick={handleNewChat}
          className="glass-button-secondary text-xs px-2.5 py-1.5"
          title="Start a new chat"
        >
          ✨
        </button>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-xl p-3 text-sm ${
                message.role === 'user'
                  ? 'bg-gray-900 text-white shadow-steel font-medium'
                  : 'glass-panel text-gray-900 font-mono text-xs'
              }`}
            >
              {message.content}
            </div>
            <span className="text-xs text-gray-500 mt-1">
              {message.timestamp.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="glass-panel p-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Saved Components Panel */}
      {showSavedPanel && (
        <div className="border-t border-white/40 bg-white/20 backdrop-blur-sm p-4 max-h-[180px] overflow-y-auto">
          <p className="text-xs font-semibold text-gray-800 mb-3">Your Mood Board:</p>
          <SavedComponentsPanel onLoadComponent={handleLoadFromSaved} />
        </div>
      )}

      {/* Mood Ideas */}
      <div className="px-6 py-3 border-t border-white/40 bg-white/20 backdrop-blur-sm">
        <p className="text-xs font-semibold text-gray-800 mb-2">Mood ideas:</p>
        <div className="flex flex-wrap gap-2">
          {suggestedActions.slice(0, 3).map((sa, index) => (
            <button
              key={index}
              onClick={() => handleSuggestedAction(sa)}
              className="glass-button-secondary text-xs px-2 py-1 truncate"
              title={sa.title}
            >
              {sa.title.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-6 border-t border-white/40 bg-white/20 backdrop-blur-sm">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Tell me your mood..."
            className="input-glass pr-12"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="absolute right-1 p-2 text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={!inputValue.trim() || isLoading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
