import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { SubjectType } from '../types';
import { createSubjectChat, generateVisualContent } from '../services/geminiService';
import { ArrowLeft, Video, Image as ImageIcon, Download, Search, Sparkles, Send, Bot, User, FileText, Loader2, ImagePlus } from 'lucide-react';
import { Chat } from "@google/genai";

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 image data
  isGeneratingImage?: boolean; // UI state for loading image
}

export const Subject: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { materials } = useApp();
  const [activeTab, setActiveTab] = useState<'content' | 'ai'>('content');
  
  // AI Chat State
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const subjectName = id as SubjectType;
  const filteredMaterials = materials.filter(m => m.subject === subjectName);

  // Initialize Chat Session when subject changes
  useEffect(() => {
    const session = createSubjectChat(subjectName);
    setChatSession(session);
    setMessages([{
      id: 'welcome',
      role: 'model',
      text: `Hello! I'm your AI tutor for ${subjectName}. Ask me anything, or ask for a diagram to visualize a concept!`
    }]);
  }, [subjectName]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !chatSession || isLoading) return;

    const userText = inputValue;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: userText
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 1. Send text message
      const result = await chatSession.sendMessage({ message: userText });
      
      // 2. Add the text response immediately
      const modelText = result.text || "";
      const modelMsgId = (Date.now() + 1).toString();
      
      setMessages(prev => [...prev, {
        id: modelMsgId,
        role: 'model',
        text: modelText
      }]);

      // 3. Check for Function Calls (Tool Usage)
      const functionCalls = result.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === 'generate_image') {
             const prompt = (call.args as any).prompt;
             
             // Add a temporary "Generating image..." indicator
             const imgLoadingId = (Date.now() + 2).toString();
             setMessages(prev => [...prev, {
                id: imgLoadingId,
                role: 'model',
                text: `🎨 Generating a diagram for: "${prompt}"...`,
                isGeneratingImage: true
             }]);

             // Execute the actual image generation
             const base64Image = await generateVisualContent(prompt);

             // Remove loading, add actual image message
             setMessages(prev => {
                const filtered = prev.filter(m => m.id !== imgLoadingId);
                if (base64Image) {
                    return [...filtered, {
                        id: (Date.now() + 3).toString(),
                        role: 'model',
                        text: `Here is the visual for: ${prompt}`,
                        image: base64Image
                    }];
                } else {
                    return [...filtered, {
                        id: (Date.now() + 3).toString(),
                        role: 'model',
                        text: `(I tried to generate an image for "${prompt}" but encountered an issue. Please try again.)`
                    }];
                }
             });

             // Send tool response back to AI to maintain conversation state
             // We send a simple "success" so the AI knows it showed the image
             await chatSession.sendMessage({
                 parts: [{
                     functionResponse: {
                         name: call.name,
                         response: { result: "Image displayed to user successfully." }
                     }
                 }]
             });
          }
        }
      }

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Sorry, I'm having trouble connecting right now. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

  // Simple formatter for bold text from markdown (**text**)
  const formatMessage = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const getMaterialIcon = (type: 'video' | 'photo' | 'note') => {
      switch(type) {
          case 'video': return <Video className="w-6 h-6" />;
          case 'photo': return <ImageIcon className="w-6 h-6" />;
          case 'note': return <FileText className="w-6 h-6" />;
      }
  };

  const getMaterialColor = (type: 'video' | 'photo' | 'note') => {
      switch(type) {
          case 'video': return 'bg-red-50 dark:bg-red-900/20 text-red-500';
          case 'photo': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-500';
          case 'note': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-500';
      }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col animate-fade-in-up">
      <div className="flex-none space-y-4">
        <Link to="/" className="inline-flex items-center text-primary-500 hover:text-primary-600 hover:underline transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
        </Link>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{subjectName}</h1>
            
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-auto">
                <button 
                    onClick={() => setActiveTab('content')}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'content' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    Materials
                </button>
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 sm:flex-none flex items-center justify-center px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ai' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Tutor
                </button>
            </div>
        </div>
      </div>

      {activeTab === 'content' ? (
        <div className="grid gap-4 overflow-y-auto pb-4 custom-scrollbar">
          {filteredMaterials.length === 0 ? (
             <div className="text-center py-20 bg-white dark:bg-dark-card rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 animate-pulse">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No materials uploaded for this subject yet.</p>
             </div>
          ) : (
            filteredMaterials.map((item, idx) => (
                <div 
                    key={item.id} 
                    className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
                    style={{ animationDelay: `${idx * 100}ms` }}
                >
                    <div className="flex items-center space-x-4 w-full sm:w-auto">
                        <div className={`p-4 rounded-xl flex-shrink-0 ${getMaterialColor(item.type)}`}>
                            {getMaterialIcon(item.type)}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-lg dark:text-gray-200 truncate pr-2">{item.title}</h3>
                            <p className="text-xs text-gray-500 font-medium mt-1 flex items-center">
                                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded mr-2 uppercase">{item.type}</span>
                                <span>{item.size}</span>
                                <span className="mx-2">•</span>
                                {new Date(item.uploadDate).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleDownload(item.url, item.title)}
                        className="mt-4 sm:mt-0 w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-bold transition dark:text-gray-300"
                    >
                        <Download className="w-4 h-4 mr-2" /> Download
                    </button>
                </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex-grow flex flex-col bg-white dark:bg-dark-card border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            {/* Chat Messages Area */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 custom-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                        <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm flex flex-col gap-2 ${
                            msg.role === 'user' 
                                ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-tr-none' 
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-none'
                        }`}>
                            <div className="flex items-start gap-3">
                                <div className={`mt-1 flex-shrink-0 ${msg.role === 'user' ? 'order-2' : ''}`}>
                                    {msg.role === 'user' ? <User className="w-5 h-5 opacity-90" /> : <Bot className="w-5 h-5 text-purple-500" />}
                                </div>
                                
                                <div className="flex-grow">
                                    {/* Text Content */}
                                    {msg.text && (
                                        <div className={`text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${msg.role === 'model' ? 'text-gray-800 dark:text-gray-200' : 'text-white'}`}>
                                            {formatMessage(msg.text)}
                                        </div>
                                    )}

                                    {/* Loading State for Image */}
                                    {msg.isGeneratingImage && (
                                        <div className="mt-3 flex items-center space-x-2 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg animate-pulse">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-xs font-semibold">AI Artist is working...</span>
                                        </div>
                                    )}

                                    {/* Generated Image */}
                                    {msg.image && (
                                        <div className="mt-3 relative group">
                                            <img 
                                                src={msg.image} 
                                                alt="AI Generated" 
                                                className="rounded-lg shadow-md max-w-full h-auto border border-gray-200 dark:border-gray-700"
                                            />
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <a 
                                                    href={msg.image} 
                                                    download={`ai-diagram-${Date.now()}.png`}
                                                    className="bg-white/90 dark:bg-black/80 p-1.5 rounded-full hover:bg-white dark:hover:bg-black text-gray-700 dark:text-white"
                                                    title="Download Image"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {isLoading && !messages[messages.length-1]?.isGeneratingImage && (
                    <div className="flex justify-start animate-pulse">
                         <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
                            <Bot className="w-5 h-5 text-purple-500" />
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-dark-card border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2 relative">
                    <input 
                        type="text" 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={`Ask for a diagram, circuit, or explanation...`}
                        className="flex-grow p-4 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white placeholder-gray-500 transition-all"
                        disabled={isLoading}
                    />
                    <button 
                        type="submit"
                        disabled={isLoading || !inputValue.trim()}
                        className="absolute right-2 top-2 bottom-2 bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed aspect-square flex items-center justify-center transform active:scale-95"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                     <p className="text-[10px] sm:text-xs text-gray-400">
                        AI can make mistakes. Verify important info.
                    </p>
                    <div className="flex items-center text-[10px] sm:text-xs text-purple-600 dark:text-purple-400 font-medium">
                        <ImagePlus className="w-3 h-3 mr-1" />
                        <span>Supports Image Generation</span>
                    </div>
                </div>
            </form>
        </div>
      )}
    </div>
  );
};
