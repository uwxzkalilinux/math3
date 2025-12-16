import React, { useState, useRef, useEffect } from 'react';
import { ViewState, Message, Sender, ImageConfigOption } from './types';
import Navigation from './components/Navigation';
import ChatBubble from './components/ChatBubble';
import { 
  generateDeepTutorResponse, 
  generateMathVisual, 
  solveMathProblem, 
  quickExplain, 
  generatePresentationContent,
  generateSlideImage,
  fileToBase64 
} from './services/geminiService';
import { Send, Upload, Sparkles, ImagePlus, Zap, Search, Loader2, Menu } from 'lucide-react';
// Import PptxGenJS from ESM source defined in importmap
import PptxGenJS from 'pptxgenjs';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.TUTOR);
  
  // Presentation Flow State
  const [presentationStep, setPresentationStep] = useState<'TOPIC' | 'COUNT' | 'GENERATING'>('TOPIC');
  const [presentationTopic, setPresentationTopic] = useState('');
  
  // Chat States for different views
  const [messages, setMessages] = useState<Record<ViewState, Message[]>>({
    [ViewState.TUTOR]: [{ id: '1', sender: Sender.AI, text: "مرحباً! أنا معلم الرياضيات المتقدم. يمكنني مساعدتك في البراهين المعقدة، التفاضل والتكامل، والاستدلال العميق. على ماذا سنعمل اليوم؟", timestamp: Date.now() }],
    [ViewState.VISUALIZER]: [{ id: '1', sender: Sender.AI, text: "صِف شكلاً هندسياً أو مفهوماً رياضياً، وسأقوم بإنشاء تصور عالي الجودة لك.", timestamp: Date.now() }],
    [ViewState.SOLVER]: [{ id: '1', sender: Sender.AI, text: "ارفع صورة لمسألة رياضية، وسأقوم بشرح الحل خطوة بخطوة.", timestamp: Date.now() }],
    [ViewState.EXPLORER]: [{ id: '1', sender: Sender.AI, text: "اسألني أي شيء. يمكنني البحث في الويب عن بيانات في الوقت الفعلي أو إعطائك تعريفات سريعة.", timestamp: Date.now() }],
    [ViewState.PRESENTATION]: [{ id: '1', sender: Sender.AI, text: "مرحباً بك في منشئ العروض التقديمية. الرجاء إدخال **موضوع** العرض التقديمي.", timestamp: Date.now() }],
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  
  // Specific Controls
  const [visualSize, setVisualSize] = useState<"1K" | "2K" | "4K">("1K");
  const [explorerMode, setExplorerMode] = useState<'search' | 'fast'>('search');
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, view]);

  // Reset presentation flow if view changes
  useEffect(() => {
    if (view === ViewState.PRESENTATION && messages[ViewState.PRESENTATION].length <= 1) {
      setPresentationStep('TOPIC');
    }
  }, [view]);

  const addMessage = (viewId: ViewState, msg: Message) => {
    setMessages(prev => ({
      ...prev,
      [viewId]: [...prev[viewId], msg]
    }));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      text: inputText,
      timestamp: Date.now()
    };
    
    addMessage(view, userMsg);
    setInputText('');
    
    if (view === ViewState.PRESENTATION) {
      await handlePresentationFlow(userMsg.text);
    } else {
      await handleStandardFlow(userMsg);
    }
  };

  const handlePresentationFlow = async (input: string) => {
    setIsLoading(true);
    try {
      if (presentationStep === 'TOPIC') {
        setPresentationTopic(input);
        setPresentationStep('COUNT');
        addMessage(ViewState.PRESENTATION, {
          id: Date.now().toString(),
          sender: Sender.AI,
          text: `موضوع رائع: "${input}".\n\nكم عدد الشرائح التي تود إنشاؤها؟ (مثال: 5, 8, 10)`,
          timestamp: Date.now()
        });
        setIsLoading(false);
        return;
      }

      if (presentationStep === 'COUNT') {
        const count = parseInt(input);
        if (isNaN(count) || count < 1 || count > 20) {
           addMessage(ViewState.PRESENTATION, {
            id: Date.now().toString(),
            sender: Sender.AI,
            text: "الرجاء إدخال رقم صحيح للشرائح (بين 1 و 20).",
            timestamp: Date.now()
          });
          setIsLoading(false);
          return;
        }

        setPresentationStep('GENERATING');
        addMessage(ViewState.PRESENTATION, {
          id: Date.now().toString(),
          sender: Sender.AI,
          text: `بدء البحث عن "${presentationTopic}" لإنشاء ${count} شرائح...\n\n1. البحث عن بيانات دقيقة...\n2. هيكلة المحتوى...\n3. توليد رسوم توضيحية بالذكاء الاصطناعي لكل شريحة...\n\nقد يستغرق هذا دقيقة.`,
          timestamp: Date.now()
        });

        // 1. Generate Text Content
        const data = await generatePresentationContent(presentationTopic, count);

        // 2. Generate Images for each slide (Parallel-ish but limited to avoid rate limits if strict)
        const slidesWithImages = [];
        for (const slide of data.slides) {
           let imageBase64 = null;
           if (slide.imageDescription) {
             imageBase64 = await generateSlideImage(slide.imageDescription);
           }
           slidesWithImages.push({ ...slide, imageBase64 });
        }

        // 3. Build PPTX
        const pres = new PptxGenJS();
        pres.rtlMode = true; // Enable RTL mode for the presentation
        pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
        
        // Define Layout Constants
        const SLIDE_WIDTH = 10;
        const SLIDE_HEIGHT = 5.625;
        const MARGIN = 0.5;
        
        // Title Slide
        let titleSlide = pres.addSlide();
        titleSlide.background = { color: 'F1F5F9' }; // Slate-100
        titleSlide.addText(data.title, { x: 0.5, y: 2.0, w: '90%', fontSize: 36, align: 'center', color: '0F172A', bold: true, rtl: true });
        titleSlide.addText(`تم الإنشاء بواسطة MathMind AI`, { x: 0.5, y: 3.5, w: '90%', fontSize: 18, align: 'center', color: '475569', rtl: true });

        // Content Slides
        slidesWithImages.forEach(s => {
          let slide = pres.addSlide();
          slide.background = { color: 'FFFFFF' };
          
          // --- 1. Title Area (Top) ---
          slide.addText(s.title, { 
            x: MARGIN, y: 0.3, w: SLIDE_WIDTH - (MARGIN * 2), h: 0.7,
            fontSize: 24, bold: true, color: '4F46E5', valign: 'middle', rtl: true, align: 'right'
          });
          
          // Define Content Area Grid
          const contentY = 1.1;
          const contentHeight = 2.8;
          const imageWidth = 3.2;
          const textWidth = SLIDE_WIDTH - (MARGIN * 2) - imageWidth - 0.2; // 0.2 gap

          // --- 2. Image (Left Side in RTL logic, but visually depends on placement) ---
          // In RTL design, usually image is on Left, Text on Right.
          // Let's put Text on Right (x=High) and Image on Left (x=Low)
          
          // Right Side (Text)
          const textX = SLIDE_WIDTH - MARGIN - textWidth;
          
          // Left Side (Image)
          const imageX = MARGIN;

          if (s.imageBase64) {
             slide.addImage({ 
               data: s.imageBase64, 
               x: imageX, 
               y: contentY, 
               w: imageWidth, 
               h: contentHeight,
               sizing: { type: 'contain', w: imageWidth, h: contentHeight }
             });
          } else {
             // Fallback box if image failed
             slide.addShape(pres.ShapeType.rect, { 
               x: imageX, y: contentY, w: imageWidth, h: contentHeight, 
               fill: { color: 'F1F5F9' } 
             });
             slide.addText("لا توجد صورة", { 
               x: imageX, y: contentY, w: imageWidth, h: contentHeight, 
               fontSize: 10, align: 'center', color: '94A3B8' 
             });
          }

          // --- 3. Bullet Points (Right Side) ---
          // Prevent overlap with shrinkText: true
          const bullets = s.bullets.map(b => ({ 
            text: b, 
            options: { fontSize: 16, color: '334155', breakLine: true, bullet: true, inset: 5, rtl: true, align: 'right' } 
          }));
          
          slide.addText(bullets, { 
            x: textX, 
            y: contentY, 
            w: textWidth, 
            h: contentHeight, 
            lineSpacing: 24,
            valign: 'top',
            shrinkText: true,
            rtl: true,
            align: 'right'
          });
          
          // --- 4. Examples (Bottom Area) ---
          const examplesY = contentY + contentHeight + 0.1; // ~4.0
          const examplesHeight = SLIDE_HEIGHT - examplesY - MARGIN; // Remaining space ~1.1

          if (s.examples && s.examples.length > 0) {
             // Label
             slide.addText("أمثلة:", { 
               x: MARGIN, y: examplesY, w: textWidth, h: 0.3, 
               fontSize: 14, bold: true, color: '0F172A', rtl: true, align: 'right'
             });
             
             // Content
             const examples = s.examples.map(e => ({ 
               text: e, 
               options: { fontSize: 14, color: '475569', bullet: { type: 'number' }, rtl: true, align: 'right' } 
             }));
             
             slide.addText(examples, { 
               x: MARGIN, 
               y: examplesY + 0.3, 
               w: SLIDE_WIDTH - (MARGIN * 2), 
               h: examplesHeight - 0.3, 
               valign: 'top',
               shrinkText: true,
               rtl: true,
               align: 'right'
             });
          }

          // Notes
          if (s.speakerNotes) {
            slide.addNotes(s.speakerNotes);
          }
        });

        const fileName = `${data.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;
        await pres.writeFile({ fileName });

        addMessage(ViewState.PRESENTATION, {
          id: Date.now().toString(),
          sender: Sender.AI,
          text: `نجاح! تم إنشاء "${data.title}" مع ${slidesWithImages.length} شرائح.\n\nتضمن البحث، الأمثلة، ورسوم توضيحية خاصة. يجب أن يتم التحميل تلقائياً.`,
          timestamp: Date.now()
        });
        
        // Reset for next
        setPresentationStep('TOPIC');
        setPresentationTopic('');
      }

    } catch (error) {
      console.error(error);
      addMessage(ViewState.PRESENTATION, {
        id: Date.now().toString(),
        sender: Sender.AI,
        text: "واجهت خطأ أثناء إنشاء العرض التقديمي. يرجى المحاولة مرة أخرى.",
        timestamp: Date.now()
      });
      setPresentationStep('TOPIC');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStandardFlow = async (userMsg: Message) => {
    setIsLoading(true);
    try {
      let aiText = '';
      let sources: { uri: string; title: string }[] | undefined;
      
      if (view === ViewState.TUTOR) {
        // Deep Thinking Tutor
        const history = messages[ViewState.TUTOR].map(m => ({
          role: m.sender === Sender.USER ? 'user' : 'model',
          parts: [{ text: m.text }]
        }));
        history.push({ role: 'user', parts: [{ text: userMsg.text }]});
        
        aiText = await generateDeepTutorResponse(userMsg.text, history);
      
      } else if (view === ViewState.VISUALIZER) {
        // Image Gen
        const imageUrl = await generateMathVisual(userMsg.text, visualSize);
        if (imageUrl) {
          addMessage(view, {
            id: (Date.now() + 1).toString(),
            sender: Sender.AI,
            text: `إليك تصور بدقة ${visualSize} لـ: "${userMsg.text}"`,
            image: imageUrl,
            timestamp: Date.now()
          });
          setIsLoading(false);
          return;
        } else {
          aiText = "لم أتمكن من إنشاء الصورة. يرجى تجربة وصف مختلف.";
        }

      } else if (view === ViewState.EXPLORER) {
        // Search or Fast
        const result = await quickExplain(userMsg.text, explorerMode === 'search');
        aiText = result.text || "لم يتم توليد أي استجابة.";
        sources = result.sources;
      
      } else if (view === ViewState.SOLVER) {
        // Text-only input to solver
        aiText = await solveMathProblem('', userMsg.text);
      }

      addMessage(view, {
        id: (Date.now() + 1).toString(),
        sender: Sender.AI,
        text: aiText,
        sources: sources,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(error);
      addMessage(view, {
        id: (Date.now() + 1).toString(),
        sender: Sender.AI,
        text: "حدث خطأ ما.",
        timestamp: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const base64 = await fileToBase64(file);
      
      // Add User Image Message
      addMessage(view, {
        id: Date.now().toString(),
        sender: Sender.USER,
        text: "قم بتحليل هذه الصورة:",
        image: `data:${file.type};base64,${base64}`,
        timestamp: Date.now()
      });

      // Call API
      const result = await solveMathProblem(base64, "قم بحل المسألة الظاهرة في الصورة خطوة بخطوة باللغة العربية.");
      
      addMessage(view, {
        id: (Date.now() + 1).toString(),
        sender: Sender.AI,
        text: result,
        timestamp: Date.now()
      });

    } catch (error) {
       console.error(error);
       addMessage(view, {
        id: (Date.now() + 1).toString(),
        sender: Sender.AI,
        text: "فشل في معالجة الصورة.",
        timestamp: Date.now()
      });
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Helper for 'Enter' key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden" dir="rtl">
      
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full">
        <Navigation currentView={view} setView={setView} />
      </div>

      {/* Mobile Navigation Overlay */}
      {showMobileNav && (
        <div className="absolute inset-0 z-50 bg-slate-950 md:hidden">
          <Navigation currentView={view} setView={setView} onClose={() => setShowMobileNav(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* Mobile Header */}
        <div className="md:hidden p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center z-20">
           <div className="flex items-center gap-2">
             <h1 className="font-bold text-lg text-white">MathMind AI</h1>
           </div>
           <button 
             onClick={() => setShowMobileNav(true)}
             className="p-2 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700"
             aria-label="Open Menu"
           >
             <Menu size={24} />
           </button>
        </div>

        {/* View Header / Controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10 flex flex-wrap items-center justify-between gap-3 min-h-[60px]">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-slate-200">
              {view === ViewState.TUTOR && "المعلم المتقدم"}
              {view === ViewState.VISUALIZER && "المرسم الهندسي"}
              {view === ViewState.SOLVER && "حل المسائل"}
              {view === ViewState.EXPLORER && "مستكشف المفاهيم"}
              {view === ViewState.PRESENTATION && "صانع العروض"}
            </h2>
            {view === ViewState.TUTOR && (
              <span className="hidden sm:inline-block bg-indigo-500/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded border border-indigo-500/30">
                gemini-3-pro
              </span>
            )}
          </div>

          {/* View Specific Controls */}
          <div className="flex items-center gap-3">
            {view === ViewState.VISUALIZER && (
              <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                {(["1K", "2K", "4K"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setVisualSize(size)}
                    className={`text-xs px-3 py-1 rounded-md transition-all ${
                      visualSize === size 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}

            {view === ViewState.EXPLORER && (
              <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setExplorerMode('search')}
                  className={`flex items-center gap-1 text-xs px-3 py-1 rounded-md transition-all ${
                    explorerMode === 'search' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Search size={12} /> <span className="hidden sm:inline">بحث دقيق</span>
                </button>
                <button
                  onClick={() => setExplorerMode('fast')}
                  className={`flex items-center gap-1 text-xs px-3 py-1 rounded-md transition-all ${
                    explorerMode === 'fast' 
                    ? 'bg-yellow-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap size={12} /> <span className="hidden sm:inline">سريع</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages[view].map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start w-full animate-pulse">
               <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tr-none flex items-center gap-2 text-slate-400 text-sm">
                 <Sparkles size={16} className="animate-spin text-indigo-400" />
                 {view === ViewState.TUTOR ? 'جاري التفكير بعمق...' : 
                  view === ViewState.PRESENTATION ? 'جاري تصميم الشرائح والصور...' : 'جاري التوليد...'}
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="max-w-4xl mx-auto flex items-end gap-3">
            
            {view === ViewState.SOLVER && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-indigo-400 transition-all border border-slate-700 flex items-center gap-2"
                  title="رفع صورة"
                >
                  <ImagePlus size={20} />
                  <span className="hidden sm:inline text-xs font-medium">رفع</span>
                </button>
              </>
            )}

            <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all flex items-center">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  view === ViewState.TUTOR ? "اطلب حلاً أو شرحاً..." :
                  view === ViewState.VISUALIZER ? "صف الشكل الهندسي..." :
                  view === ViewState.SOLVER ? "سياق إضافي (اختياري)..." :
                  view === ViewState.PRESENTATION ? (presentationStep === 'TOPIC' ? "أدخل موضوع العرض التقديمي..." : "أدخل عدد الشرائح...") :
                  "ابحث..."
                }
                className="w-full bg-transparent border-none text-slate-200 placeholder-slate-500 px-4 py-3 focus:ring-0 resize-none max-h-32 min-h-[48px]"
                rows={1}
                dir="rtl"
              />
            </div>

            <button
              onClick={handleSendMessage}
              disabled={isLoading || (!inputText.trim() && view !== ViewState.SOLVER)}
              className={`p-3 rounded-xl flex items-center gap-2 justify-center transition-all ${
                isLoading || (!inputText.trim() && view !== ViewState.SOLVER)
                  ? 'bg-slate-800 text-slate-500' // Better contrast for disabled state
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
              }`}
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="rotate-180" />} 
              <span className="hidden sm:inline font-medium">إرسال</span>
            </button>
          </div>
          <div className="max-w-4xl mx-auto text-center mt-2">
             <p className="text-[10px] text-slate-600">
               قد يرتكب MathMind أخطاء. تحقق دائماً من الحسابات الهامة.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;