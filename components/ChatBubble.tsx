import React, { useState } from 'react';
import { Message, Sender } from '../types';
import { Bot, User, Volume2, Loader2, Link as LinkIcon } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isAi = message.sender === Sender.AI;
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const handleSpeak = async () => {
    if (isPlaying) return; // Simple prevent overlap for now
    try {
      setLoadingAudio(true);
      // Strip markdown symbols and LaTeX for TTS clarity
      const cleanText = message.text
        .replace(/\$\$/g, '')
        .replace(/\$/g, '')
        .replace(/[*#_`]/g, '');
        
      const audioBuffer = await generateSpeech(cleanText);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioContext.decodeAudioData(audioBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(audioContext.destination);
      source.start(0);
      
      setIsPlaying(true);
      source.onended = () => setIsPlaying(false);
    } catch (e) {
      console.error("TTS Error", e);
    } finally {
      setLoadingAudio(false);
    }
  };

  return (
    <div className={`flex w-full mb-6 ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] ${isAi ? 'flex-row' : 'flex-row-reverse'} gap-3`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isAi ? 'bg-indigo-600' : 'bg-slate-600'}`}>
          {isAi ? <Bot size={18} className="text-white" /> : <User size={18} className="text-white" />}
        </div>

        {/* Content */}
        <div className={`flex flex-col ${isAi ? 'items-start' : 'items-end'} w-full min-w-0`}>
          <div className={`px-5 py-4 rounded-2xl w-full ${
            isAi 
              ? 'bg-slate-800 text-slate-100 rounded-tr-none border border-slate-700' 
              : 'bg-indigo-600 text-white rounded-tl-none'
          }`}>
            {message.image && (
              <img src={message.image} alt="User upload" className="max-w-full rounded-lg mb-3 border border-slate-500/50" />
            )}
            
            <div className={`prose prose-sm md:prose-base max-w-none ${isAi ? 'prose-invert' : 'text-white prose-headings:text-white prose-strong:text-white prose-p:text-white prose-li:text-white'}`}>
               <ReactMarkdown
                 remarkPlugins={[remarkMath]}
                 rehypePlugins={[rehypeKatex]}
               >
                 {message.text}
               </ReactMarkdown>
            </div>
            
            {message.sources && message.sources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-700/50">
                <p className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1">
                   <LinkIcon size={12}/> المصادر:
                </p>
                <div className="flex flex-wrap gap-2">
                  {message.sources.map((source, idx) => (
                    <a 
                      key={idx} 
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs bg-slate-900/50 hover:bg-slate-900 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 transition-colors truncate max-w-[200px]"
                    >
                      {source.title || new URL(source.uri).hostname}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions (Only for AI) */}
          {isAi && (
            <div className="mt-1 flex gap-2">
              <button 
                onClick={handleSpeak}
                disabled={loadingAudio || isPlaying}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-400 transition-colors p-1"
              >
                {loadingAudio ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                {isPlaying ? 'جار التشغيل...' : 'استمع'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;